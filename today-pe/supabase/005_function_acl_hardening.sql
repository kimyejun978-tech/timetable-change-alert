-- 오늘체육 RPC ACL 하드닝
-- SECURITY DEFINER 함수의 기본 PUBLIC EXECUTE 권한을 제거하고 필요한 역할만 다시 허용합니다.

-- 앞으로 public 스키마에 postgres 역할로 생성되는 함수가 자동 공개되지 않도록 기본 권한을 줄입니다.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- 기존 함수 권한을 먼저 모두 닫습니다.
revoke execute on function public.get_my_teacher_profile() from public, anon, authenticated;
revoke execute on function public.register_teacher_profile(text,text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.get_student_lessons(text,text,integer,integer,date,date) from public, anon, authenticated;
revoke execute on function public.get_teacher_lessons(date,date) from public, anon, authenticated;
revoke execute on function public.save_pe_lesson(uuid,date,integer,integer,integer,text,text,text[],text) from public, anon, authenticated;
revoke execute on function public.delete_pe_lesson(uuid) from public, anon, authenticated;
revoke execute on function public.get_pending_teachers() from public, anon, authenticated;
revoke execute on function public.approve_teacher(uuid) from public, anon, authenticated;
revoke execute on function public.get_school_teachers() from public, anon, authenticated;
revoke execute on function public.set_lesson_teachers(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.get_lesson_history(uuid) from public, anon, authenticated;
revoke execute on function public.get_student_notifications(text,text,integer,integer,timestamptz) from public, anon, authenticated;

-- 학생이 로그인 없이 호출해야 하는 읽기 전용 RPC만 anon 허용
grant execute on function public.get_student_lessons(text,text,integer,integer,date,date) to anon, authenticated;
grant execute on function public.get_student_notifications(text,text,integer,integer,timestamptz) to anon, authenticated;

-- 교사 전용 RPC
grant execute on function public.get_my_teacher_profile() to authenticated;
grant execute on function public.register_teacher_profile(text,text,text,text,text,text) to authenticated;
grant execute on function public.get_teacher_lessons(date,date) to authenticated;
grant execute on function public.save_pe_lesson(uuid,date,integer,integer,integer,text,text,text[],text) to authenticated;
grant execute on function public.delete_pe_lesson(uuid) to authenticated;
grant execute on function public.get_pending_teachers() to authenticated;
grant execute on function public.approve_teacher(uuid) to authenticated;
grant execute on function public.get_school_teachers() to authenticated;
grant execute on function public.set_lesson_teachers(uuid, uuid[]) to authenticated;
grant execute on function public.get_lesson_history(uuid) to authenticated;
