-- trigger 전용 SECURITY DEFINER 함수는 API로 직접 호출할 필요가 없습니다.
revoke execute on function public.log_pe_lesson_change()
from public, anon, authenticated;
