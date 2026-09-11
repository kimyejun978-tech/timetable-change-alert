# 오늘체육 실서비스 배포 체크리스트

## 1. Supabase

현재 `oneul-pe` 실제 프로젝트에는 001~012 마이그레이션이 적용되어 있습니다. 새 프로젝트에서는 아래 순서대로 적용합니다.

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

확인할 테이블:

```text
schools
teacher_profiles
pe_lessons
lesson_teachers
lesson_changes
push_subscriptions
teacher_timetable_aliases
```

권한 확인:

```text
관리 테이블 RLS 활성화
학생 관리 테이블 직접 접근 불가
학생 읽기 RPC만 anon 허용
교사 RPC authenticated 전용
operator_promote_school_admin service_role 전용
get_my_teacher_approval_context authenticated 전용
pe_lessons Realtime publication 포함
```

## 2. 교사 Auth / 최초 관리자

Supabase Auth 이메일 확인 정책을 결정합니다.

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

최초 관리자는 운영자가 다음 service-role 전용 RPC로 승격합니다.

```text
operator_promote_school_admin(<teacher auth user uuid>)
```

이후 추가 교사는 학교 관리자 화면에서 승인합니다.

## 3. VAPID

```bash
npx web-push generate-vapid-keys
```

Private Key는 브라우저/GitHub 소스에 넣지 않습니다.

## 4. Vercel Import

GitHub 저장소:

```text
kimyejun978-tech/timetable-change-alert
```

반드시:

```text
Root Directory = /
```

`today-pe`만 Root로 잡으면 루트 `vercel.json`과 `/api/*`가 제외됩니다.

`feat/oneul-pe-mvp` 커밋에 Preview Deployment가 생성되는지 확인합니다.

## 5. Environment Variables

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

`/api/public-config`는 실제 환경변수가 있을 때만 공개 fallback을 override합니다.

## 6. 배포 직후

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

## 7. 최초 교사 테스트

```text
교사 가입
→ 이메일 인증(설정 시)
→ 화면에 “최초 관리자 승인 대기” 표시
→ approvalRoute=operator
→ 운영자 최초 관리자 승격
→ 다시 로그인
→ 교사 대시보드 접근
```

## 8. 추가 교사 테스트

```text
같은 학교 다른 이메일 가입
→ approvalRoute=school_admin
→ “학교 관리자 승인 대기” 표시
→ 기존 학교 관리자 승인
→ 로그인 성공
```

## 9. 학생 테스트

```text
/student
→ 학교 검색
→ 학년/반 저장
→ 컴시간 기준 체육 여부 확인
→ 교사 안내 반영 확인
```

학생 수업/알림 응답과 오프라인 캐시에 교사 개인 이름/ID가 없는지 확인합니다.

## 10. 컴시간 테스트

```text
컴시간알리미
→ 실패 시 NEIS
```

컴시간 담당교사명과 로그인 이름이 다르면 **컴시간 이름 매칭 설정**에서 별칭을 등록합니다.

## 11. 날씨 / Realtime

교사 화면에서 학교 주소, 현재 날씨, 교시별 예보, 우천 주의를 확인합니다.

교사 A/B 화면을 동시에 열고 한쪽이 수업을 변경했을 때 다른 화면이 Realtime으로 갱신되는지 확인합니다.

## 12. Web Push

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

## 13. 오프라인

온라인에서 학생 화면을 한 번 연 뒤 네트워크를 끕니다.

```text
PWA 정적 UI 로딩
익명화된 최근 안내/알림 fallback
유효한 당일 시간표 캐시
오프라인 저장본 표시
```

## 14. 대회 데모

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
```

## 15. 자동 검증

```text
JS 문법
HTML ↔ JS
Auth / RLS / 최초 관리자 보안
승인 경로 구분
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
