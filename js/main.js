// 오늘(Onul) 프론트엔드 공통 동작
const STORAGE_KEYS = {
  schoolName: 'schoolName',
  schoolGrade: 'schoolGrade',
  schoolClass: 'schoolClass',
  moveNotificationEnabled: 'moveNotificationEnabled',
  moveAlertOne: 'moveAlertOne',
  moveAlertTwo: 'moveAlertTwo',
};

const PERIOD_TIMES = [
  { start: '08:50', end: '09:40' },
  { start: '09:50', end: '10:40' },
  { start: '10:50', end: '11:40' },
  { start: '11:50', end: '12:40' },
  { start: '13:30', end: '14:20' },
  { start: '14:30', end: '15:20' },
  { start: '15:30', end: '16:20' },
];

const SCHEDULE_CONFIG = {
  1: { key: 'smon', locationKey: 'smon_locations', fields: ['mc1','mc2','mc3','mc4','mc5','mc6','mc7'] },
  2: { key: 'stues', locationKey: 'stues_locations', fields: ['tuc1','tuc2','tuc3','tuc4','tuc5','tuc6','tuc7'] },
  3: { key: 'swed', locationKey: 'swed_locations', fields: ['wc1','wc2','wc3','wc4','wc5','wc6','wc7'] },
  4: { key: 'sthurs', locationKey: 'sthurs_locations', fields: ['thc1','thc2','thc3','thc4','thc5','thc6','thc7'] },
  5: { key: 'sfri', locationKey: 'sfri_locations', fields: ['fc1','fc2','fc3','fc4','fc5','fc6','fc7'] },
};

function safeParse(value) {
  if (value === null) return null;
  try { return JSON.parse(value); } catch (error) { return null; }
}

function hasSchoolConfiguration() {
  return Boolean(
    localStorage.getItem(STORAGE_KEYS.schoolName) &&
    localStorage.getItem(STORAGE_KEYS.schoolGrade) &&
    localStorage.getItem(STORAGE_KEYS.schoolClass)
  );
}

function updateFirstRunVisibility() {
  const onboarding = document.querySelector('#first_run_onboarding');
  const dashboard = document.querySelector('#dashboard_content');
  if (!onboarding || !dashboard) return;
  const configured = hasSchoolConfiguration();
  onboarding.hidden = configured;
  dashboard.hidden = !configured;
}

function getSeoulNow() {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric',
    weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const data = {};
  parts.forEach((part) => { if (part.type !== 'literal') data[part.type] = part.value; });
  return {
    year: Number(data.year), month: Number(data.month), day: Number(data.day),
    weekday: data.weekday, hour: Number(data.hour), minute: Number(data.minute),
  };
}

function getTodayNumber() {
  const weekdayMap = { 월요일: 1, 화요일: 2, 수요일: 3, 목요일: 4, 금요일: 5, 토요일: 6, 일요일: 0 };
  const todayNumber = weekdayMap[getSeoulNow().weekday];
  return todayNumber === 0 || todayNumber === 6 ? 1 : todayNumber;
}

function getBasicSchedule(todayNumber) {
  const selected = SCHEDULE_CONFIG[todayNumber];
  if (!selected) return ['', '', '', '', '', '', ''];
  const saved = safeParse(localStorage.getItem(selected.key));
  if (!saved) return ['', '', '', '', '', '', ''];
  return selected.fields.map((field) => saved[field] || '');
}

function getBasicLocations(todayNumber) {
  const selected = SCHEDULE_CONFIG[todayNumber];
  if (!selected) return ['', '', '', '', '', '', ''];
  const saved = safeParse(localStorage.getItem(selected.locationKey));
  if (!saved) return ['', '', '', '', '', '', ''];
  return Array.from({ length: 7 }, (_, index) => saved['location' + (index + 1)] || '');
}

function getMinutes(timeText) {
  const [hour, minute] = timeText.split(':').map(Number);
  return hour * 60 + minute;
}

