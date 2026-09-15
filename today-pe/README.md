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

## 현재 구현

- 학생 / 교사 포털 완전 분리
- 학생 로그인 없음, 학교·학년·반만 로컬 저장
- 오늘 체육 / 주간 안내 / 최근 변경 알림
- `체육 없음` / `체육 있음·안내 미등록` / `안내 등록됨` 상태 구분
- 학생 자동 갱신 + 오프라인 fallback
- Supabase Auth 교사 로그인
- 최초 관리자 운영자 승인 / 추가 교사 학교 관리자 승인
- 승인된 일반 교사 권한 회수 + 열린 탭 재검증
- 교사 계정의 학교 소속 변경 잠금
- 여러 체육교사 / 공동 담당 / 변경 이력
- 컴시간 담당교사 이름 별칭 매핑
- 학교 위치 기반 현재 날씨 / 교시별 예보 / 우천 주의
- Supabase Realtime
- PWA 설치 / Web Push / Push 켜기·끄기
- 학생 교사정보 최소화
- Playwright Chromium 핵심 E2E
- 별도 API 정책 단위테스트 CI

## 시간표

```text
1. 컴시간알리미(parse-comcigan)
2. 실패 시 NEIS
3. 로컬 정적 개발 환경에서는 브라우저 NEIS 직접 fallback
```

서버 `/api/timetable`은 날짜·학교명·지역·학교코드 입력을 먼저 검증합니다. 컴시간 학교 검색에서 정확한 학교명이 없으면 임의의 첫 결과를 사용하지 않고 NEIS fallback으로 넘어갑니다.

학교 전체 반 조회는 외부 서비스에 과도한 동시 요청을 보내지 않도록 **최대 4개 동시 처리**로 제한합니다.

### 컴시간 이름 매칭

컴시간 담당교사명이 로그인 이름과 다르면 교사 화면의 **컴시간 이름 매칭 설정**에서 별칭을 등록합니다.

```text
로그인 이름: 김체육
컴시간 표시: 김OO
→ 별칭: 김OO
→ 내 시간표 필터 정상 인식
```

별칭은 본인만 관리할 수 있고 같은 학교 다른 교사의 이름/별칭과 충돌할 수 없습니다.

## 권한 구조

```text
학생
- 로그인 없음
- 학생 읽기 RPC만 호출
- 관리 테이블 직접 접근 불가

체육교사
- Supabase Auth
- verified=true 이후 교사 포털 접근
- 담당/공동담당 수업 관리
- 최초 등록 학교를 스스로 변경할 수 없음

학교 관리자
- 같은 학교 승인 대기 교사 승인
- 승인된 일반 교사 권한 회수
- 다른 school_admin 권한 변경 불가
- 공동 담당 관리

최초 학교 관리자
- 첫 가입자가 자동 관리자가 되지 않음
- 운영자가 service-role 전용 RPC로 지정
```

최초 관리자 승격:

```text
operator_promote_school_admin(uuid)
```

승인 대기 교사는 `get_my_teacher_approval_context()`로 승인 경로를 확인합니다.

```text
approvalRoute=operator     → 아직 학교 관리자 없음, 운영자 승인 필요
approvalRoute=school_admin → 기존 학교 관리자 승인 필요
approvalRoute=approved     → 승인 완료
```

### 학교 소속 잠금 / 등록 메타데이터 보호

기존 교사 계정이 다른 학교를 선택하면:

```text
SCHOOL_CHANGE_REQUIRES_OPERATOR
```

를 반환하고 기존 `school_id`, `role`, `verified`를 유지합니다. 같은 학교 재로그인에서는 표시 이름만 갱신할 수 있습니다.

019 마이그레이션 이후 `register_teacher_profile`은 기존 `schools` 행의 학교명·지역·주소를 클라이언트 입력으로 덮어쓰지 않으며 교사명과 학교코드 형식/길이도 DB에서 검증합니다.

실제 전학·전근·오등록 정정은 운영자 절차로 처리합니다.

### 교사 권한 회수

학교 관리자는 승인된 **일반 교사**의 접근 권한을 회수할 수 있습니다.

```text
revoke_teacher_access(uuid)
```

동작:

```text
대상 교사 verified=false
→ 컴시간 별칭 제거
→ lesson_teachers에서 대상 교사 연결 제거
→ 단독 담당 수업은 현재 학교 관리자에게 자동 인계
```

보호 규칙:

```text
자기 자신의 권한 회수 불가
다른 school_admin 권한 회수 불가
다른 학교 교사 권한 회수 불가
```

열린 교사 탭도 약 60초마다, 앱 재진입 시, 온라인 복구 시 `teacher-session-guard.js`가 권한을 다시 확인합니다. 핵심 교사용 RPC 역시 호출마다 `verified=true`를 재검사합니다.

### 수업 삭제 방어

`delete_pe_lesson`은 현재 교사가 승인된 담당교사인지와 함께 `teacher_profiles.school_id = pe_lessons.school_id`를 확인합니다.

## 학생 개인정보 최소화

학생에게 교사 개인 식별정보가 필요하지 않으므로 학생 데이터 경계에서 제거합니다.

- `get_student_lessons`: 교사 ID/이름 미반환
- `get_student_notifications`: 변경 교사 이름 미반환
- `student-privacy.js`: 로컬 데모 데이터도 익명화
- 익명화 후 `student-resilience.js`가 오프라인 캐시 저장
- 학생 UI는 일반 표현 `체육교사` 사용

## Web Push 보안 경계

### 학생 구독

