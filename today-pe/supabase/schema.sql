-- 오늘체육 Supabase schema + RLS/RPC
-- Supabase SQL Editor에서 한 번 실행하세요.

create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  neis_office_code text not null,
  neis_school_code text not null,
  name text not null,
  region text,
  address text,
  created_at timestamptz not null default now(),
  unique (neis_office_code, neis_school_code)
);

create table if not exists public.teacher_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  role text not null default 'teacher' check (role in ('teacher', 'school_admin')),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pe_lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  lesson_date date not null,
  period smallint not null check (period between 1 and 12),
  grade smallint not null check (grade between 1 and 6),
  class_number smallint not null check (class_number between 1 and 50),
  activity text not null,
  location text not null,
  equipment text[] not null default '{}',
  notice text not null default '',
  created_by uuid not null references public.teacher_profiles(auth_user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, lesson_date, grade, class_number, period)
);

create table if not exists public.lesson_teachers (
  lesson_id uuid not null references public.pe_lessons(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(auth_user_id) on delete cascade,
  primary key (lesson_id, teacher_id)
);

create index if not exists pe_lessons_school_date_idx
  on public.pe_lessons (school_id, lesson_date);

alter table public.schools enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.pe_lessons enable row level security;
alter table public.lesson_teachers enable row level security;

-- 직접 테이블 접근은 최소화한다. 학생은 RPC만 사용한다.
revoke all on public.schools from anon, authenticated;
revoke all on public.teacher_profiles from anon, authenticated;
revoke all on public.pe_lessons from anon, authenticated;
revoke all on public.lesson_teachers from anon, authenticated;

create or replace function public.get_my_teacher_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select jsonb_build_object(
    'teacher_id', tp.auth_user_id,
    'name', tp.name,
    'role', tp.role,
    'verified', tp.verified,
    'school_id', s.id,
    'neis_office_code', s.neis_office_code,
    'neis_school_code', s.neis_school_code,
    'school_name', s.name,
    'school_region', s.region,
    'school_address', s.address
  )
  into result
  from public.teacher_profiles tp
  join public.schools s on s.id = tp.school_id
  where tp.auth_user_id = auth.uid();

  return result;
end;
$$;

create or replace function public.register_teacher_profile(
  p_name text,
  p_neis_office_code text,
  p_neis_school_code text,
  p_school_name text,
  p_school_region text,
  p_school_address text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_existing public.teacher_profiles%rowtype;
  v_verified_count integer;
  v_role text;
  v_verified boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  insert into public.schools (neis_office_code, neis_school_code, name, region, address)
  values (p_neis_office_code, p_neis_school_code, p_school_name, p_school_region, p_school_address)
  on conflict (neis_office_code, neis_school_code)
  do update set
    name = excluded.name,
    region = excluded.region,
    address = excluded.address
  returning id into v_school_id;

  select * into v_existing
  from public.teacher_profiles
  where auth_user_id = auth.uid();

  if found and v_existing.school_id = v_school_id then
    update public.teacher_profiles
    set name = p_name
    where auth_user_id = auth.uid();
    return public.get_my_teacher_profile();
  end if;

  select count(*) into v_verified_count
  from public.teacher_profiles
  where school_id = v_school_id and verified = true;

  v_verified := v_verified_count = 0;
  v_role := case when v_verified then 'school_admin' else 'teacher' end;

  insert into public.teacher_profiles (auth_user_id, school_id, name, role, verified)
  values (auth.uid(), v_school_id, p_name, v_role, v_verified)
  on conflict (auth_user_id)
  do update set
    school_id = excluded.school_id,
    name = excluded.name,
    role = excluded.role,
    verified = excluded.verified;

  return public.get_my_teacher_profile();
end;
$$;

create or replace function public.get_student_lessons(
  p_neis_office_code text,
  p_neis_school_code text,
  p_grade integer,
  p_class_number integer,
  p_from date,
  p_to date
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_data order by (row_data->>'lesson_date')::date, (row_data->>'period')::integer), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', l.id,
      'school_id', l.school_id,
      'school_code', s.neis_office_code || ':' || s.neis_school_code,
      'school_name', s.name,
      'lesson_date', l.lesson_date,
      'period', l.period,
      'grade', l.grade,
      'class_number', l.class_number,
      'activity', l.activity,
      'location', l.location,
      'equipment', l.equipment,
      'notice', l.notice,
      'teacher_ids', coalesce(t.teacher_ids, '[]'::jsonb),
      'teacher_names', coalesce(t.teacher_names, '[]'::jsonb),
      'teacher_id', l.created_by,
      'teacher_name', coalesce(t.primary_name, ''),
      'updated_at', l.updated_at
    ) as row_data
    from public.pe_lessons l
    join public.schools s on s.id = l.school_id
    left join lateral (
      select
        jsonb_agg(tp.auth_user_id order by tp.name) as teacher_ids,
        jsonb_agg(tp.name order by tp.name) as teacher_names,
        min(tp.name) as primary_name
      from public.lesson_teachers lt
      join public.teacher_profiles tp on tp.auth_user_id = lt.teacher_id
      where lt.lesson_id = l.id
    ) t on true
    where s.neis_office_code = p_neis_office_code
      and s.neis_school_code = p_neis_school_code
      and l.grade = p_grade
      and l.class_number = p_class_number
      and l.lesson_date between p_from and p_to
  ) q;
