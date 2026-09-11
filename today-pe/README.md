# 오늘체육

체육 선생님이 실제 수업의 종목·장소·준비물을 등록하면 학생이 웹/PWA에서 바로 확인하는 학교 체육수업 안내 서비스입니다.

## 핵심 흐름

```text
전국 학교 검색: NEIS
→ 오늘 실제 시간표: 컴시간알리미 1순위
→ 컴시간 실패: NEIS fallback
→ 체육 시간표만 추출
→ 교사: 종목·장소·준비물 등록/수정
→ 학생: 자기 학교·학년·반 안내 확인
```

교사 화면은 학교 위치 기반 날씨와 교시별 예보를 함께 보여주며, 야외수업의 강수 위험도 표시합니다.

## 현재 구현

- 학생 / 교사 포털 완전 분리
- 학생 로그인 없음, 학교·학년·반만 로컬 저장
- 학생: 오늘 체육 / 주간 안내 / 최근 변경 알림
- `오늘 체육 없음` / `체육 있음·안내 미등록` / `안내 등록됨` 구분
- 약 90초 자동 갱신 + 재진입/온라인 복구 시 최신화
- 오프라인 최근 저장본 fallback
- 교사: Supabase Auth
- 신규 교사 승인 대기
- 여러 체육교사 및 공동 담당
- 수업 등록 / 수정 / 삭제 / 여러 반 일괄 등록
- 수업 변경 이력
- 컴시간 담당교사 이름 별칭 매핑
- 학교 위치 기반 현재 날씨 + 교시별 날씨
- 우천 주의 필터
- PWA 설치
- Web Push 구독/발송 경로
- Supabase Realtime
- Playwright Chromium 학생↔교사 핵심 E2E

## 시간표

`api/timetable.js`의 공급원 우선순위는 아래와 같습니다.

```text
1. 컴시간알리미(parse-comcigan)
2. NEIS 고등학교 시간표
3. 정적 개발 환경에서는 브라우저 NEIS 직접 fallback
```

교사 화면의 `현재 데이터` 배지로 어떤 공급원을 사용했는지 확인할 수 있습니다.

### 컴시간 교사명 매핑

컴시간에 표시되는 담당교사명이 로그인 이름과 다르면 교사 화면의 **컴시간 이름 매칭 설정**에 별칭을 등록할 수 있습니다.

예:

```text
로그인 이름: 김체육
컴시간 표시: 김OO
→ 별칭에 김OO 등록
→ 내 시간표 필터에서 정상 인식
```

같은 학교의 다른 교사가 이미 사용하는 별칭이나 다른 교사의 실제 이름과 겹치는 값은 등록할 수 없습니다.

## 권한 구조

```text
학생
- 로그인 없음
- 학생용 읽기 RPC만 호출
- 관리 테이블 직접 SELECT/INSERT/UPDATE/DELETE 불가

체육교사
- Supabase Auth 로그인
- verified=true가 되어야 교사 포털 사용 가능
- 자기 학교 수업 조회
- 담당/공동담당 수업 관리

학교 관리자
- 같은 학교 승인 대기 교사 승인
- 공동 담당 관리

최초 학교 관리자
- 첫 가입자가 자동 관리자가 되지 않음
- 모든 신규 교사는 우선 승인 대기
- 운영자가 service-role 전용 RPC로 최초 관리자를 지정
```

최초 관리자 승격 RPC:

```text
operator_promote_school_admin(uuid)
```

이 함수는 `service_role`만 실행할 수 있습니다.

## 학생 개인정보 최소화

학생에게 교사 개인 식별정보가 필요하지 않으므로 학생용 데이터 경계에서 제거합니다.

- `get_student_lessons`: 교사 ID/이름 미반환
- `get_student_notifications`: 변경 교사 이름 미반환
- `student-privacy.js`: 로컬 데모 데이터도 익명화
- 익명화 이후 `student-resilience.js`가 오프라인 캐시 저장
- 학생 UI에는 개인 이름 대신 `체육교사`만 표시

## Supabase

실제 연결 프로젝트에 아래 마이그레이션이 적용되어 있습니다.

```text
001_initial_schema
002_teacher_realtime
003_collaboration_history_notifications
004_push_subscriptions
005_function_acl_hardening
006_enable_pe_lessons_realtime
007_lock_trigger_helper
008_performance_hardening
009_teacher_timetable_aliases
010_secure_initial_admin_bootstrap
011_student_privacy_minimization
```

