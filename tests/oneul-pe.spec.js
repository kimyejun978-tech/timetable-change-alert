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

test('학생-교사 로컬 데모 핵심 흐름이 브라우저에서 이어진다', async ({ browser }) => {
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

  await student.locator('#studentSchoolSearchInput').fill('대덕소프트웨어마이스터고');
  await student.locator('#studentSchoolSearchForm button[type="submit"]').click();
  await expect(student.locator('.school-item')).toHaveCount(1);
  await student.locator('.school-item').click();
  await student.locator('#studentGrade').selectOption('1');
  await student.locator('#studentClassNo').fill('2');
  await student.getByRole('button', { name: '학생 화면 시작' }).click();

  await expect(student.locator('#studentClassLabel')).toContainText('1학년 2반');
  await expect(student.locator('#todayLessons')).toContainText('체육 수업은 예정되어 있지만');

  const teacher = await context.newPage();
  await teacher.goto('/today-pe/teacher-login.html');
  await teacher.locator('#teacherSchoolSearchInput').fill('대덕소프트웨어마이스터고');
  await teacher.locator('#teacherSchoolSearchForm button[type="submit"]').click();
  await teacher.locator('.school-item').click();
  await teacher.locator('#teacherName').fill('김체육');
  await teacher.locator('#teacherEmail').fill('pe@example.com');
  await teacher.locator('#teacherPassword').fill('testpass1234');
  await teacher.getByRole('button', { name: '교사 화면 들어가기' }).click();

  await expect(teacher).toHaveURL(/teacher\.html$/);
  await expect(teacher.locator('#teacherIdentity')).toContainText('김체육');
  await expect(teacher.locator('#teacherRoleLabel')).toContainText('학교 관리자');

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

  await teacher.locator('#teacherLessonList [data-edit-id]').first().click();
  await teacher.locator('#locationChoices [data-value="체육관"]').click();
  await teacher.getByRole('button', { name: '저장하기' }).click();
  await expect(teacher.locator('#teacherLessonList')).toContainText('체육관');

  await student.locator('#refreshStudentButton').click();
  await expect(student.locator('#todayLessons')).toContainText('체육관');
  await expect(student.locator('#studentNotificationList')).toContainText('체육 안내');
  await expect(student.locator('#studentUnreadBadge')).not.toHaveClass(/hidden/);

  await context.close();
});
