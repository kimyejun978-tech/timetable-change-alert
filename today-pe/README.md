# 오늘체육

체육 선생님이 실제 수업의 종목·장소·준비물을 등록하면 학생이 웹/PWA에서 바로 확인하는 학교 체육수업 안내 서비스입니다.

## 현재 구현 상태

- 학생 / 교사 포털 완전 분리
- 전국 학교 검색: 배포 환경에서는 서버의 `/api/schools`가 NEIS를 조회하고, 정적 개발 환경에서는 브라우저 NEIS 조회로 fallback
- 시간표: **컴시간알리미 1순위 → NEIS fallback**
- 학생: 학교·학년·반 저장, 오늘 체육, 주간 안내
- 학생: `오늘 체육 없음` / `체육 있음·안내 미등록` / `안내 등록됨` 구분
- 학생: 최근 14일 변경 알림함, 안 읽은 알림 표시
- 학생: 약 90초 자동 갱신, 앱 재진입/온라인 복구 시 자동 최신화
- 학생: 네트워크 장애 시 최근 저장된 수업 안내·변경 알림·당일 시간표 fallback
- 교사: 별도 인증, 승인 전 교사용 화면 접근 차단
- 여러 체육교사 지원 및 학교 관리자 승인
- 공동 담당 교사 지정
- 수업별 변경 이력
- 학교 위치 기반 현재 날씨 + 교시별 기온/강수확률
- 야외수업 우천 경고
- PWA 설치 지원
- 브라우저 알림 및 Web Push 경로 구현
- Supabase 설정이 없으면 LocalStorage 데모 모드 자동 fallback
- Playwright로 학생 → 교사 → 수업 등록 → 학생 확인 → 수정 → 학생 알림 흐름 자동 E2E 검증

## 데이터 공급원

### 학교 검색

배포 환경에서는 브라우저가 NEIS에 직접 접근하지 않고 다음 경로를 사용합니다.

```text
학생/교사 브라우저
→ GET /api/schools?q=학교명
→ 서버에서 NEIS 학교기본정보 API 호출
→ 학교명/지역/주소/교육청코드/학교코드 반환
```

`NEIS_API_KEY`는 서버 환경변수에만 둘 수 있어 브라우저에 노출할 필요가 없습니다. `/api/schools`를 쓸 수 없는 Live Server 환경에서는 기존 NEIS 직접 조회로 자동 fallback합니다.

### 시간표 1순위: 컴시간알리미

`api/timetable.js`가 서버에서 `parse-comcigan`을 이용해 컴시간 데이터를 읽습니다. 컴시간 조회가 실패하거나 학교를 찾지 못하면 같은 API 안에서 NEIS 고등학교 시간표로 자동 전환합니다.

```text
GET /api/timetable
→ 컴시간알리미
→ 실패 시 NEIS
```

프론트 화면에는 실제로 어느 공급원을 사용했는지도 표시합니다.

## 권한 구조

```text
학생
- 로그인 없이 학교/학년/반 설정
- 자기 반 수업/변경 알림 조회
- 교사용 등록·수정·삭제 불가

체육교사
- Supabase Auth 로그인
- 학교 관리자 승인 필요
- 자기 학교 전체 안내 조회
- 자신이 담당인 수업 등록/수정/삭제
- 공동 담당 교사 지정 가능

학교 관리자
- 학교의 첫 번째 가입 교사
- 이후 교사 승인
- 같은 학교 공동 담당 관리
```

학생은 `pe_lessons` 같은 관리 테이블에 직접 쓰지 않고 SECURITY DEFINER RPC로 필요한 데이터만 읽습니다. 교사용 변경 API도 인증된 교사와 소속 학교를 서버에서 확인합니다.

## Supabase DB / 마이그레이션

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

`lesson_teachers`는 한 수업에 여러 교사를 연결하고, `lesson_changes`는 등록/수정/삭제 및 공동 담당 변경을 기록합니다.

## 배포 설정

Vercel 기준으로 저장소 루트에 `vercel.json`이 있습니다.

```text
/              → /today-pe/index.html
/student       → /today-pe/student.html
/teacher       → /today-pe/teacher.html
/teacher/login → /today-pe/teacher-login.html
```

필요한 환경변수 예시는 저장소 루트 `.env.example`에 있습니다.

### 브라우저에 공개 가능한 값