```text
학생 브라우저
→ 교육청 코드 + 학교 코드 + 학년/반 + PushSubscription만 전송
→ 서버가 NEIS에서 학교를 다시 확인
→ canonical 학교 정보로만 schools 저장/갱신
```

클라이언트가 보낸 학교명·주소는 DB에 쓰지 않습니다. 구독 해제는 `endpoint`뿐 아니라 해당 PushSubscription의 `auth` 키도 함께 일치해야 합니다.

학생은 앱에서 Push를 켜고 끌 수 있습니다. 명시적으로 끄면 다음 접속에서 자동 재구독하지 않으며 페이지가 열린 상태의 로컬 변경 알림도 중단됩니다.

학교/반을 바꿀 때 기존 반 Push 구독을 먼저 해제하고, 새 반 저장 후 사용자가 Push를 켜둔 상태라면 자동으로 새 반에 다시 연결합니다.

### 교사 발송

```text
교사 수업 저장/삭제 성공
→ 실제 lessonId로 /api/push/send 호출
→ Supabase JWT 검증
→ teacher_profiles.verified 확인
→ 최근 실제 lesson_changes에서 같은 변경자/학교/수업인지 확인
→ 등록/수정은 lesson_teachers 담당 연결 재확인
→ 변경이력 snapshot으로 대상 반과 알림 문구 생성
```

클라이언트의 임의 제목·본문·학년·반은 Push 내용/대상을 결정하는 근거로 사용하지 않습니다.

`lesson_changes.push_claimed_at / push_sent_at`으로 같은 변경을 중복 발송하지 않습니다. 서버 처리 실패 시 claim을 해제해 재시도할 수 있습니다. 수정으로 대상 반이 바뀌면 기존 반과 새 반을 모두 계산합니다.

VAPID는 `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, 유효한 `VAPID_SUBJECT`가 모두 있어야 준비 완료로 판단합니다.

## Supabase 마이그레이션

실제 `oneul-pe` 프로젝트에는 **001~019**가 적용되어 있습니다.

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
012_teacher_approval_context
013_teacher_access_revocation
014_protect_school_admin_revocation
015_lock_teacher_school_membership
016_scope_lesson_delete_to_school
017_push_delivery_idempotency
018_remove_redundant_push_index
019_harden_teacher_registration_metadata
```

새 프로젝트에서도 위 순서대로 `schema.sql` 다음 002~019 SQL을 적용합니다.

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

`pe_lessons`는 Supabase Realtime publication에 등록되어 있고, 동일 학교·날짜·학년·반·교시 슬롯은 DB UNIQUE 제약으로 중복 등록되지 않습니다.

## 배포

Vercel Root Directory는 **저장소 루트 `/`**여야 합니다. `today-pe`만 Root로 잡으면 `/api/*`와 `vercel.json`이 제외됩니다.

```text
/              → /today-pe/index.html
/student       → /today-pe/student.html
/teacher       → /today-pe/teacher.html
/teacher/login → /today-pe/teacher-login.html
```

공개 가능 설정:

```text
SUPABASE_URL
SUPABASE_ANON_KEY 또는 publishable key
VAPID_PUBLIC_KEY
```

서버 전용 비밀:

```text
SUPABASE_SERVICE_ROLE_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
NEIS_API_KEY
```

`/api/public-config`는 실제 환경변수가 있을 때만 `config.js`의 공개 fallback을 override합니다.

상태 확인:

```text
GET /api/health
```

- `readyForCore`: Supabase 공개 설정 준비
- `readyForPush`: service-role + VAPID public/private + 유효한 VAPID subject 준비

## PWA / 오프라인

현재 서비스워커 캐시는 `oneul-pe-v12`입니다.

- HTML navigation: network-first
- JavaScript / CSS / manifest: network-first
- 기타 정적 자산: cache-first + background refresh
- `/api/*`: 서비스워커가 가로채지 않음

따라서 온라인에서는 최신 앱 코드가 우선 적용되고, 네트워크 장애 시에만 캐시된 앱 코드로 fallback합니다. 학생 안내/알림은 최대 7일, 당일 시간표는 최대 8시간의 제한적 오프라인 fallback을 사용하며 교사 식별정보 제거 후 저장됩니다.

## 자동 검증

두 GitHub Actions workflow를 사용합니다.

### Validate 오늘체육 MVP

```text
JS 문법
HTML ↔ JS 구조
001~019 필수 마이그레이션
Auth / 관리자 / 학교 소속 / 삭제 권한 경계
학생 개인정보 최소화
PWA network-first / Push wiring
API 정책 단위테스트
컴시간 → NEIS 우선순위 + bounded concurrency
정적 smoke
Playwright Chromium E2E
실제 컴시간/NEIS 학교 검색
```

### Validate 오늘체육 API Policies

Playwright 설치 없이 빠르게 다음 정책을 실행 검증합니다.

```text
/api/health readiness + VAPID subject
Push 대상 계산 / 반 이동
/api/timetable 입력 검증
/api/schools 입력 검증
교사 등록 메타데이터 보호
```

Playwright는 `/api/public-config`를 빈 설정으로 mock하여 로컬 데모 모드로 실행하므로 실제 Supabase DB를 오염시키지 않습니다.

## 현재 남은 외부 작업

```text
1. Vercel 실제 Preview/Production 배포
2. 서버 전용 환경변수 등록
3. 최초 실제 교사 가입 → 운영자 최초 관리자 승인
4. 교사/학생 서로 다른 기기에서 공유 검증
5. 실제 Web Push 수신/해제/반 변경 검증
```

자세한 순서는 `DEPLOY.md`를 참고합니다.
