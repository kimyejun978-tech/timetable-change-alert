-- 수업 삭제 권한을 담당교사 연결뿐 아니라 현재 교사의 소속 학교에도 묶습니다.

create or replace function public.delete_pe_lesson(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.pe_lessons pl
    join public.lesson_teachers lt on lt.lesson_id = pl.id
    join public.teacher_profiles tp on tp.auth_user_id = lt.teacher_id
    where pl.id = p_id
      and lt.teacher_id = auth.uid()
      and tp.auth_user_id = auth.uid()
      and tp.verified = true
      and tp.school_id = pl.school_id
  ) then
    raise exception 'DELETE_FORBIDDEN';
  end if;

  delete from public.pe_lessons pl
  where pl.id = p_id
    and pl.school_id = (
      select tp.school_id
      from public.teacher_profiles tp
      where tp.auth_user_id = auth.uid()
        and tp.verified = true
    );
end;
$$;

revoke execute on function public.delete_pe_lesson(uuid) from public, anon, authenticated;
grant execute on function public.delete_pe_lesson(uuid) to authenticated;