$$;

create or replace function public.get_teacher_lessons(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_verified boolean;
  result jsonb;
begin
  select school_id, verified into v_school_id, v_verified
  from public.teacher_profiles
  where auth_user_id = auth.uid();

  if v_school_id is null or v_verified is not true then
    raise exception 'TEACHER_NOT_VERIFIED';
  end if;

  select coalesce(jsonb_agg(row_data order by (row_data->>'lesson_date')::date, (row_data->>'period')::integer), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', l.id,
      'school_id', l.school_id,
      'school_code', s.neis_office_code || ':' || s.neis_school_code,
      'school_name', s.name,
      'lesson_date', l.lesson_date,
      'period', l.period,
      'grade', l.grade,
      'class_number', l.class_number,
      'activity', l.activity,
      'location', l.location,
      'equipment', l.equipment,
      'notice', l.notice,
      'teacher_ids', coalesce(t.teacher_ids, '[]'::jsonb),
      'teacher_names', coalesce(t.teacher_names, '[]'::jsonb),
      'teacher_id', l.created_by,
      'teacher_name', coalesce(t.primary_name, ''),
      'updated_at', l.updated_at
    ) as row_data
    from public.pe_lessons l
    join public.schools s on s.id = l.school_id
    left join lateral (
      select
        jsonb_agg(tp.auth_user_id order by tp.name) as teacher_ids,
        jsonb_agg(tp.name order by tp.name) as teacher_names,
        min(tp.name) as primary_name
      from public.lesson_teachers lt
      join public.teacher_profiles tp on tp.auth_user_id = lt.teacher_id
      where lt.lesson_id = l.id
    ) t on true
    where l.school_id = v_school_id
      and l.lesson_date between p_from and p_to
  ) q;

  return result;
end;
$$;

