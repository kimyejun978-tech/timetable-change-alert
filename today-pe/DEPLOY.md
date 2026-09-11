# 오늘체육 실서비스 배포 체크리스트

## 1. Supabase

현재 `oneul-pe` 실제 프로젝트에는 001~011 마이그레이션이 적용되어 있습니다. 새 프로젝트를 만들 경우 아래 순서대로 적용합니다.

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

확인 사항:

```text
모든 관리 테이블 RLS 활성화
학생은 관리 테이블 직접 접근 불가
학생 읽기 RPC 2개만 anon 실행 허용
교사 RPC는 authenticated 전용
operator_promote_school_admin은 service_role 전용
pe_lessons는 supabase_realtime publication 포함
```

## 2. 교사 Auth 설정

Supabase Auth의 이메일 확인 정책을 결정합니다. 이메일 확인이 켜져 있으면 가입 후 이메일 인증을 완료해야 세션이 생성됩니다.

실서비스에서는 **첫 가입 교사를 자동 관리자로 만들지 않습니다.** 모든 신규 교사는 `verified=false` 승인 대기로 생성됩니다.

### 최초 학교 관리자 지정

최초 교사가 가입한 뒤 운영자가 Supabase에서 해당 교사의 UUID를 확인하고 아래 service-role 전용 RPC를 사용해 학교 관리자로 승격합니다.

```text
operator_promote_school_admin(<teacher auth user uuid>)
```

이후 같은 학교의 추가 교사는 앱의 학교 관리자 화면에서 승인할 수 있습니다.

## 3. VAPID 키

Web Push용 키 쌍을 생성합니다.

```bash
npx web-push generate-vapid-keys
```

Public/Private Key를 분리 보관합니다. Private Key는 브라우저나 GitHub 소스에 넣지 않습니다.

## 4. Vercel 프로젝트 연결

GitHub 저장소 `kimyejun978-tech/timetable-change-alert`를 Import합니다.

중요:

```text
Root Directory = 저장소 루트 /
```

`today-pe`를 Root Directory로 지정하면 루트의 `vercel.json`과 `/api/*` 함수가 빠집니다.

프레임워크는 정적 웹 + Node 서버리스 구성이므로 특별한 빌드 명령은 필요하지 않습니다.

`feat/oneul-pe-mvp` 브랜치 새 커밋에 Preview Deployment가 생성되는지 확인합니다.

## 5. Vercel Environment Variables

### 공개 가능

```text
SUPABASE_URL
SUPABASE_ANON_KEY
VAPID_PUBLIC_KEY
```

Supabase URL/publishable key는 `today-pe/config.js`에도 안전한 공개 fallback이 있습니다. `/api/public-config`는 실제 환경변수가 존재할 때만 이 값을 override합니다.

### 서버 전용

```text
SUPABASE_SERVICE_ROLE_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
NEIS_API_KEY
```

예:

```text
VAPID_SUBJECT=mailto:admin@example.com
```

