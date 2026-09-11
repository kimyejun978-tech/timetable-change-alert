-- 실서비스 첫 관리자 선점 방지
-- 모든 신규 교사는 기본적으로 승인 대기 상태로 생성하고,
-- 최초 학교 관리자는 service_role 전용 RPC로 운영자가 승격합니다.

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

  if found and v_existing.school_id = v_school_id then
    update public.teacher_profiles
    set name = p_name
    where auth_user_id = auth.uid();
    return public.get_my_teacher_profile();
  end if;

  -- 새 교사는 누구든 먼저 승인 대기 상태로 들어간다.
  insert into public.teacher_profiles (auth_user_id, school_id, name, role, verified)
  values (auth.uid(), v_school_id, p_name, 'teacher', false)
  on conflict (auth_user_id)
  do update set
    school_id = excluded.school_id,
    name = excluded.name,
    role = 'teacher',
    verified = false;

  return public.get_my_teacher_profile();
end;
$$;

-- 운영자/service_role만 최초 학교 관리자를 지정할 수 있다.
create or replace function public.operator_promote_school_admin(p_teacher_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school_id uuid;
begin
  select school_id into v_school_id
  from public.teacher_profiles
  where auth_user_id = p_teacher_user_id;

  if v_school_id is null then
    raise exception 'TEACHER_NOT_FOUND';
  end if;

  update public.teacher_profiles
  set verified = true,
      role = 'school_admin'
  where auth_user_id = p_teacher_user_id;
end;
$$;

revoke execute on function public.register_teacher_profile(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.register_teacher_profile(text,text,text,text,text,text) to authenticated;

revoke execute on function public.operator_promote_school_admin(uuid) from public, anon, authenticated;
grant execute on function public.operator_promote_school_admin(uuid) to service_role;
