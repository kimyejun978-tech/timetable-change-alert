-- 오늘체육 공동 담당 교사 + 변경 이력 + 학생 알림

create table if not exists public.lesson_changes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.pe_lessons(id) on delete set null,
  school_id uuid not null references public.schools(id) on delete cascade,
  lesson_date date not null,
  period smallint not null,
  grade smallint not null,
  class_number smallint not null,
  change_type text not null check (change_type in ('create', 'update', 'delete', 'teachers')),
  changed_by uuid references public.teacher_profiles(auth_user_id) on delete set null,
  changed_by_name text not null default '',
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lesson_changes_school_class_idx
  on public.lesson_changes (school_id, grade, class_number, lesson_date desc, created_at desc);
create index if not exists lesson_changes_lesson_idx
  on public.lesson_changes (lesson_id, created_at desc);

alter table public.lesson_changes enable row level security;
revoke all on public.lesson_changes from anon, authenticated;

create or replace function public.log_pe_lesson_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := '';
  v_user uuid := auth.uid();
begin
  if v_user is not null then
    select name into v_name
    from public.teacher_profiles
    where auth_user_id = v_user;
  end if;

  if tg_op = 'INSERT' then
    insert into public.lesson_changes (
      lesson_id, school_id, lesson_date, period, grade, class_number,
      change_type, changed_by, changed_by_name, before_data, after_data
    ) values (
      new.id, new.school_id, new.lesson_date, new.period, new.grade, new.class_number,
      'create', v_user, coalesce(v_name, ''), null, to_jsonb(new)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(old) is distinct from to_jsonb(new) then
      insert into public.lesson_changes (
        lesson_id, school_id, lesson_date, period, grade, class_number,
        change_type, changed_by, changed_by_name, before_data, after_data
      ) values (
        new.id, new.school_id, new.lesson_date, new.period, new.grade, new.class_number,
        'update', v_user, coalesce(v_name, ''), to_jsonb(old), to_jsonb(new)
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.lesson_changes (
      lesson_id, school_id, lesson_date, period, grade, class_number,
      change_type, changed_by, changed_by_name, before_data, after_data
    ) values (
      null, old.school_id, old.lesson_date, old.period, old.grade, old.class_number,
      'delete', v_user, coalesce(v_name, ''), to_jsonb(old), null
    );
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists pe_lessons_change_log on public.pe_lessons;
create trigger pe_lessons_change_log
after insert or update or delete on public.pe_lessons
for each row execute function public.log_pe_lesson_change();

create or replace function public.get_school_teachers()
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

  select coalesce(jsonb_agg(jsonb_build_object(
    'teacherId', auth_user_id,
    'name', name,
    'role', role,
    'isMe', auth_user_id = auth.uid()
  ) order by name), '[]'::jsonb)
  into result
  from public.teacher_profiles
  where school_id = v_school_id and verified = true;

  return result;
end;
$$;

create or replace function public.set_lesson_teachers(
  p_lesson_id uuid,
  p_teacher_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.teacher_profiles%rowtype;
  v_lesson public.pe_lessons%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_name text;
  v_invalid_count integer;
begin
  select * into v_profile
  from public.teacher_profiles
  where auth_user_id = auth.uid();

  if v_profile.auth_user_id is null or v_profile.verified is not true then
    raise exception 'TEACHER_NOT_VERIFIED';
  end if;

  select * into v_lesson
  from public.pe_lessons
  where id = p_lesson_id;

  if v_lesson.id is null or v_lesson.school_id <> v_profile.school_id then
    raise exception 'LESSON_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.lesson_teachers
    where lesson_id = p_lesson_id and teacher_id = auth.uid()
  ) and v_profile.role <> 'school_admin' then
    raise exception 'EDIT_FORBIDDEN';
  end if;

  if p_teacher_ids is null or cardinality(p_teacher_ids) = 0 then
    raise exception 'AT_LEAST_ONE_TEACHER_REQUIRED';
  end if;

  if v_profile.role <> 'school_admin' and not (auth.uid() = any(p_teacher_ids)) then
    raise exception 'SELF_MUST_REMAIN_ASSIGNED';
  end if;

  select count(*) into v_invalid_count
  from unnest(p_teacher_ids) as u(teacher_id)
  where not exists (
    select 1 from public.teacher_profiles tp
    where tp.auth_user_id = u.teacher_id
      and tp.school_id = v_profile.school_id
      and tp.verified = true
  );

  if v_invalid_count > 0 then
    raise exception 'INVALID_TEACHER';
  end if;

  select coalesce(jsonb_agg(teacher_id order by teacher_id), '[]'::jsonb)
  into v_before
  from public.lesson_teachers
  where lesson_id = p_lesson_id;

  delete from public.lesson_teachers where lesson_id = p_lesson_id;
  insert into public.lesson_teachers (lesson_id, teacher_id)
  select p_lesson_id, u.teacher_id
  from (select distinct teacher_id from unnest(p_teacher_ids) as x(teacher_id)) u;

  select coalesce(jsonb_agg(teacher_id order by teacher_id), '[]'::jsonb)
  into v_after
  from public.lesson_teachers
  where lesson_id = p_lesson_id;

  select name into v_name from public.teacher_profiles where auth_user_id = auth.uid();

  if v_before is distinct from v_after then
    insert into public.lesson_changes (
      lesson_id, school_id, lesson_date, period, grade, class_number,
      change_type, changed_by, changed_by_name, before_data, after_data
    ) values (
      v_lesson.id, v_lesson.school_id, v_lesson.lesson_date, v_lesson.period,
      v_lesson.grade, v_lesson.class_number, 'teachers', auth.uid(), coalesce(v_name, ''),
      jsonb_build_object('teacher_ids', v_before),
      jsonb_build_object('teacher_ids', v_after)
    );
  end if;
end;
$$;

create or replace function public.get_lesson_history(p_lesson_id uuid)
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

  if not exists (
    select 1 from public.pe_lessons
    where id = p_lesson_id and school_id = v_school_id
  ) then
    raise exception 'LESSON_NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'changeType', change_type,
    'changedByName', changed_by_name,
    'beforeData', before_data,
    'afterData', after_data,
    'createdAt', created_at
  ) order by created_at desc), '[]'::jsonb)
  into result
  from public.lesson_changes
  where lesson_id = p_lesson_id and school_id = v_school_id;

  return result;
