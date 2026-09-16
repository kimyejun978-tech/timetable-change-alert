-- 교사 대시보드 Realtime용 최소 SELECT 권한
-- 학생(anon)에게는 테이블 SELECT를 열지 않습니다.

grant select on public.pe_lessons to authenticated;

drop policy if exists "verified teachers can observe own school lessons" on public.pe_lessons;
create policy "verified teachers can observe own school lessons"
on public.pe_lessons
for select
to authenticated
using (
  exists (
    select 1
    from public.teacher_profiles tp
    where tp.auth_user_id = auth.uid()
      and tp.verified = true
      and tp.school_id = pe_lessons.school_id
  )
);

-- Supabase Dashboard > Database > Replication에서 pe_lessons를 켜세요.
-- 프로젝트에서 publication 수정 권한이 허용되면 아래를 한 번 실행할 수도 있습니다.
-- alter publication supabase_realtime add table public.pe_lessons;