새 프로젝트에 재적용할 때 저장소 파일 순서:

```text
1. supabase/schema.sql
2. supabase/002_teacher_realtime.sql
3. supabase/003_collaboration_history_notifications.sql
4. supabase/004_push_subscriptions.sql
5. supabase/005_function_acl_hardening.sql
6. supabase/006_enable_pe_lessons_realtime.sql
7. supabase/007_lock_trigger_helper.sql
8. supabase/008_performance_hardening.sql
9. supabase/009_teacher_timetable_aliases.sql
10. supabase/010_secure_initial_admin_bootstrap.sql
11. supabase/011_student_privacy_minimization.sql
```

주요 테이블:

```text
schools
teacher_profiles
pe_lessons
lesson_teachers
lesson_changes
push_subscriptions
teacher_timetable_aliases
```

`pe_lessons`는 Supabase Realtime publication에 등록되어 있습니다.

## 배포

저장소 루트에 `vercel.json`이 있으며 Root Directory는 **저장소 루트 `/`**여야 합니다.

```text
/              → /today-pe/index.html
/student       → /today-pe/student.html
/teacher       → /today-pe/teacher.html
/teacher/login → /today-pe/teacher-login.html
```

### 공개 가능 설정

```text
SUPABASE_URL
SUPABASE_ANON_KEY 또는 publishable key
VAPID_PUBLIC_KEY
```

`today-pe/config.js`에는 브라우저 공개용 Supabase fallback만 둘 수 있습니다. `/api/public-config`는 Vercel 환경변수가 실제로 설정된 값만 override하므로 빈 환경변수가 fallback을 지우지 않습니다.

### 서버 전용 비밀

```text
SUPABASE_SERVICE_ROLE_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
NEIS_API_KEY
```

서버 비밀은 GitHub와 브라우저 코드에 넣지 않습니다.

## 상태 확인

```text
GET /api/health
```

주요 필드:

```text
supabasePublic
supabasePublicEnv
supabasePublicFallback
supabaseServer
vapid
neis
readyForCore
readyForPush
```

`readyForCore`는 학생 조회와 교사 Auth/RPC에 사용할 공개 Supabase 설정이 준비되면 true입니다. `readyForPush`는 service-role과 VAPID까지 준비되어야 true입니다.

## PWA / 오프라인

- `manifest.webmanifest`
- `sw.js`
- `pwa.js`
- `student-resilience.js`
- `student-privacy.js`

학생 안내/알림은 최대 7일, 당일 시간표는 최대 8시간의 제한적 fallback 캐시를 사용합니다. 캐시에 저장되기 전에 교사 식별정보를 제거합니다.

## Web Push

```text
학생 알림 켜기
→ PushManager 구독
→ POST /api/push/subscribe
→ push_subscriptions 저장

교사 수업 등록/수정/삭제
→ 승인된 교사/학교 검증
→ POST /api/push/send
→ 해당 학교·학년·반 구독자만 Push
```

실제 Push 발송에는 Vercel의 `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY` 등 서버 환경변수가 필요합니다.

## 자동 검증

GitHub Actions `Validate 오늘체육 MVP`는 다음을 확인합니다.

```text
JavaScript 문법
HTML ↔ JS id 연결
교사 Auth / RLS / 최초 관리자 bootstrap
공동 담당 / 변경 이력 / 학생 알림
컴시간 교사명 별칭 매핑
학생 개인정보 최소화
PWA / Web Push wiring
배포 config fallback / health API
컴시간 → NEIS 우선순위
정적 smoke test
Playwright Chromium UI E2E
실제 컴시간 학교 검색
실제 NEIS 학교 검색
```

Playwright는 실제 Supabase 프로젝트를 오염시키지 않도록 `/api/public-config`를 빈 설정으로 가로채 **로컬 데모 모드**에서 실행합니다.

## 현재 남은 외부 작업

코드, 실제 Supabase DB, RLS/RPC, Realtime, CI는 연결된 상태입니다. 남은 핵심은 HTTPS 배포와 실기기 검증입니다.

```text
1. Vercel 프로젝트 Import/배포
2. 서버 전용 환경변수 등록
3. 최초 교사 가입 후 운영자 최초 관리자 승인
4. 교사 기기에서 수업 등록
5. 학생 기기에서 공유 확인
6. Web Push 실수신 확인
```

자세한 순서는 `DEPLOY.md`를 참고합니다.
