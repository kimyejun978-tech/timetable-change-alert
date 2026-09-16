-- lesson_changes.id는 이미 기본키 인덱스가 있으므로
-- (id, push_sent_at, push_claimed_at) 인덱스는 중복입니다.

drop index if exists public.idx_lesson_changes_push_delivery;
