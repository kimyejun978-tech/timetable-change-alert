import { test, expect } from '@playwright/test';

const school = {
  ATPT_OFCDC_SC_CODE: 'G10',
  SD_SCHUL_CODE: '7430310',
  SCHUL_NM: '대덕소프트웨어마이스터고등학교',
  SCHUL_KND_SC_NM: '고등학교',
  LCTN_SC_NM: '대전광역시',
  ORG_RDNMA: '대전광역시 유성구 가정북로 76',
};

function kstDateKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function weatherPayload() {
  const date = kstDateKey();
  const hours = Array.from({ length: 24 }, (_, hour) => `${date}T${String(hour).padStart(2, '0')}:00`);
  return {
    current: { temperature_2m: 23, weather_code: 1, precipitation: 0 },
    hourly: {
      time: hours,
      temperature_2m: hours.map(() => 23),
      precipitation_probability: hours.map(() => 10),
      weather_code: hours.map(() => 1),
    },
    daily: {
      time: [date],
      temperature_2m_max: [27],
      temperature_2m_min: [18],
      precipitation_probability_max: [20],
    },
  };
}

async function chooseSchool(page, inputSelector, formSelector) {
  await page.locator(inputSelector).fill('대덕소프트웨어마이스터고');
  await page.locator(`${formSelector} button[type="submit"]`).click();
  await expect(page.locator('.school-item')).toHaveCount(1);
  await page.locator('.school-item').click();
}

async function fillTeacherLogin(page, { name, email, password }) {
  await page.locator('#teacherName').fill(name);
  await page.locator('#teacherEmail').fill(email);
  await page.locator('#teacherPassword').fill(password);
  await page.getByRole('button', { name: '교사 화면 들어가기' }).click();
}

