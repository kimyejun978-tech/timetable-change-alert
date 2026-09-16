# 오늘체육 실서비스 배포 체크리스트

## 1. Supabase

현재 `oneul-pe` 실제 프로젝트에는 **001~019** 마이그레이션이 적용되어 있습니다.

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
13. supabase/013_teacher_access_revocation.sql
14. supabase/014_protect_school_admin_revocation.sql
15. supabase/015_lock_teacher_school_membership.sql
16. supabase/016_scope_lesson_delete_to_school.sql
17. supabase/017_push_delivery_idempotency.sql
18. supabase/018_remove_redundant_push_index.sql
19. supabase/019_harden_teacher_registration_metadata.sql
```

확인할 권한/무결성:

```text
관리 테이블 RLS 활성화
학생 관리 테이블 직접 접근 불가
학생 읽기 RPC만 anon 허용
교사 RPC authenticated 전용
operator_promote_school_admin service_role 전용
revoke_teacher_access 함수 내부 school_admin 검사
다른 school_admin 회수 차단
기존 교사의 학교 소속 변경 차단
기존 schools 메타데이터를 교사 가입 RPC가 덮어쓰지 않음
delete_pe_lesson = verified 담당교사 + 동일 school_id
lesson_changes에 push_claimed_at / push_sent_at 존재
pe_lessons Realtime publication 포함
```

## 2. 환경변수

공개 가능:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
VAPID_PUBLIC_KEY
```

서버 전용:

```text
SUPABASE_SERVICE_ROLE_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
NEIS_API_KEY
```

`VAPID_SUBJECT`는 `mailto:실제연락주소` 또는 HTTPS URL 형식이어야 합니다.

## 3. Vercel Import

저장소:

```text
kimyejun978-tech/timetable-change-alert
```

반드시:

```text
Root Directory = /
```

`today-pe`만 Root로 지정하면 루트 `/api/*`와 `vercel.json`이 빠집니다.

## 4. 배포 직후 상태 확인

```text
GET /
GET /student
GET /teacher/login
GET /api/health
GET /api/schools?q=대덕소프트웨어마이스터고
GET /api/timetable?schoolName=대덕소프트웨어마이스터고&region=대전광역시&officeCode=G10&schoolCode=<학교코드>&date=YYYYMMDD
```

기대:

```json
{ "readyForCore": true }
```

Push까지 준비되면:

```json
{ "readyForPush": true }
```

`readyForPush`는 service-role + VAPID public/private + 유효한 VAPID subject가 모두 있어야 true입니다.

## 5. 최초 교사 / 관리자

실서비스에서는 첫 가입자가 자동 관리자가 되지 않습니다.

```text
신규 교사 가입
→ verified=false
→ get_my_teacher_approval_context()
→ approvalRoute=operator
→ 운영자가 service-role 전용 RPC로 최초 관리자 승격
```

```text
operator_promote_school_admin(<teacher auth user uuid>)
```

추가 교사:

```text
같은 학교 다른 이메일 가입
→ approvalRoute=school_admin
→ 기존 학교 관리자가 승인
→ 로그인 성공
```

## 6. 교사 보안 테스트

### 학교 소속 잠금

이미 학교 A에 등록된 같은 계정으로 학교 B를 선택합니다.

기대:

```text
SCHOOL_CHANGE_REQUIRES_OPERATOR
기존 school_id 유지
기존 role 유지
기존 verified 유지
```

같은 학교로 재로그인할 때 표시 이름만 갱신할 수 있습니다.

### 등록 메타데이터 보호

같은 학교코드로 다른 학교명/주소를 클라이언트에서 보내도 기존 `schools` 행이 변경되지 않아야 합니다.

### 권한 회수

학교 관리자가 승인된 일반 교사의 권한을 회수합니다.

```text
verified=false
컴시간 별칭 제거
담당/공동담당 연결 제거
단독 담당 수업은 현재 관리자에게 인계
핵심 RPC 즉시 차단
열린 탭은 최대 약 60초/재진입/온라인 복구 시 로그인 화면 이동
```

보호 규칙:

```text
자기 자신 회수 불가
다른 school_admin 회수 불가
다른 학교 교사 회수 불가
```

### 수업 삭제

```text
담당교사 아님 → DELETE_FORBIDDEN
verified=false → DELETE_FORBIDDEN
학교 불일치 → DELETE_FORBIDDEN
동일 학교 + 승인된 담당교사 → 삭제 허용
```

## 7. 학생 테스트

```text
/student
→ 학교 검색
→ 학년/반 저장
→ 컴시간 기준 체육 여부 확인
→ 교사 안내 반영 확인
```

학생 수업/알림 응답과 오프라인 캐시에 교사 개인 이름/ID가 없어야 합니다.

## 8. 컴시간 / NEIS 테스트

