-- 교사 계정은 최초 등록 후 클라이언트에서 소속 학교를 바꿀 수 없습니다.
-- 학교 이동/정정은 운영자 절차로만 처리합니다.

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

  if found then
    if v_existing.school_id <> v_school_id then
      raise exception 'SCHOOL_CHANGE_REQUIRES_OPERATOR';
    end if;

    -- 같은 학교로 다시 로그인한 경우 표시 이름만 갱신합니다.
    -- role/verified/school_id는 클라이언트가 바꿀 수 없습니다.
    update public.teacher_profiles
    set name = p_name
    where auth_user_id = auth.uid();

    return public.get_my_teacher_profile();
  end if;

  insert into public.teacher_profiles (auth_user_id, school_id, name, role, verified)
  values (auth.uid(), v_school_id, p_name, 'teacher', false);

  return public.get_my_teacher_profile();
end;
$$;

revoke execute on function public.register_teacher_profile(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_teacher_profile(text, text, text, text, text, text)
  to authenticated;
