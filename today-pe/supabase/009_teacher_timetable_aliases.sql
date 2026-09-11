-- 컴시간 담당교사명 ↔ 오늘체육 교사 계정 별칭 매핑

create table if not exists public.teacher_timetable_aliases (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.teacher_profiles(auth_user_id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 40),
  alias_key text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, alias_key),
  unique (school_id, alias_key)
);

create index if not exists teacher_timetable_aliases_teacher_idx
  on public.teacher_timetable_aliases (teacher_id);

alter table public.teacher_timetable_aliases enable row level security;
revoke all on public.teacher_timetable_aliases from anon, authenticated;

create or replace function public.get_my_timetable_aliases()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_verified boolean;
  result jsonb;
begin
  select verified into v_verified
  from public.teacher_profiles
  where auth_user_id = auth.uid();

  if v_verified is not true then
    raise exception 'TEACHER_NOT_VERIFIED';
  end if;

  select coalesce(jsonb_agg(alias order by alias), '[]'::jsonb)
  into result
  from public.teacher_timetable_aliases
  where teacher_id = auth.uid();

  return result;
end;
$$;

create or replace function public.set_my_timetable_aliases(p_aliases text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.teacher_profiles%rowtype;
  v_alias text;
  v_key text;
  v_count integer := 0;
begin
  select * into v_profile
  from public.teacher_profiles
  where auth_user_id = auth.uid();

  if v_profile.auth_user_id is null or v_profile.verified is not true then
    raise exception 'TEACHER_NOT_VERIFIED';
  end if;

  if coalesce(cardinality(p_aliases), 0) > 10 then
    raise exception 'TOO_MANY_ALIASES';
  end if;

  -- 먼저 모든 값을 검증한다. 예외 발생 시 기존 설정은 그대로 유지된다.
  for v_alias in
    select distinct btrim(value)
    from unnest(coalesce(p_aliases, array[]::text[])) as t(value)
    where btrim(value) <> ''
  loop
    if char_length(v_alias) > 40 then
      raise exception 'ALIAS_TOO_LONG';
    end if;

    v_key := lower(regexp_replace(v_alias, '\s+', '', 'g'));
    if v_key = '' then
      continue;
    end if;

    -- 다른 교사의 실제 표시 이름과 충돌하는 별칭은 허용하지 않는다.
    if exists (
      select 1
      from public.teacher_profiles tp
      where tp.school_id = v_profile.school_id
        and tp.auth_user_id <> auth.uid()
        and tp.verified = true
        and lower(regexp_replace(btrim(tp.name), '\s+', '', 'g')) = v_key
    ) then
      raise exception 'ALIAS_CONFLICTS_WITH_TEACHER_NAME';
    end if;

    -- 다른 교사가 이미 쓰는 별칭도 허용하지 않는다.
    if exists (
      select 1
      from public.teacher_timetable_aliases a
      where a.school_id = v_profile.school_id
        and a.teacher_id <> auth.uid()
        and a.alias_key = v_key
    ) then
      raise exception 'ALIAS_ALREADY_USED';
    end if;

    v_count := v_count + 1;
  end loop;

  delete from public.teacher_timetable_aliases
  where teacher_id = auth.uid();

  insert into public.teacher_timetable_aliases (school_id, teacher_id, alias, alias_key)
  select
    v_profile.school_id,
    auth.uid(),
    btrim(value),
    lower(regexp_replace(btrim(value), '\s+', '', 'g'))
  from (
    select distinct value
    from unnest(coalesce(p_aliases, array[]::text[])) as t(value)
    where btrim(value) <> ''
  ) q
  where lower(regexp_replace(btrim(value), '\s+', '', 'g'))
        <> lower(regexp_replace(btrim(v_profile.name), '\s+', '', 'g'))
  on conflict (teacher_id, alias_key) do nothing;

  return public.get_my_timetable_aliases();
end;
$$;

revoke execute on function public.get_my_timetable_aliases() from public, anon, authenticated;
revoke execute on function public.set_my_timetable_aliases(text[]) from public, anon, authenticated;
grant execute on function public.get_my_timetable_aliases() to authenticated;
grant execute on function public.set_my_timetable_aliases(text[]) to authenticated;
