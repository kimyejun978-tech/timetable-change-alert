-- Web Push는 하나의 lesson_changes 레코드당 한 번만 발송하도록 상태를 기록합니다.
-- push_claimed_at은 동시 요청 중복 발송을 막고, 오래된 claim은 API에서 재시도할 수 있습니다.

alter table public.lesson_changes
  add column if not exists push_claimed_at timestamptz,
  add column if not exists push_sent_at timestamptz;

create index if not exists idx_lesson_changes_push_delivery
  on public.lesson_changes (id, push_sent_at, push_claimed_at);

comment on column public.lesson_changes.push_claimed_at is
  'Web Push 발송 작업이 처리권을 획득한 시각. service-role 서버만 갱신합니다.';

comment on column public.lesson_changes.push_sent_at is
  '해당 변경에 대한 Web Push 발송이 완료된 시각. service-role 서버만 갱신합니다.';
