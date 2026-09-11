# 오늘체육

체육 선생님이 수업의 실제 종목·장소·준비물을 등록하면 학생이 웹/PWA에서 바로 확인하는 학교 체육수업 안내 서비스입니다.

## 현재 구현

- 학생 / 교사 포털 완전 분리
- NEIS 학교기본정보 API로 전국 학교 검색
- 시간표: **컴시간알리미 1순위 → NEIS fallback**
- 학생: 학교·학년·반 저장, 오늘 체육, 주간 안내
- 학생: `오늘 체육 없음` / `체육 있음·안내 미등록` / `안내 등록됨` 구분
- 학생: 최근 14일 변경 알림함, 안 읽은 알림 표시
- 교사: 별도 인증, 승인 전 교사용 화면 접근 차단
- 여러 체육교사 지원 및 학교 관리자 승인
- 공동 담당 교사 지정
- 수업별 변경 이력
- 학교 위치 기반 현재 날씨 + 교시별 기온/강수확률
- 야외수업 우천 경고
- PWA 설치 지원
- 브라우저 알림 및 Web Push 코드 경로 구현
- Supabase 연결 전에는 LocalStorage 데모 모드 자동 fallback

## 시간표

### 1순위: 컴시간알리미

`api/timetable.js`가 서버에서 `parse-comcigan`을 이용해 컴시간 데이터를 읽습니다. 컴시간 파서는 HTTP 엔드포인트를 사용하므로 HTTPS 프론트에서 직접 긁지 않고 서버리스 함수가 중계합니다.

### 2순위: NEIS

컴시간에서 학교를 찾지 못하거나 조회에 실패하면 NEIS 고등학교 시간표 API로 자동 전환합니다. 정적 Live Server처럼 `/api/timetable`이 없는 환경에서는 브라우저 NEIS 직접 fallback을 사용합니다.

## 권한 구조

```text
학생
- 로그인 없이 학교/학년/반 설정
- 자기 반 수업/변경 알림 조회만 가능
- 교사용 등록·수정·삭제 불가

체육교사
- Supabase Auth 로그인
- 학교 관리자 승인 필요
- 자기 학교 전체 안내 조회
- 자신이 담당인 수업 등록/수정/삭제
- 공동 담당 교사 지정 가능

학교 관리자
- 첫 번째 가입 교사
- 교사 승인
- 같은 학교 공동 담당 관리
```

학생은 `pe_lessons` 같은 테이블에 직접 쓰지 않고 SECURITY DEFINER RPC로 필요한 데이터만 읽도록 구성했습니다.

## DB / 마이그레이션

Supabase SQL Editor에서 아래 순서대로 실행합니다.

```text
1. today-pe/supabase/schema.sql
2. today-pe/supabase/002_teacher_realtime.sql
3. today-pe/supabase/003_collaboration_history_notifications.sql
4. today-pe/supabase/004_push_subscriptions.sql
```

주요 테이블:

```text
schools
teacher_profiles
pe_lessons
lesson_teachers
lesson_changes
push_subscriptions
```

`lesson_teachers`는 한 수업을 여러 교사가 공동 담당할 수 있게 하고, `lesson_changes`는 등록/수정/삭제 및 공동 담당 변경을 기록합니다.

## 프론트 설정

`today-pe/config.js`:

```js
window.ONEUL_PE_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_PUBLISHABLE_OR_ANON_KEY',
  VAPID_PUBLIC_KEY: 'YOUR_VAPID_PUBLIC_KEY',
  NEIS_API_KEY: '',
};
```

브라우저에 넣어도 되는 것은 **Supabase publishable/anon key와 VAPID public key뿐**입니다.

`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`는 절대로 `config.js`나 GitHub 소스에 넣지 않습니다.

## 서버 환경변수

Vercel 등 배포 환경에 다음 값을 Secret/Environment Variable로 설정합니다.

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

`VAPID_SUBJECT`는 예를 들어 `mailto:관리용이메일` 형태입니다.

## Web Push 흐름

```text
학생
→ 알림 켜기
→ 서비스워커 PushManager 구독
→ POST /api/push/subscribe
→ push_subscriptions에 학교/학년/반과 구독 저장

교사
→ 수업 등록/수정/삭제
→ Supabase RPC 성공
→ push-client.js가 변경 감지
→ POST /api/push/send + 교사 Bearer 토큰
→ 서버에서 승인된 교사/학교 검증
→ 해당 학교·학년·반 학생에게만 Web Push
```

삭제 알림은 `lesson_changes`의 삭제 전 스냅샷을 이용해 원래 학년·반을 복원합니다.

Web Push 서버 설정이 아직 없더라도 학생 화면의 알림함과 페이지가 열린 동안의 브라우저 로컬 알림은 사용할 수 있습니다.

## PWA

- `manifest.webmanifest`
- `sw.js`
- `icon.svg`
- `pwa.js`

HTTPS 배포 환경에서 설치 가능한 웹앱으로 동작합니다. 서비스워커는 정적 UI를 캐시하고 `/api/` 요청은 캐시하지 않습니다.

## 학생 화면 흐름

```text
학교 검색
→ 학년/반 선택
→ 컴시간 우선으로 오늘 체육 여부 확인
→ 교사 안내 DB 조회
→ 안내와 실제 시간표 결합
→ 변경 알림함 / Web Push 확인
```

## 교사 화면 흐름

```text
교사 로그인
→ 학교 위치·날씨
→ 컴시간 기준 오늘 전체 체육 시간표
→ 시간별 날씨
→ 안내 등록
→ 공동 담당 교사 선택
→ 변경 이력 기록
→ 학생 화면 공유 + 해당 반 Push
```

## 아직 실제 환경에서 필요한 것

코드와 CI 구조는 준비되어 있지만 다음은 실제 프로젝트 자격증명이 있어야 E2E 확인할 수 있습니다.

- Supabase 실제 프로젝트 연결
- 위 4개 SQL 적용
- Vercel 등 HTTPS 배포
- VAPID 키 및 서버 환경변수 등록
- 학생 기기 Push 구독 → 교사 변경 → 실제 푸시 수신 테스트

## 로컬 실행

정적 UI/LocalStorage 데모:

```text
Live Server → today-pe/index.html
```

컴시간 서버리스와 실제 Web Push까지 확인하려면 Vercel 같은 Node 서버리스 + HTTPS 환경이 필요합니다.
