-- 교사 대시보드에서 pe_lessons 변경을 실시간 수신하도록 publication에 등록합니다.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pe_lessons'
  ) then
    alter publication supabase_realtime add table public.pe_lessons;
  end if;
end $$;
