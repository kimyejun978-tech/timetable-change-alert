-- 학교 관리자가 승인된 교사의 접근 권한을 회수합니다.
-- 회수 대상이 단독 담당하던 수업은 현재 학교 관리자에게 자동 인계합니다.

create or replace function public.revoke_teacher_access(p_teacher_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin public.teacher_profiles%rowtype;
  v_target public.teacher_profiles%rowtype;
  v_lesson_id uuid;
begin
  select * into v_admin
  from public.teacher_profiles
  where auth_user_id = auth.uid();

  if v_admin.auth_user_id is null
     or v_admin.verified is not true
     or v_admin.role <> 'school_admin' then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_teacher_user_id = auth.uid() then
    raise exception 'CANNOT_REVOKE_SELF';
  end if;

  select * into v_target
  from public.teacher_profiles
  where auth_user_id = p_teacher_user_id
    and school_id = v_admin.school_id;

  if v_target.auth_user_id is null then
    raise exception 'TEACHER_NOT_FOUND';
  end if;

  if v_target.verified is not true then
    raise exception 'TEACHER_ALREADY_INACTIVE';
  end if;

  -- 대상 교사가 맡고 있던 수업에서 연결을 제거한다.
  -- 다른 승인 교사가 하나도 남지 않으면 현재 학교 관리자를 담당자로 넣는다.
  for v_lesson_id in
    select lesson_id
    from public.lesson_teachers
    where teacher_id = p_teacher_user_id
  loop
    delete from public.lesson_teachers
    where lesson_id = v_lesson_id
      and teacher_id = p_teacher_user_id;

    if not exists (
      select 1
      from public.lesson_teachers lt
      join public.teacher_profiles tp on tp.auth_user_id = lt.teacher_id
      where lt.lesson_id = v_lesson_id
        and tp.school_id = v_admin.school_id
        and tp.verified = true
    ) then
      insert into public.lesson_teachers (lesson_id, teacher_id)
      values (v_lesson_id, auth.uid())
      on conflict do nothing;
    end if;
  end loop;

  delete from public.teacher_timetable_aliases
  where teacher_id = p_teacher_user_id;

  update public.teacher_profiles
  set verified = false,
      role = 'teacher'
  where auth_user_id = p_teacher_user_id
    and school_id = v_admin.school_id;
end;
$$;

revoke execute on function public.revoke_teacher_access(uuid) from public, anon, authenticated;
grant execute on function public.revoke_teacher_access(uuid) to authenticated;