end;
$$;

create or replace function public.get_student_notifications(
  p_neis_office_code text,
  p_neis_school_code text,
  p_grade integer,
  p_class_number integer,
  p_from timestamptz
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'lessonId', c.lesson_id,
    'lessonDate', c.lesson_date,
    'period', c.period,
    'grade', c.grade,
    'classNo', c.class_number,
    'changeType', c.change_type,
    'changedByName', c.changed_by_name,
    'beforeData', c.before_data,
    'afterData', c.after_data,
    'createdAt', c.created_at
  ) order by c.created_at desc), '[]'::jsonb)
  from public.lesson_changes c
  join public.schools s on s.id = c.school_id
  where s.neis_office_code = p_neis_office_code
    and s.neis_school_code = p_neis_school_code
    and c.grade = p_grade
    and c.class_number = p_class_number
    and c.created_at >= p_from
    and c.change_type in ('create', 'update', 'delete');
$$;

revoke all on function public.get_school_teachers() from public, anon, authenticated;
revoke all on function public.set_lesson_teachers(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.get_lesson_history(uuid) from public, anon, authenticated;
revoke all on function public.get_student_notifications(text,text,integer,integer,timestamptz) from public, anon, authenticated;

grant execute on function public.get_school_teachers() to authenticated;
grant execute on function public.set_lesson_teachers(uuid, uuid[]) to authenticated;
grant execute on function public.get_lesson_history(uuid) to authenticated;
grant execute on function public.get_student_notifications(text,text,integer,integer,timestamptz) to anon, authenticated;
