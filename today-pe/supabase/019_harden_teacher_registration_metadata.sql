-- 교사 가입 RPC가 기존 학교의 이름/주소 메타데이터를 덮어쓰지 못하게 합니다.
-- 신규 학교는 승인 전 verified=false이며, 최초 관리자는 운영자 검증을 거칩니다.

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
  v_name text := btrim(coalesce(p_name, ''));
  v_office text := btrim(coalesce(p_neis_office_code, ''));
  v_school_code text := btrim(coalesce(p_neis_school_code, ''));
  v_school_name text := btrim(coalesce(p_school_name, ''));
  v_region text := btrim(coalesce(p_school_region, ''));
  v_address text := btrim(coalesce(p_school_address, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'INVALID_TEACHER_NAME';
  end if;
  if v_office !~ '^[A-Za-z0-9]{2,20}$' or v_school_code !~ '^[0-9]{5,20}$' then
    raise exception 'INVALID_SCHOOL_CODE';
  end if;
  if char_length(v_school_name) < 1 or char_length(v_school_name) > 200
     or char_length(v_region) > 100
     or char_length(v_address) > 500 then
    raise exception 'INVALID_SCHOOL_METADATA';
  end if;

  -- 기존 학교 행은 교사 클라이언트 입력으로 갱신하지 않습니다.
  insert into public.schools (
    neis_office_code, neis_school_code, name, region, address
  ) values (
    v_office, v_school_code, v_school_name, v_region, v_address
  )
  on conflict (neis_office_code, neis_school_code) do nothing;

  select id into v_school_id
  from public.schools
  where neis_office_code = v_office
    and neis_school_code = v_school_code;

  if v_school_id is null then
    raise exception 'SCHOOL_REGISTRATION_FAILED';
  end if;

  select * into v_existing
  from public.teacher_profiles
  where auth_user_id = auth.uid();

  if found then
    if v_existing.school_id <> v_school_id then
      raise exception 'SCHOOL_CHANGE_REQUIRES_OPERATOR';
    end if;

    update public.teacher_profiles
    set name = v_name
    where auth_user_id = auth.uid();

    return public.get_my_teacher_profile();
  end if;

  insert into public.teacher_profiles (auth_user_id, school_id, name, role, verified)
  values (auth.uid(), v_school_id, v_name, 'teacher', false);

  return public.get_my_teacher_profile();
end;
$$;

revoke execute on function public.register_teacher_profile(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_teacher_profile(text, text, text, text, text, text)
  to authenticated;
