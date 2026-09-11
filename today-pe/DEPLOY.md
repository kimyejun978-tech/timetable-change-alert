# 오늘체육 실서비스 배포 체크리스트

## 1. Supabase 프로젝트

Supabase 프로젝트를 만든 뒤 SQL Editor에서 순서대로 실행합니다.

```text
1. supabase/schema.sql
2. supabase/002_teacher_realtime.sql
3. supabase/003_collaboration_history_notifications.sql
4. supabase/004_push_subscriptions.sql
```

적용 후 확인할 테이블:

```text
schools
teacher_profiles
pe_lessons
lesson_teachers
lesson_changes
push_subscriptions
```

교사 로그인에 이메일 확인을 사용할지 Supabase Auth 설정에서 결정합니다. 이메일 확인이 켜져 있으면 첫 가입 후 메일 인증 전에는 로그인 세션이 생성되지 않을 수 있습니다.

## 2. VAPID 키

Web Push용 키 쌍을 생성합니다.

```bash
npx web-push generate-vapid-keys
```

출력되는 Public Key와 Private Key를 따로 보관합니다. Private Key는 GitHub나 브라우저 코드에 넣지 않습니다.

## 3. Vercel 프로젝트 연결

GitHub 저장소를 Vercel 프로젝트로 연결합니다. 프레임워크 프리셋은 특별한 빌드가 필요 없는 정적/Node 서버리스 구성이면 됩니다. 저장소 루트의 `vercel.json`이 `/`, `/student`, `/teacher`, `/teacher/login`을 실제 `today-pe` 페이지로 redirect합니다.

`feat/oneul-pe-mvp` 브랜치에 새 커밋이 들어오면 Vercel Git Integration이 연결된 프로젝트에서는 Preview Deployment가 자동 생성되어야 합니다.

## 4. Vercel Environment Variables

### 브라우저에 전달되는 공개 값

```text
SUPABASE_URL
SUPABASE_ANON_KEY
VAPID_PUBLIC_KEY
```

`/api/public-config`가 이 값들만 브라우저에 전달합니다.

### 서버 전용 값

```text
SUPABASE_SERVICE_ROLE_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
NEIS_API_KEY
```

예시:

```text
VAPID_SUBJECT=mailto:admin@example.com
```

`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `NEIS_API_KEY`는 `today-pe/config.js`에 넣지 않습니다.

## 5. 배포 직후 서버 상태 확인

Preview 또는 Production URL에서 아래 순서대로 확인합니다.

```text
GET /
GET /student
GET /teacher/login
GET /api/health
GET /api/schools?q=대덕소프트웨어마이스터고
GET /api/timetable?schoolName=대덕소프트웨어마이스터고등학교&region=대전광역시
```

`/student`, `/teacher/login`은 최종적으로 `/today-pe/...` 실제 파일 경로로 redirect되어야 하고, 페이지의 CSS/JS 상대경로가 정상 로드되어야 합니다.

정상적인 핵심 서비스 설정:

```json
{
  "readyForCore": true
}
```

Web Push까지 준비된 경우:

```json
{
  "readyForPush": true
}
```

Supabase 환경변수가 아직 없으면 정적 UI와 컴시간/NEIS 일부 기능은 확인할 수 있지만 `readyForCore`는 false일 수 있습니다. 이는 배포 실패가 아니라 백엔드 자격증명 미연결 상태입니다.

`checks.neis`가 false여도 NEIS sample 호출은 가능하지만 검색 결과 수 제한 등이 있으므로 실제 배포에서는 API 키 사용을 권장합니다.

## 6. 기본 기능 실기기 테스트

### 학생 기기

```text
/student 접속
→ 실제 /today-pe/student.html로 이동
→ 학교 검색
→ 학년/반 저장
→ 오늘 체육 상태 확인
```

### 교사 기기

```text
/teacher/login 접속
→ 학교 검색
→ 첫 교사 가입/로그인
→ 학교 관리자 권한 확인
→ 오늘 체육 시간표의 데이터 공급원 확인
→ 종목/장소/준비물 등록
```

다시 학생 기기에서 새로고침하지 않아도 자동 갱신 주기 또는 앱 재진입 시 변경 정보가 반영되는지 확인합니다.

## 7. 두 번째 교사 테스트

다른 이메일로 같은 학교에 가입합니다.

```text
두 번째 교사 가입
→ 승인 대기
→ 첫 번째 학교 관리자가 승인
→ 로그인 성공
→ 전체 체육수업 조회
→ 자기 수업/공동 담당 수업만 수정 가능
```

한 수업을 공동 담당으로 지정한 뒤 두 교사 모두 수정할 수 있는지와 변경 이력에 수정자가 남는지 확인합니다.

## 8. 컴시간 → NEIS fallback 테스트

교사 화면의 `현재 데이터` 배지를 확인합니다.

정상적인 우선순위:

```text
컴시간알리미
→ 컴시간 실패 시 NEIS fallback
```

컴시간의 담당교사명과 로그인 교사 이름이 일치하면 `내 시간표` 필터에서 해당 수업만 볼 수 있습니다. 이름이 다르게 등록된 학교에서는 전체 체육 필터를 사용하거나 추후 교사명 매핑 기능을 추가해야 합니다.

## 9. 날씨 테스트

교사 화면에서 다음을 확인합니다.

```text
학교 주소 표시
현재 날씨
최고/최저 기온
강수확률
각 체육 교시 시간대 날씨
```

운동장/야외 수업이고 강수확률이 높은 경우 `우천 주의` 필터에 표시되는지도 확인합니다.

## 10. Web Push 실기기 테스트

학생 기기에서 `알림 켜기`를 누르고 브라우저 권한을 허용합니다.

```text
학생 Push 구독
→ push_subscriptions 저장
→ 교사가 해당 반 수업 등록/수정
→ /api/push/send
→ 학생 기기에 알림 수신
```

수업 삭제 알림도 확인합니다. 삭제 알림은 `lesson_changes`의 삭제 전 스냅샷을 사용해 원래 학년/반을 찾습니다.

## 11. 오프라인 테스트

학생 화면을 한 번 정상적으로 연 뒤 네트워크를 끊고 다시 확인합니다.

기대 동작:

```text
정적 PWA UI 로딩
최근 교사 안내/알림 fallback
당일 시간표 캐시 사용 가능 시 표시
`오프라인 저장본` 표시
```

다시 온라인이 되면 자동으로 최신 데이터를 확인합니다.

## 12. 최종 대회 데모 시나리오

```text
1. 학생: 학교 → 1학년 2반 선택
2. 컴시간에서 5교시 체육 자동 확인
3. 아직 안내 미등록 상태 제시
4. 교사: 학교 날씨와 오늘 전체 체육 시간표 확인
5. 1-2 5교시 축구 / 운동장 / 체육복 등록
6. 학생 화면에 반영
7. 날씨 악화 상황 제시
8. 교사: 운동장 → 체육관, 축구 → 배드민턴 수정
9. 학생 알림함/Push에서 변경 확인
10. 두 번째 교사 또는 공동 담당 구조 소개
```

GitHub Actions의 Playwright E2E가 1~9 흐름 중 핵심 등록/수정/학생 반영 경로를 자동 검증합니다. 실제 Supabase와 Push는 배포 자격증명을 연결한 뒤 실기기에서 최종 확인합니다.