`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `NEIS_API_KEY`는 절대 소스에 커밋하지 않습니다.

## 6. 배포 직후 확인

Preview/Production URL에서 확인합니다.

```text
GET /
GET /student
GET /teacher/login
GET /api/health
GET /api/schools?q=대덕소프트웨어마이스터고
GET /api/timetable?schoolName=대덕소프트웨어마이스터고등학교&region=대전광역시
```

`/student`, `/teacher/login`은 `/today-pe/...` 실제 파일로 redirect되어 CSS/JS가 정상 로드되어야 합니다.

`/api/health`의 기대 상태:

```json
{
  "readyForCore": true
}
```

Web Push까지 준비되면:

```json
{
  "readyForPush": true
}
```

`readyForCore=true`, `readyForPush=false`는 Supabase 핵심 기능은 준비됐지만 service-role/VAPID 서버 설정이 아직 없다는 의미일 수 있습니다.

## 7. 최초 교사 실기기 테스트

교사 기기에서:

```text
/teacher/login
→ 학교 검색
→ 이름/이메일/비밀번호 가입
→ 이메일 인증(설정된 경우)
→ 승인 대기 표시
```

운영자가 최초 관리자로 승격한 뒤 다시 로그인하여:

```text
학교 관리자 표시
오늘 시간표 로드
날씨 로드
수업 등록/수정 가능
```

을 확인합니다.

## 8. 학생 실기기 테스트

```text
/student
→ 학교 검색
→ 학년/반 저장
→ 컴시간 기준 오늘 체육 확인
→ 교사 안내 반영 확인
```

학생 응답/오프라인 캐시에 교사 개인 이름·ID가 포함되지 않는지도 확인합니다. 학생 화면은 `체육교사`라는 일반 표현만 사용합니다.

## 9. 두 번째 교사 테스트

```text
다른 이메일로 같은 학교 가입
→ 승인 대기
→ 학교 관리자 승인
→ 교사 화면 접근
→ 전체 체육 조회
→ 담당/공동담당 수업만 수정
```

공동 담당 변경 후 두 교사 모두 수정할 수 있는지와 변경 이력이 남는지 확인합니다.

## 10. 컴시간 → NEIS 테스트

정상 우선순위:

```text
컴시간알리미
→ 실패 시 NEIS
```

교사 화면 `현재 데이터` 배지를 확인합니다.

컴시간 담당교사명이 로그인 이름과 다르면 **컴시간 이름 매칭 설정**에 별칭을 추가합니다.

```text
로그인: 김체육
컴시간: 김OO
→ 별칭: 김OO
→ 내 시간표 필터 정상 동작
```

## 11. 날씨 테스트

교사 화면에서 확인:

```text
학교 주소
현재 날씨
최고/최저
최대 강수확률
각 체육 교시 시간대 예보
우천 주의 필터
```

## 12. Realtime 테스트

교사 A와 교사 B 화면을 동시에 열고 수업을 수정해 다른 화면이 Realtime 이벤트를 받아 최신 안내를 다시 불러오는지 확인합니다.

## 13. Web Push 실기기 테스트

학생 기기:

```text
알림 켜기
→ 브라우저 권한 허용
→ PushManager 구독
→ /api/push/subscribe
→ push_subscriptions 저장
```

교사 기기:

```text
수업 등록/수정/삭제
→ /api/push/send
→ 해당 학교·학년·반 학생 기기에 Push 수신
```

삭제 알림도 확인합니다.

## 14. 오프라인 테스트

학생 화면을 온라인에서 한 번 연 뒤 네트워크를 끕니다.

기대 동작:

```text
PWA 정적 UI 로딩
익명화된 최근 안내/변경 알림 사용
당일 시간표 캐시가 유효하면 표시
오프라인 저장본 표시
```

온라인 복구 시 자동 최신화되는지 확인합니다.

## 15. 대회 데모 시나리오

```text
1. 학생: 학교 → 1학년 2반 선택
2. 컴시간에서 체육 교시 자동 확인
3. 안내 미등록 상태 제시
4. 교사: 학교 날씨 + 오늘 전체 체육 확인
5. 축구 / 운동장 / 체육복 등록
6. 학생 화면 반영
7. 우천 상황 제시
8. 운동장 → 체육관, 축구 → 배드민턴 수정
9. 학생 변경 알림 확인
10. 여러 교사·공동 담당·컴시간 별칭 구조 소개
11. 학생/교사 권한 분리와 개인정보 최소화 설명
```

## 16. 자동 검증

GitHub Actions는 다음을 자동 확인합니다.

```text
JS 문법
HTML ↔ JS 연결
Auth / RLS / 최초 관리자 보안
공동 담당 / 변경 이력
컴시간 별칭
학생 개인정보 최소화
PWA / Web Push wiring
배포 config fallback / health
컴시간 → NEIS 우선순위
정적 smoke
Playwright UI E2E
실제 컴시간/NEIS 검색
```

Playwright는 실제 Supabase를 건드리지 않도록 테스트 중 `/api/public-config`를 빈 값으로 mock하여 로컬 데모 모드에서 실행합니다.