create or replace function public.save_pe_lesson(
  p_id uuid,
  p_lesson_date date,
  p_period integer,
  p_grade integer,
  p_class_number integer,
  p_activity text,
  p_location text,
  p_equipment text[],
  p_notice text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.teacher_profiles%rowtype;
  v_target public.pe_lessons%rowtype;
  v_conflict public.pe_lessons%rowtype;
  v_lesson_id uuid;
begin
  select * into v_profile from public.teacher_profiles where auth_user_id = auth.uid();
  if v_profile.auth_user_id is null or v_profile.verified is not true then
    raise exception 'TEACHER_NOT_VERIFIED';
  end if;

  if p_id is not null then
    select * into v_target from public.pe_lessons where id = p_id;
    if v_target.id is null or v_target.school_id <> v_profile.school_id then
      raise exception 'LESSON_NOT_FOUND';
    end if;
    if not exists (
      select 1 from public.lesson_teachers where lesson_id = p_id and teacher_id = auth.uid()
    ) then
      raise exception 'EDIT_FORBIDDEN';
    end if;
  end if;

  select * into v_conflict
  from public.pe_lessons
  where school_id = v_profile.school_id
    and lesson_date = p_lesson_date
    and grade = p_grade
    and class_number = p_class_number
    and period = p_period
    and (p_id is null or id <> p_id)
  limit 1;

  if v_conflict.id is not null then
    if not exists (
      select 1 from public.lesson_teachers where lesson_id = v_conflict.id and teacher_id = auth.uid()
    ) then
      raise exception 'SLOT_OWNED_BY_OTHER_TEACHER';
    end if;
    v_lesson_id := v_conflict.id;
  else
    v_lesson_id := p_id;
  end if;

  if v_lesson_id is null then
    insert into public.pe_lessons (
      school_id, lesson_date, period, grade, class_number,
      activity, location, equipment, notice, created_by
    ) values (
      v_profile.school_id, p_lesson_date, p_period, p_grade, p_class_number,
      p_activity, p_location, coalesce(p_equipment, '{}'), coalesce(p_notice, ''), auth.uid()
    ) returning id into v_lesson_id;
  else
    update public.pe_lessons
    set lesson_date = p_lesson_date,
        period = p_period,
        grade = p_grade,
        class_number = p_class_number,
        activity = p_activity,
        location = p_location,
        equipment = coalesce(p_equipment, '{}'),
        notice = coalesce(p_notice, ''),
        updated_at = now()
    where id = v_lesson_id;
  end if;

  insert into public.lesson_teachers (lesson_id, teacher_id)
  values (v_lesson_id, auth.uid())
  on conflict do nothing;

  return (
    select jsonb_build_object(
      'id', l.id,
      'school_id', l.school_id,
      'school_code', s.neis_office_code || ':' || s.neis_school_code,
      'school_name', s.name,
      'lesson_date', l.lesson_date,
      'period', l.period,
      'grade', l.grade,
      'class_number', l.class_number,
      'activity', l.activity,
      'location', l.location,
      'equipment', l.equipment,
      'notice', l.notice,
      'teacher_ids', jsonb_build_array(auth.uid()),
      'teacher_names', jsonb_build_array(v_profile.name),
      'teacher_id', auth.uid(),
      'teacher_name', v_profile.name,
      'updated_at', l.updated_at
    )
    from public.pe_lessons l
    join public.schools s on s.id = l.school_id
    where l.id = v_lesson_id
  );
end;
$$;

create or replace function public.delete_pe_lesson(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.lesson_teachers lt
    join public.teacher_profiles tp on tp.auth_user_id = lt.teacher_id
    where lt.lesson_id = p_id
      and lt.teacher_id = auth.uid()
      and tp.verified = true
  ) then
    raise exception 'DELETE_FORBIDDEN';
  end if;
  delete from public.pe_lessons where id = p_id;
end;
$$;

create or replace function public.get_pending_teachers()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_role text;
  result jsonb;
begin
  select school_id, role into v_school_id, v_role
  from public.teacher_profiles where auth_user_id = auth.uid() and verified = true;
  if v_role <> 'school_admin' then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'teacherId', auth_user_id,
    'name', name,
    'email', coalesce((select email from auth.users where id = auth_user_id), ''),
    'createdAt', created_at
  ) order by created_at), '[]'::jsonb)
  into result
  from public.teacher_profiles
  where school_id = v_school_id and verified = false;
  return result;
end;
$$;

create or replace function public.approve_teacher(p_teacher_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
  v_role text;
begin
  select school_id, role into v_school_id, v_role
  from public.teacher_profiles where auth_user_id = auth.uid() and verified = true;
  if v_role <> 'school_admin' then raise exception 'ADMIN_REQUIRED'; end if;

  update public.teacher_profiles
  set verified = true
  where auth_user_id = p_teacher_user_id and school_id = v_school_id;
  if not found then raise exception 'TEACHER_NOT_FOUND'; end if;
end;
$$;

grant execute on function public.get_my_teacher_profile() to authenticated;
grant execute on function public.register_teacher_profile(text,text,text,text,text,text) to authenticated;
grant execute on function public.get_student_lessons(text,text,integer,integer,date,date) to anon, authenticated;
grant execute on function public.get_teacher_lessons(date,date) to authenticated;
grant execute on function public.save_pe_lesson(uuid,date,integer,integer,integer,text,text,text[],text) to authenticated;
grant execute on function public.delete_pe_lesson(uuid) to authenticated;
grant execute on function public.get_pending_teachers() to authenticated;
grant execute on function public.approve_teacher(uuid) to authenticated;

-- Realtime: Supabase Dashboard > Database > Replication에서 pe_lessons를 켜도 됩니다.
-- SQL로 활성화 가능한 프로젝트라면 아래를 실행하세요.
-- alter publication supabase_realtime add table public.pe_lessons;