```text
SUPABASE_URL
SUPABASE_ANON_KEY
VAPID_PUBLIC_KEY
```

배포 시 `/api/public-config`가 위 세 값만 JavaScript로 내려줍니다. 따라서 배포할 때 `today-pe/config.js`를 직접 수정할 필요가 없습니다.

### 서버 전용 비밀 값

```text
SUPABASE_SERVICE_ROLE_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
NEIS_API_KEY
```

이 값들은 GitHub 소스나 `today-pe/config.js`에 넣으면 안 됩니다.

`today-pe/config.js`는 Live Server 같은 로컬 개발 환경에서 수동 설정이 필요할 때 사용하는 fallback 설정 파일입니다.

## 배포 상태 확인

배포 뒤 다음 API로 필수 환경변수 연결 상태를 확인할 수 있습니다.

```text
GET /api/health
```

비밀 값 자체는 반환하지 않고 아래처럼 설정 여부만 반환합니다.

```text
supabasePublic
supabaseServer
vapid
neis
readyForCore
readyForPush
```

## 학생 자동 갱신 / 오프라인 fallback

학생 포털은 다음 시점에 최신 정보를 다시 확인합니다.

- 화면을 열 때
- 새로고침 버튼
- 화면을 다시 전면으로 가져왔을 때
- 인터넷 연결이 복구됐을 때
- 화면이 열린 동안 약 90초 간격

네트워크가 끊기면 `student-resilience.js`가 최근 정상 응답을 사용합니다.

```text
교사 안내 / 변경 알림: 최대 7일 저장
당일 시간표 응답: 최대 8시간 저장
```

저장 데이터를 사용하면 학생 화면에 `오프라인 저장본` 표시와 안내 토스트를 띄웁니다. 서버 데이터가 다시 연결되면 자동으로 최신 정보로 돌아갑니다.

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
→ POST /api/push/send + 교사 Bearer 토큰
→ 서버에서 승인된 교사와 소속 학교 검증
→ 해당 학교·학년·반 학생에게만 Web Push
```

`SUPABASE_SERVICE_ROLE_KEY`와 `VAPID_PRIVATE_KEY`는 Push 서버 함수에서만 사용합니다.

## PWA

- `manifest.webmanifest`
- `sw.js`
- `icon.svg`
- `pwa.js`

HTTPS 환경에서 설치 가능한 웹앱으로 동작하며 정적 UI 파일을 캐시합니다. API 응답은 서비스워커가 무조건 캐시하지 않고, 학생에게 필요한 제한적인 데이터 fallback만 `student-resilience.js`가 별도로 관리합니다.

## 자동 검증

GitHub Actions `Validate 오늘체육 MVP`에서 다음을 확인합니다.

```text
JS 문법
HTML ↔ JS id 연결
교사 Auth / 학생 read-only RPC 구조
공동 담당 / 변경 이력 / 학생 알림
PWA / Web Push 연결
배포 환경변수 / 학교검색 프록시 / health API
컴시간 → NEIS 우선순위
정적 페이지 smoke test
Playwright Chromium 실제 UI E2E
실제 컴시간 학교 검색
실제 NEIS 학교 검색
```

Playwright E2E는 실제 브라우저에서 다음 흐름을 자동으로 수행합니다.

```text
학생이 학교·1학년 2반 선택
→ 체육은 있지만 안내 미등록 상태 확인
→ 첫 교사가 로그인해 학교 관리자 생성
→ 1-2 5교시 축구/운동장 등록
→ 학생 화면에 반영 확인
→ 교사가 장소를 체육관으로 변경
→ 학생 화면과 변경 알림 반영 확인
```

## 실제 서비스 E2E에 남은 것

코드와 로컬 브라우저 E2E는 준비되어 있습니다. 실제 여러 기기 환경 검증에는 다음 외부 설정이 필요합니다.

```text
1. Supabase 프로젝트 생성
2. SQL 4개 적용
3. Supabase/VAPID/NEIS 환경변수 등록
4. Vercel HTTPS 배포
5. 교사 폰에서 등록
6. 학생 폰에서 실시간 공유/Push 수신 확인
```

## 로컬 실행

정적 UI와 LocalStorage 데모는 Live Server로 `today-pe/index.html`을 열면 됩니다. `/api/*` 서버리스 기능과 실제 Push까지 확인하려면 Vercel 같은 Node 서버리스 + HTTPS 환경이 필요합니다.
