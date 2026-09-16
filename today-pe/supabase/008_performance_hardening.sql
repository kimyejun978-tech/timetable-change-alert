-- FK lookup 최적화
create index if not exists teacher_profiles_school_id_idx
  on public.teacher_profiles (school_id);
create index if not exists pe_lessons_created_by_idx
  on public.pe_lessons (created_by);
create index if not exists lesson_teachers_teacher_id_idx
  on public.lesson_teachers (teacher_id);
create index if not exists lesson_changes_changed_by_idx
  on public.lesson_changes (changed_by);

-- auth.uid()를 initplan으로 한 번만 평가하도록 최적화
drop policy if exists "verified teachers can observe own school lessons" on public.pe_lessons;
create policy "verified teachers can observe own school lessons"
on public.pe_lessons
for select
to authenticated
using (
  exists (
    select 1
    from public.teacher_profiles tp
    where tp.auth_user_id = (select auth.uid())
      and tp.verified = true
      and tp.school_id = pe_lessons.school_id
  )
);