function getCurrentPeriodState() {
  const now = getSeoulNow();
  const currentMinutes = now.hour * 60 + now.minute;
  for (let i = 0; i < PERIOD_TIMES.length; i++) {
    const start = getMinutes(PERIOD_TIMES[i].start);
    const end = getMinutes(PERIOD_TIMES[i].end);
    if (currentMinutes >= start && currentMinutes < end) return { current: i, next: i + 1 < PERIOD_TIMES.length ? i + 1 : -1 };
    if (currentMinutes < start) return { current: -1, next: i };
  }
  return { current: -1, next: -1 };
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function setTextAll(selector, value) {
  document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
}

function renderCommonSchoolInfo() {
  const schoolName = localStorage.getItem(STORAGE_KEYS.schoolName) || '학교를 설정해 주세요';
  const schoolGrade = localStorage.getItem(STORAGE_KEYS.schoolGrade);
  const schoolClass = localStorage.getItem(STORAGE_KEYS.schoolClass);
  const classLabel = schoolGrade && schoolClass ? schoolGrade + '학년 ' + schoolClass + '반' : '학급 미설정';

  setText('#sidebar_school', schoolName);
  setTextAll('[data-school-name]', schoolName);
  setTextAll('[data-class-label]', classLabel);

  if (schoolGrade && schoolClass) {
    setText('#school_information', schoolName + ' · ' + classLabel);
  } else {
    setText('#school_information', schoolName);
  }
}

function renderDate() {
  const now = getSeoulNow();
  const shortDate = now.month + '월 ' + now.day + '일 ' + now.weekday;
  const fullDate = now.year + '년 ' + shortDate;
  setText('#today_weekday', now.weekday);
  setText('#today_date', shortDate);
  setText('#meal-date-label', now.month + '월 ' + now.day + '일');
  setTextAll('[data-today-date]', fullDate);
}

function renderNextClass(schedule, locations) {
  const state = getCurrentPeriodState();
  const nextIndex = state.next;
  const title = document.querySelector('#next-class-title');
  const badge = document.querySelector('#next-class-badge');
  if (!title || !badge) return;

  if (nextIndex === -1) {
    title.textContent = '오늘 수업이 끝났습니다';
    badge.textContent = '수업 종료';
    badge.className = 'status-badge finished';
    setText('#next-class-time', '오늘 일정 종료');
    setText('#next-class-place', '');
    setText('#next-class-note', '내일 시간표와 변경사항은 다음 등교 전에 확인할 수 있습니다.');
    return;
  }

  const subject = schedule[nextIndex];
  const period = nextIndex + 1;
  const time = PERIOD_TIMES[nextIndex];
  const location = locations[nextIndex] || '장소 미설정';

  if (!subject) {
    title.textContent = period + '교시 과목 미설정';
    badge.textContent = '설정 필요';
    badge.className = 'status-badge';
    setText('#next-class-time', time.start + ' - ' + time.end);
    setText('#next-class-place', location);
    setText('#next-class-note', '시간표에서 과목과 장소를 등록하면 다음 수업 정보를 자동으로 보여줍니다.');
    return;
  }

  title.textContent = subject;
  badge.textContent = period + '교시';
  badge.className = 'status-badge';
  setText('#next-class-time', time.start + ' - ' + time.end);
  setText('#next-class-place', location);
  setText('#next-class-note', location === '장소 미설정'
    ? '수업 장소를 등록하면 이동수업 여부와 10분 전·3분 전 알림을 판단할 수 있습니다.'
    : '다음 수업 장소를 확인해 주세요. 이동 알림은 설정한 시간에 맞춰 제공할 예정입니다.');
}

function renderTimetable(schedule, locations) {
  const tableBody = document.querySelector('#schedule_malloc');
  if (!tableBody) return;
  const state = getCurrentPeriodState();
  tableBody.innerHTML = '';

  schedule.forEach((subject, index) => {
    const row = document.createElement('tr');
    if (index === state.current) row.classList.add('current-row');
    if (index === state.next) row.classList.add('next-row');

    const periodCell = document.createElement('td');
    periodCell.className = 'period-cell';
    periodCell.textContent = index + 1;

    const subjectCell = document.createElement('td');
    subjectCell.className = 'subject-cell';
    subjectCell.textContent = subject || '과목 미설정';

    const timeCell = document.createElement('td');
    timeCell.className = 'time-cell';
    timeCell.textContent = PERIOD_TIMES[index].start + ' - ' + PERIOD_TIMES[index].end;

    const placeCell = document.createElement('td');
    placeCell.className = 'place-cell';
    placeCell.textContent = locations[index] || '-';

    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = 'row-status';
    if (index === state.current) {
      status.textContent = '현재';
      status.classList.add('current');
    } else if (index === state.next) {
      status.textContent = '다음';
    } else {
      status.textContent = '-';
    }
    statusCell.appendChild(status);
    row.append(periodCell, subjectCell, timeCell, placeCell, statusCell);
    tableBody.appendChild(row);
  });
}

function renderChanges() {
  const changeList = document.querySelector('#changed_schedule_list');
  if (!changeList) return;
  changeList.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-row';
  empty.textContent = '학교 시간표 변경 데이터 연동 전입니다. 연동 후 바뀐 교시와 장소만 표시합니다.';
  changeList.appendChild(empty);
}

function showHomePage() {
  updateFirstRunVisibility();
  renderCommonSchoolInfo();
  renderDate();
  if (!hasSchoolConfiguration()) return;

  const day = getTodayNumber();
  const schedule = getBasicSchedule(day);
  const locations = getBasicLocations(day);
  renderNextClass(schedule, locations);
  renderTimetable(schedule, locations);
  renderChanges();
}

function storeSchoolSetting() {
  const schoolNameInput = document.querySelector('#school_name_input');
  const gradeSelect = document.querySelector('#grade_select');
  const classSelect = document.querySelector('#class_select');
  if (!schoolNameInput || !gradeSelect || !classSelect) return;

  const schoolName = schoolNameInput.value.trim();
  if (!schoolName) {
    alert('학교 이름을 입력해 주세요.');
    schoolNameInput.focus();
    return;
  }

  const wasConfigured = hasSchoolConfiguration();
  localStorage.setItem(STORAGE_KEYS.schoolName, schoolName);
  localStorage.setItem(STORAGE_KEYS.schoolGrade, gradeSelect.value);
  localStorage.setItem(STORAGE_KEYS.schoolClass, classSelect.value);
  showSchoolSetting();
  renderCommonSchoolInfo();
  alert('학교와 학급 설정을 저장했습니다.');
  if (!wasConfigured) window.location.href = 'index.html';
}

function showSchoolSetting() {
  const schoolName = localStorage.getItem(STORAGE_KEYS.schoolName);
  const schoolGrade = localStorage.getItem(STORAGE_KEYS.schoolGrade);
  const schoolClass = localStorage.getItem(STORAGE_KEYS.schoolClass);
  setText('#now_school_text', schoolName || '아직 설정하지 않음');
  setText('#now_grade_text', schoolGrade ? schoolGrade + '학년' : '아직 설정하지 않음');
  setText('#now_class_text', schoolClass ? schoolClass + '반' : '아직 설정하지 않음');

  const schoolNameInput = document.querySelector('#school_name_input');
  const gradeSelect = document.querySelector('#grade_select');
  const classSelect = document.querySelector('#class_select');
  if (schoolNameInput && schoolName) schoolNameInput.value = schoolName;
  if (gradeSelect && schoolGrade) gradeSelect.value = schoolGrade;
  if (classSelect && schoolClass) classSelect.value = schoolClass;
}

function loadNotificationSettings() {
  const enabled = document.querySelector('#move_notification_enabled');
  const firstAlert = document.querySelector('#move_alert_one');
  const secondAlert = document.querySelector('#move_alert_two');
  if (!enabled || !firstAlert || !secondAlert) return;
  enabled.value = localStorage.getItem(STORAGE_KEYS.moveNotificationEnabled) === 'off' ? 'off' : 'on';
  firstAlert.value = localStorage.getItem(STORAGE_KEYS.moveAlertOne) || '10';
  secondAlert.value = localStorage.getItem(STORAGE_KEYS.moveAlertTwo) || '3';
}

function saveNotificationSettings() {
  const enabled = document.querySelector('#move_notification_enabled');
  const firstAlert = document.querySelector('#move_alert_one');
  const secondAlert = document.querySelector('#move_alert_two');
  if (!enabled || !firstAlert || !secondAlert) return;
  localStorage.setItem(STORAGE_KEYS.moveNotificationEnabled, enabled.value);
  localStorage.setItem(STORAGE_KEYS.moveAlertOne, firstAlert.value);
  localStorage.setItem(STORAGE_KEYS.moveAlertTwo, secondAlert.value);
  alert('이동수업 알림 설정을 저장했습니다.');
}

const schoolSaveButton = document.querySelector('#school_save_button');
if (schoolSaveButton) {
  schoolSaveButton.addEventListener('click', storeSchoolSetting);
  showSchoolSetting();
}

const notificationSaveButton = document.querySelector('#notification_save_button');
if (notificationSaveButton) {
  notificationSaveButton.addEventListener('click', saveNotificationSettings);
  loadNotificationSettings();
}

renderCommonSchoolInfo();
renderDate();
if (document.querySelector('#schedule_malloc')) showHomePage();