```text
컴시간알리미 정확한 학교명 매칭
→ 실패/미일치 시 NEIS fallback
```

확인:

```text
잘못된 날짜 → 400
너무 긴 학교명/지역 → 400
학교 검색어 2자 미만 또는 100자 초과 → 400
컴시간 학급 조회는 최대 동시 4개
```

컴시간 담당교사명과 로그인 이름이 다르면 **컴시간 이름 매칭 설정**에서 별칭을 등록합니다.

## 9. 날씨 / Realtime

교사 화면에서 학교 주소, 현재 날씨, 교시별 예보, 우천 주의를 확인합니다.

교사 A/B 화면을 동시에 열고 한쪽이 수업을 변경했을 때 다른 화면이 Realtime으로 갱신되는지 확인합니다.

## 10. Web Push

### VAPID 생성

```bash
npx web-push generate-vapid-keys
```

Private Key는 브라우저나 GitHub 소스에 넣지 않습니다.

### 학생 구독

```text
알림 켜기
→ PushManager 구독
→ /api/push/subscribe
→ 서버가 교육청코드/학교코드를 NEIS에서 재검증
→ canonical 학교 정보로 구독 저장
```

확인:

```text
구독 해제 = endpoint + Push auth 키 일치 필요
푸시 끄기 후 자동 재구독 금지
푸시 끄기 후 페이지 로컬 알림도 중단
학교/반 변경 시작 시 기존 반 구독 해제
새 반 저장 후 Push 사용 의사가 켜져 있으면 새 반 자동 재구독
```

### 교사 발송

```text
수업 등록/수정/삭제 성공
→ 실제 lessonId로 /api/push/send
→ JWT + verified 검사
→ 최근 실제 lesson_changes의 changed_by/school/lesson 확인
→ 등록·수정은 lesson_teachers 담당 연결 재확인
→ DB snapshot으로 대상 반/문구 생성
→ push claim
→ 발송
→ push_sent_at 기록
```

확인:

```text
클라이언트 임의 grade/class/title/body 무시
같은 변경 반복 발송 차단
수정으로 반이 바뀌면 기존 반 + 새 반 대상 계산
서버 처리 실패 시 claim 해제 후 재시도 가능
```

## 11. PWA / 오프라인

현재 서비스워커 캐시는 `oneul-pe-v12`입니다.

정책:

```text
HTML navigation = network-first
JavaScript / CSS / manifest = network-first
기타 정적 자산 = cache-first + background refresh
/api/* = 서비스워커 미개입
```

온라인에서 학생 화면을 한 번 연 뒤 네트워크를 끄고 확인합니다.

```text
PWA UI 로딩
익명화된 최근 안내/알림 fallback
유효한 당일 시간표 캐시
오프라인 저장본 표시
```

## 12. 자동 검증

### Validate 오늘체육 MVP

```text
JS 문법
HTML ↔ JS
001~019 필수 마이그레이션
교사/관리자/학교 소속/삭제 권한 경계
학생 개인정보 최소화
PWA network-first / Push wiring
API 정책 테스트
컴시간 → NEIS + bounded concurrency
정적 smoke
Playwright Chromium E2E
실제 컴시간/NEIS 검색
```

### Validate 오늘체육 API Policies

빠른 실행 테스트:

```text
교사 등록 메타데이터 보호
health/VAPID readiness
Push 대상 계산/반 이동
시간표 API 입력 검증
학교 검색 API 입력 검증
```

`2026-09-15` 기준 feature branch 최신 검증에서 두 workflow 모두 성공했습니다.

```text
Validate 오늘체육 MVP           ✅ success
Validate 오늘체육 API Policies  ✅ success
```

Playwright는 `/api/public-config`를 빈 설정으로 mock해 로컬 데모 모드에서 실행하므로 실제 Supabase DB를 오염시키지 않습니다.

## 13. 실기기 최종 E2E

최소 학생 기기 1대 + 교사 기기 1대로 확인합니다.

```text
1. 학생 학교/반 설정
2. 교사 가입/승인
3. 수업 등록
4. 학생 반영
5. 수업 수정
6. Realtime 반영
7. Web Push 수신
8. Push 끄기/켜기
9. 학생 반 변경 후 구독 대상 변경
10. 수업 삭제 알림
11. 오프라인 fallback
```

## 14. 대회 데모 순서

```text
1. 학생: 학교/반 설정
2. 컴시간 체육 교시 자동 확인
3. 안내 미등록 상태
4. 교사: 날씨 + 전체 체육 시간표
5. 종목/장소/준비물 등록
6. 학생 반영
7. 우천 상황
8. 장소/종목 변경
9. 학생 변경 알림 / Push
10. 공동 담당 / 컴시간 별칭
11. 개인정보 최소화
12. 관리자 승인 / 권한 회수 / 학교 소속 잠금
```
