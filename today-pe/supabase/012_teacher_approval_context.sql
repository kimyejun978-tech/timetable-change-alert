-- 교사 승인 대기 사유를 구분하기 위한 읽기 전용 RPC
-- 최초 학교는 운영자 승인, 기존 학교는 학교 관리자 승인으로 안내합니다.

create or replace function public.get_my_teacher_approval_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.teacher_profiles%rowtype;
  v_has_admin boolean := false;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_profile
  from public.teacher_profiles
  where auth_user_id = auth.uid();

  if v_profile.auth_user_id is null then
    return null;
  end if;

  select exists (
    select 1
    from public.teacher_profiles tp
    where tp.school_id = v_profile.school_id
      and tp.verified = true
      and tp.role = 'school_admin'
  ) into v_has_admin;

  return jsonb_build_object(
    'verified', v_profile.verified,
    'role', v_profile.role,
    'hasSchoolAdmin', v_has_admin,
    'approvalRoute', case
      when v_profile.verified = true then 'approved'
      when v_has_admin then 'school_admin'
      else 'operator'
    end
  );
end;
$$;

revoke execute on function public.get_my_teacher_approval_context() from public, anon, authenticated;
grant execute on function public.get_my_teacher_approval_context() to authenticated;
