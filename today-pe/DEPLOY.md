# 오늘체육 실서비스 배포 체크리스트

## 1. Supabase

현재 `oneul-pe` 실제 프로젝트에는 001~016 마이그레이션이 적용되어 있습니다. 새 프로젝트에서는 아래 순서대로 적용합니다.

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
```

권한 확인:

```text
관리 테이블 RLS 활성화
학생 관리 테이블 직접 접근 불가
학생 읽기 RPC만 anon 허용
교사 RPC authenticated 전용
operator_promote_school_admin service_role 전용
get_my_teacher_approval_context authenticated 전용
revoke_teacher_access authenticated 전용 + 함수 내부 school_admin 검사
school_admin 대상 권한 회수는 CANNOT_REVOKE_ADMIN으로 차단
register_teacher_profile은 기존 계정의 school_id/role/verified 변경 불가
delete_pe_lesson은 승인된 담당교사 + 동일 school_id 모두 검사
pe_lessons Realtime publication 포함
```

## 2. 교사 Auth / 최초 관리자

실서비스에서는 첫 가입자가 자동 관리자가 되지 않습니다.

```text
신규 교사
→ verified=false
→ get_my_teacher_approval_context()
→ approvalRoute 판단
```

승인 경로:

```text
operator     = 아직 승인된 학교 관리자 없음
school_admin = 기존 학교 관리자 승인 대기
approved     = 승인 완료
```

최초 관리자는 운영자가 service-role 전용 RPC로 승격합니다.

```text
operator_promote_school_admin(<teacher auth user uuid>)
```

## 3. 교사 학교 소속 잠금 테스트

이미 학교 A에 프로필이 있는 같은 교사 계정으로 학교 B를 선택해 로그인/등록을 시도합니다.

기대:

```text
SCHOOL_CHANGE_REQUIRES_OPERATOR
기존 school_id 유지
기존 role 유지
기존 verified 유지
```

같은 학교 A를 다시 선택한 경우에는 표시 이름만 갱신될 수 있습니다. 실제 전학/전근/오등록 정정은 운영자 절차로 처리합니다.

## 4. 교사 권한 회수 테스트

학교 관리자로 로그인한 뒤 `승인된 교사 관리`에서 다른 일반 교사의 권한을 회수합니다.

기대 동작:

```text
대상 교사 verified=false
컴시간 별칭 제거
담당/공동담당 연결 제거
단독 담당 수업은 현재 학교 관리자에게 자동 인계
대상 교사의 신규 교사용 RPC 호출 즉시 차단
```

열린 탭도 확인합니다.

```text
최대 약 60초
또는 탭 재진입
또는 온라인 복구
→ teacher-session-guard.js 재검증
→ 로그아웃 / teacher-login 이동
```

보호 규칙:

```text
자기 자신의 권한 회수 불가
다른 school_admin 권한 회수 불가
다른 학교 교사 권한 회수 불가
```

다른 관리자 행에는 UI에서 `운영자만 변경`이 표시되어야 합니다.

## 5. 수업 삭제 학교 범위 테스트

승인된 담당 교사만 삭제할 수 있고, 현재 교사의 `teacher_profiles.school_id`와 삭제 대상 `pe_lessons.school_id`가 같아야 합니다.

```text
담당교사 아님 → DELETE_FORBIDDEN
verified=false → DELETE_FORBIDDEN
학교 불일치 → DELETE_FORBIDDEN
동일 학교 + 승인된 담당교사 → 삭제 허용
```

## 6. VAPID

```bash
npx web-push generate-vapid-keys
```

Private Key는 브라우저/GitHub 소스에 넣지 않습니다.

## 7. Vercel Import

GitHub 저장소:

```text
kimyejun978-tech/timetable-change-alert
```

반드시:

```text
Root Directory = /
```

`today-pe`만 Root로 잡으면 루트 `vercel.json`과 `/api/*`가 제외됩니다.

## 8. Environment Variables

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

## 9. 배포 직후

```text
GET /
GET /student
GET /teacher/login
GET /api/health
GET /api/schools?q=대덕소프트웨어마이스터고
GET /api/timetable?schoolName=대덕소프트웨어마이스터고등학교&region=대전광역시
```

기대:

```json
{ "readyForCore": true }
```

Push까지 준비되면:

```json
{ "readyForPush": true }
```

## 10. 최초 교사 테스트

```text
교사 가입
→ 이메일 인증(설정 시)
→ “최초 관리자 승인 대기”
→ approvalRoute=operator
→ 운영자 최초 관리자 승격
→ 다시 로그인
→ 교사 대시보드 접근
```

## 11. 추가 교사 테스트

```text
같은 학교 다른 이메일 가입
→ approvalRoute=school_admin
→ “학교 관리자 승인 대기”
→ 기존 학교 관리자 승인
→ 로그인 성공
```

## 12. 학생 테스트

```text
/student
→ 학교 검색
→ 학년/반 저장
→ 컴시간 기준 체육 여부 확인
→ 교사 안내 반영 확인
```

학생 수업/알림 응답과 오프라인 캐시에 교사 개인 이름/ID가 없는지 확인합니다.

## 13. 컴시간 테스트

```text
컴시간알리미
→ 실패 시 NEIS
```

컴시간 담당교사명과 로그인 이름이 다르면 **컴시간 이름 매칭 설정**에서 별칭을 등록합니다.

## 14. 날씨 / Realtime

교사 화면에서 학교 주소, 현재 날씨, 교시별 예보, 우천 주의를 확인합니다.

교사 A/B 화면을 동시에 열고 한쪽이 수업을 변경했을 때 다른 화면이 Realtime으로 갱신되는지 확인합니다.

## 15. Web Push

학생:

```text
알림 켜기
→ PushManager 구독
→ /api/push/subscribe
```

교사:

```text
수업 등록/수정/삭제
→ /api/push/send
→ 해당 학교·학년·반 학생만 Push 수신
```

## 16. 오프라인

온라인에서 학생 화면을 한 번 연 뒤 네트워크를 끕니다.

```text
PWA 정적 UI 로딩
익명화된 최근 안내/알림 fallback
유효한 당일 시간표 캐시
오프라인 저장본 표시
```

## 17. 대회 데모

```text
1. 학생: 학교/반 설정
2. 컴시간 체육 교시 자동 확인
3. 안내 미등록 상태
4. 교사: 날씨 + 전체 체육 시간표
5. 종목/장소/준비물 등록
6. 학생 반영
7. 우천 상황
8. 장소/종목 변경
9. 학생 변경 알림
10. 공동 담당/별칭/권한 분리 소개
11. 학생 개인정보 최소화 소개
12. 관리자 승인/권한 회수/관리자 보호/학교 소속 잠금 소개
```

## 18. 자동 검증

```text
JS 문법
HTML ↔ JS
Auth / RLS / 최초 관리자 보안
승인 경로 구분
교사 학교 소속 잠금
교사 권한 회수 / 관리자 보호 / 세션 재검증
수업 삭제의 학교 범위 검증
공동 담당 / 변경 이력
컴시간 별칭
학생 개인정보 최소화
PWA / Push wiring
배포 config fallback / health
컴시간 → NEIS
정적 smoke
Playwright E2E
실제 컴시간/NEIS 검색
```

Playwright는 실제 Supabase를 오염시키지 않도록 `/api/public-config`를 빈 값으로 mock해 로컬 데모 모드로 실행합니다.
