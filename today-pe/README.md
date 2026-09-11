# 오늘체육 MVP

체육 수업의 종목·장소·준비물을 교사가 등록하고 학생이 웹에서 바로 확인하는 모바일 우선 웹 서비스입니다.

## 지금 구현된 구조

- 학생 / 교사 포털 완전 분리
- NEIS 학교기본정보 API로 전국 학교 검색
- 시간표 조회 우선순위: **컴시간알리미 → NEIS fallback**
- 교사 화면: 학교 위치, 현재 날씨, 교시별 날씨, 오늘 학교 전체 체육 시간표
- 교사 화면: 전체 수업 / 내 수업 필터
- 여러 교사 계정 지원
- 다른 교사의 수업은 기본 조회 전용
- 동일 학교·날짜·학년·반·교시 중복 등록 방지
- 학생 화면: 실제 오늘 시간표와 교사 안내를 합쳐 표시
- 학생 화면: `오늘 체육 없음` / `체육은 있으나 안내 미등록` 상태 구분
- Supabase 설정이 있으면 서버 Auth + DB/RPC 사용
- Supabase 설정이 없으면 LocalStorage 기반 데모 모드 자동 fallback

## 시간표 데이터

### 1순위: 컴시간알리미

`api/timetable.js` 서버리스 함수가 `parse-comcigan`으로 컴시간 데이터를 읽습니다.

브라우저에서 컴시간 서버를 직접 호출하지 않는 이유는 컴시간 파서가 내부적으로 HTTP 엔드포인트를 사용해 HTTPS 페이지에서 CORS/혼합 콘텐츠 문제가 생길 수 있기 때문입니다.

### 2순위: NEIS

컴시간에서 학교를 찾지 못하거나 조회가 실패하면 NEIS 고등학교 시간표 API로 자동 전환합니다.

정적 Live Server 환경처럼 `/api/timetable`을 사용할 수 없으면 브라우저에서 NEIS 직접 fallback을 사용합니다.

## 교사 인증/권한

### Supabase 연결 시

- 교사: 이메일 + 비밀번호 인증
- 학교의 **첫 번째 교사**: `school_admin`, 즉시 승인
- 이후 가입 교사: `teacher`, 승인 대기
- 학교 관리자는 교사 대시보드에서 승인 대기 목록 확인/승인
- 승인 전 교사는 교사용 관리 화면 접근 불가
- 교사는 자기 학교 수업만 조회
- 수업 수정/삭제는 기본적으로 해당 수업에 연결된 교사만 가능
- 학생은 Auth 없이 `get_student_lessons` RPC로 조회만 가능
- 학생은 `pe_lessons` 테이블 INSERT/UPDATE/DELETE에 접근할 수 없음

DB는 다음 구조입니다.

```text
schools
teacher_profiles
pe_lessons
lesson_teachers
```

`lesson_teachers`를 별도 테이블로 둬 한 수업에 여러 교사가 연결될 수 있도록 준비했습니다.

### 로컬 데모 모드

`config.js`의 Supabase 값이 비어 있으면 서버 없이 같은 브라우저에서 데모할 수 있습니다.

- 첫 교사: 관리자
- 두 번째 이후 교사: 승인 대기
- 관리자 승인 후 교사 화면 접근 가능
- 데이터는 LocalStorage에 저장

로컬 데모 모드는 실제 보안 수단이 아니며 대회 시연/UX 확인용입니다.

## Supabase 연결 방법

1. Supabase 프로젝트 생성
2. SQL Editor에서 순서대로 실행
   - `today-pe/supabase/schema.sql`
   - `today-pe/supabase/002_teacher_realtime.sql`
3. `today-pe/config.js`에 프로젝트 정보 입력

```js
window.ONEUL_PE_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_PUBLISHABLE_OR_ANON_KEY',
  NEIS_API_KEY: '',
};
```

> `service_role` 키는 절대로 프론트엔드에 넣지 마세요.

Supabase Auth에서 이메일 확인을 켜둔 경우 첫 가입 후 확인 메일 인증이 필요합니다.

교사 변경사항을 대시보드에 Realtime으로 반영하려면 Supabase Dashboard의 Database/Replication에서 `pe_lessons`를 활성화합니다.

## 학생 화면 흐름

```text
웹 접속
→ 학교 검색
→ 학년/반 선택
→ 컴시간 우선으로 오늘 체육 여부 확인
→ 선생님 안내 DB 조회
→ 둘을 합쳐 학생에게 표시
```

상태는 다음처럼 나뉩니다.

```text
시간표에 체육 없음
→ 오늘은 체육이 없어요

시간표에 체육 있음 + 안내 없음
→ 5교시 체육 예정 / 종목·장소 안내 대기

시간표에 체육 있음 + 안내 있음
→ 농구 / 체육관 / 체육복 / 공지 표시
```

## 교사 화면 흐름

```text
교사 로그인
→ 학교 위치/날씨
→ 컴시간 기준 오늘 전체 체육 시간표
→ 교시별 예상 날씨
→ 안내 등록
→ DB 저장
→ 다른 교사/학생에게 공유
```

우천 가능성이 높은 야외 수업은 경고 표시를 띄웁니다.

## 현재 남은 작업

- 실제 Supabase 프로젝트 URL/키 연결 후 E2E 검증
- 학생 자동 갱신/알림함
- 교사 공동 담당 수업 지정 UI
- 수업 변경 이력
- Web Push / PWA
- 배포 도메인 및 운영용 환경변수 처리

## 실행

정적 UI만 확인할 때:

```text
Live Server → today-pe/index.html
```

컴시간 서버리스 함수까지 확인하려면 Vercel 같은 Node 서버리스 환경에 배포해야 합니다.
