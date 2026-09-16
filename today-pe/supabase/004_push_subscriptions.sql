-- 오늘체육 학생 Web Push 구독 저장소
-- service_role을 사용하는 서버리스 API만 직접 접근합니다.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade smallint not null check (grade between 1 and 6),
  class_number smallint not null check (class_number between 1 and 50),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_target_idx
  on public.push_subscriptions (school_id, grade, class_number);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- 브라우저 클라이언트에는 어떤 policy도 만들지 않습니다.
-- 구독 등록/삭제/발송은 Vercel 서버리스 함수가 service_role로 처리합니다.