test('학생-교사 핵심 흐름과 교사 승인/회수가 브라우저에서 이어진다', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'Asia/Seoul' });

  await context.route('**/api/public-config', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: "window.ONEUL_PE_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',VAPID_PUBLIC_KEY:'',NEIS_API_KEY:''};",
  }));

  await context.route('https://cdn.jsdelivr.net/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.supabase = {};',
  }));

  await context.route('**/api/schools?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ rows: [school], sampleLimited: false }),
  }));

  await context.route('**/api/timetable?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      provider: 'comcigan',
      rows: [{
        grade: 1,
        classNo: 2,
        period: 5,
        subject: '체육',
        teacher: '김체육',
        classroom: '',
        changed: false,
      }],
      periodTimes: [{ number: 5, start: '13:30' }],
      fallbackUsed: false,
      failures: [],
    }),
  }));

  await context.route('https://nominatim.openstreetmap.org/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ lat: '36.391', lon: '127.363', display_name: school.ORG_RDNMA }]),
  }));

  await context.route('https://api.open-meteo.com/v1/forecast**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(weatherPayload()),
  }));

  const student = await context.newPage();
  await student.goto('/today-pe/student.html');
  await student.evaluate(() => localStorage.clear());
  await student.reload();

  await chooseSchool(student, '#studentSchoolSearchInput', '#studentSchoolSearchForm');
  await student.locator('#studentGrade').selectOption('1');
  await student.locator('#studentClassNo').fill('2');
  await student.getByRole('button', { name: '학생 화면 시작' }).click();

  await expect(student.locator('#studentClassLabel')).toContainText('1학년 2반');
  await expect(student.locator('#todayLessons')).toContainText('체육 수업은 예정되어 있지만');

  const teacher = await context.newPage();
  await teacher.goto('/today-pe/teacher-login.html');
  await chooseSchool(teacher, '#teacherSchoolSearchInput', '#teacherSchoolSearchForm');
  await fillTeacherLogin(teacher, {
    name: '김체육',
    email: 'pe@example.com',
    password: 'testpass1234',
  });

  await expect(teacher).toHaveURL(/teacher\.html$/);
  await expect(teacher.locator('#teacherIdentity')).toContainText('김체육');
  await expect(teacher.locator('#teacherRoleLabel')).toContainText('학교 관리자');

  // 이미 등록된 계정이 다른 학교를 골라 스스로 소속을 바꾸는 것은 막힌다.
  const schoolLockProbe = await context.newPage();
  await schoolLockProbe.goto('/today-pe/teacher-login.html');
  const schoolChangeError = await schoolLockProbe.evaluate(async () => {
    const otherSchool = {
      ATPT_OFCDC_SC_CODE: 'B10',
      SD_SCHUL_CODE: '9999999',
      SCHUL_NM: '다른고등학교',
      LCTN_SC_NM: '서울특별시',
      ORG_RDNMA: '서울특별시 테스트로 1',
    };
    try {
      await window.OneulPEBackend.loginTeacher({
        school: otherSchool,
        name: '김체육',
        email: 'pe@example.com',
        password: 'testpass1234',
      });
      return 'NOT_BLOCKED';
    } catch (error) {
      return String(error?.message || error);
    }
  });
  expect(schoolChangeError).toContain('SCHOOL_CHANGE_REQUIRES_OPERATOR');
  await schoolLockProbe.close();

  await teacher.locator('#newLessonButton').click();
  await teacher.locator('#lessonPeriod').selectOption('5');
  await teacher.locator('#lessonGrade').selectOption('1');
  await teacher.locator('#lessonClasses').fill('2');
  await teacher.locator('#activityChoices [data-value="축구"]').click();
  await teacher.locator('#locationChoices [data-value="운동장"]').click();
  await teacher.locator('input[name="equipment"][value="체육복"]').check();
  await teacher.getByRole('button', { name: '저장하기' }).click();

  await expect(teacher.locator('#teacherLessonList')).toContainText('1-2 · 축구');
  await expect(teacher.locator('#teacherLessonList')).toContainText('운동장');

  await student.locator('#refreshStudentButton').click();
  await expect(student.locator('#todayLessons')).toContainText('축구');
  await expect(student.locator('#todayLessons')).toContainText('운동장');
  await expect(student.locator('#todayLessons')).toContainText('체육교사');
  await expect(student.locator('#todayLessons')).not.toContainText('김체육');

  await teacher.locator('#teacherLessonList [data-edit-id]').first().click();
  await teacher.locator('#locationChoices [data-value="체육관"]').click();
  await teacher.getByRole('button', { name: '저장하기' }).click();
  await expect(teacher.locator('#teacherLessonList')).toContainText('체육관');

  await student.locator('#refreshStudentButton').click();
  await expect(student.locator('#todayLessons')).toContainText('체육관');
  await expect(student.locator('#studentNotificationList')).toContainText('체육 안내');
  await expect(student.locator('#studentNotificationList')).not.toContainText('김체육');
  await expect(student.locator('#studentUnreadBadge')).not.toHaveClass(/hidden/);

  // 두 번째 교사는 자동 승인되지 않고 학교 관리자 승인을 기다린다.
  const secondTeacher = await context.newPage();
  await secondTeacher.goto('/today-pe/teacher-login.html');
  await chooseSchool(secondTeacher, '#teacherSchoolSearchInput', '#teacherSchoolSearchForm');
  await fillTeacherLogin(secondTeacher, {
    name: '이체육',
    email: 'pe2@example.com',
    password: 'testpass5678',
  });

  await expect(secondTeacher).toHaveURL(/teacher-login\.html$/);
  await expect(secondTeacher.locator('#backendModeDescription')).toContainText('승인 대기');

  // 첫 번째 학교 관리자가 두 번째 교사를 승인한다.
  await teacher.locator('#refreshPendingTeachersButton').click();
  await expect(teacher.locator('#pendingTeacherList')).toContainText('이체육');
  await teacher.locator('#pendingTeacherList [data-approve-teacher]').click();
  await expect(teacher.locator('#pendingTeacherList')).not.toContainText('이체육');

  // 승인 후 같은 자격증명으로 로그인하면 일반 체육교사로 진입한다.
  await fillTeacherLogin(secondTeacher, {
    name: '이체육',
    email: 'pe2@example.com',
    password: 'testpass5678',
  });
  await expect(secondTeacher).toHaveURL(/teacher\.html$/);
  await expect(secondTeacher.locator('#teacherRoleLabel')).toContainText('체육교사');

  // 관리자가 승인된 교사 목록을 새로 불러온 뒤 접근 권한을 회수한다.
  await teacher.locator('[data-access-refresh]').click();
  const approvedList = teacher.locator('[data-approved-teacher-list]');
  await expect(approvedList).toContainText('이체육');
  const secondRow = approvedList.locator('.teacher-lesson-item').filter({ hasText: '이체육' });
  teacher.once('dialog', (dialog) => dialog.accept());
  await secondRow.locator('[data-revoke-teacher]').click();
  await expect(approvedList).not.toContainText('이체육');

  // localStorage 변경 이벤트를 받은 열린 탭의 세션 가드가 자동 로그아웃시킨다.
  await expect(secondTeacher).toHaveURL(/teacher-login\.html$/, { timeout: 5000 });

  // 다른 학교 관리자 계정은 회수 UI 자체가 노출되지 않는다.
  await teacher.evaluate(() => {
    const key = window.OneulPE.STORAGE.teacherProfiles;
    const profiles = window.OneulPE.readJSON(localStorage, key, []);
    const currentAdmin = profiles.find((item) => item.role === 'school_admin' && item.verified !== false);
    profiles.push({
      id: 'peer-admin-e2e',
      name: '박관리',
      email: 'admin2@example.com',
      school: currentAdmin.school,
      schoolCode: currentAdmin.schoolCode,
      passwordHash: 'not-used-in-test',
      role: 'school_admin',
      verified: true,
      createdAt: new Date().toISOString(),
    });
    window.OneulPE.writeJSON(localStorage, key, profiles);
  });
  await teacher.locator('[data-access-refresh]').click();
  const peerAdminRow = approvedList.locator('.teacher-lesson-item').filter({ hasText: '박관리' });
  await expect(peerAdminRow).toContainText('운영자만 변경');
  await expect(peerAdminRow.locator('[data-revoke-teacher]')).toHaveCount(0);

  await context.close();
});
