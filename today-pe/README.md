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

## 구현 상태

- 학생 / 교사 포털 완전 분리
- 학생 로그인 없음, 학교·학년·반만 저장
- 오늘 체육 / 주간 안내 / 최근 변경 알림
- `체육 없음` / `체육 있음·안내 미등록` / `안내 등록됨` 구분
- 학생 자동 갱신 + 오프라인 fallback
- Supabase Auth 교사 로그인
- 승인 대기 / 학교 관리자 승인 / 최초 관리자 운영자 승인
- 여러 체육교사 + 공동 담당 + 변경 이력
- 컴시간 담당교사 이름 별칭 매핑
- 학교 위치 기반 현재 날씨 + 교시별 예보 + 우천 주의
- Supabase Realtime
- PWA / Web Push 경로
- 학생 교사정보 최소화
- Playwright Chromium 핵심 E2E

## 시간표

```text
1. 컴시간알리미(parse-comcigan)
2. 실패 시 NEIS
3. 정적 개발 환경에서는 브라우저 NEIS 직접 fallback
```

교사 화면의 `현재 데이터` 배지에서 실제 공급원을 확인할 수 있습니다.

### 컴시간 이름 매칭

컴시간 담당교사명이 로그인 이름과 다르면 **컴시간 이름 매칭 설정**에 별칭을 등록합니다.

```text
로그인 이름: 김체육
컴시간 표시: 김OO
→ 별칭: 김OO
→ 내 시간표 필터 정상 인식
```

별칭은 본인만 관리할 수 있고, 같은 학교 다른 교사의 이름/별칭과 충돌할 수 없습니다.

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

학교 관리자
- 같은 학교 승인 대기 교사 승인
- 공동 담당 관리

최초 학교 관리자
- 첫 가입자가 자동 관리자가 되지 않음
- 운영자가 service-role 전용 RPC로 지정
```

최초 관리자 승격:

```text
operator_promote_school_admin(uuid)
```

승인 대기 교사는 `get_my_teacher_approval_context()`로 현재 승인 경로를 확인합니다.

```text
approvalRoute=operator     → 아직 학교 관리자 없음, 운영자 승인 필요
approvalRoute=school_admin → 기존 학교 관리자 승인 필요
approvalRoute=approved     → 승인 완료
```

## 학생 개인정보 최소화

학생에게 교사 개인 식별정보가 필요하지 않아 학생용 데이터 경계에서 제거합니다.

- `get_student_lessons`: 교사 ID/이름 미반환
- `get_student_notifications`: 변경 교사 이름 미반환
- `student-privacy.js`: 로컬 데모 데이터도 익명화
- 익명화 후 `student-resilience.js`가 오프라인 캐시 저장
- 학생 UI는 일반 표현 `체육교사` 사용

## Supabase 마이그레이션

실제 `oneul-pe` 프로젝트에 다음 마이그레이션이 적용되어 있습니다.

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
```

새 프로젝트 적용 순서:

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
12. supabase/012_teacher_approval_context.sql
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

Vercel Root Directory는 **저장소 루트 `/`**여야 합니다. `today-pe` 폴더만 Root로 지정하면 `/api/*`와 `vercel.json`이 빠집니다.

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

`/api/public-config`는 실제 환경변수가 존재할 때만 `config.js`의 공개 fallback을 override합니다.

상태 확인:

```text
GET /api/health
```

`readyForCore`는 Supabase 공개 설정이 준비되면 true, `readyForPush`는 service-role + VAPID까지 준비되어야 true입니다.

## PWA / 오프라인

- `manifest.webmanifest`
- `sw.js`
- `pwa.js`
- `student-privacy.js`
- `student-resilience.js`

학생 안내/알림은 최대 7일, 당일 시간표는 최대 8시간 제한적 fallback 캐시를 사용하며 교사 식별정보 제거 후 캐시됩니다.

## 자동 검증

GitHub Actions는 아래를 확인합니다.

```text
JS 문법
HTML ↔ JS 연결
Auth / RLS / 최초 관리자 bootstrap
교사 승인 경로
공동 담당 / 변경 이력 / 학생 알림
컴시간 교사명 별칭
학생 개인정보 최소화
PWA / Web Push wiring
배포 config fallback / health
컴시간 → NEIS 우선순위
정적 smoke
Playwright Chromium E2E
실제 컴시간/NEIS 학교 검색
```

Playwright는 `/api/public-config`를 빈 설정으로 mock해 로컬 데모 모드로 실행하므로 실제 Supabase DB를 오염시키지 않습니다.

## 남은 외부 작업

```text
1. Vercel 실제 Preview/Production 배포
2. 서버 전용 환경변수 등록
3. 최초 실제 교사 가입 → 운영자 최초 관리자 승인
4. 교사/학생 서로 다른 기기에서 공유 검증
5. 실제 Web Push 수신 검증
```

자세한 순서는 `DEPLOY.md`를 참고합니다.
