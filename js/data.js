// 요일별 기본 시간표와 수업 장소를 저장한다.
let selectedDay = 5;

const EDITOR_TIMES = [
  '08:50 - 09:40', '09:50 - 10:40', '10:50 - 11:40', '11:50 - 12:40',
  '13:30 - 14:20', '14:30 - 15:20', '15:30 - 16:20'
];

const DAY_CONFIG = {
  1: { name: '월요일', key: 'smon', locationKey: 'smon_locations', fields: ['mc1','mc2','mc3','mc4','mc5','mc6','mc7'] },
  2: { name: '화요일', key: 'stues', locationKey: 'stues_locations', fields: ['tuc1','tuc2','tuc3','tuc4','tuc5','tuc6','tuc7'] },
  3: { name: '수요일', key: 'swed', locationKey: 'swed_locations', fields: ['wc1','wc2','wc3','wc4','wc5','wc6','wc7'] },
  4: { name: '목요일', key: 'sthurs', locationKey: 'sthurs_locations', fields: ['thc1','thc2','thc3','thc4','thc5','thc6','thc7'] },
  5: { name: '금요일', key: 'sfri', locationKey: 'sfri_locations', fields: ['fc1','fc2','fc3','fc4','fc5','fc6','fc7'] },
};

function parseObject(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (error) { return null; }
}

function readSavedDay(dayNumber) {
  const config = DAY_CONFIG[dayNumber];
  const saved = config ? parseObject(config.key) : null;
  if (!config || !saved) return ['', '', '', '', '', '', ''];
  return config.fields.map((field) => saved[field] || '');
}

function readSavedLocations(dayNumber) {
  const config = DAY_CONFIG[dayNumber];
  const saved = config ? parseObject(config.locationKey) : null;
  if (!config || !saved) return ['', '', '', '', '', '', ''];
  return Array.from({ length: 7 }, (_, index) => saved['location' + (index + 1)] || '');
}

function makeScheduleEditor(dayNumber) {
  const scheduleArea = document.querySelector('#scheduleArea');
  if (!scheduleArea) return;

  const config = DAY_CONFIG[dayNumber];
  const subjects = readSavedDay(dayNumber);
  const locations = readSavedLocations(dayNumber);
  scheduleArea.innerHTML = '';

  const titleRow = document.createElement('div');
  titleRow.className = 'editor-title-row';
  titleRow.innerHTML = `<div><h3>${config.name} 시간표</h3><p>과목과 기본 수업 장소를 입력해 주세요.</p></div>`;

  const table = document.createElement('div');
  table.className = 'schedule-editor-table';

  const header = document.createElement('div');
  header.className = 'schedule-editor-header';
  ['교시', '시간', '과목', '장소'].forEach((text) => {
    const span = document.createElement('span');
    span.textContent = text;
    header.appendChild(span);
  });
  table.appendChild(header);

  for (let i = 0; i < 7; i++) {
    const row = document.createElement('div');
    row.className = 'schedule-editor-row';

    const label = document.createElement('label');
    label.setAttribute('for', 'c' + (i + 1));
    label.textContent = (i + 1) + '교시';

    const time = document.createElement('span');
    time.className = 'schedule-editor-time';
    time.textContent = EDITOR_TIMES[i];

    const subject = document.createElement('input');
    subject.type = 'text';
    subject.id = 'c' + (i + 1);
    subject.placeholder = '과목명';
    subject.value = subjects[i];
    subject.autocomplete = 'off';

    const location = document.createElement('input');
    location.type = 'text';
    location.id = 'location' + (i + 1);
    location.placeholder = '예: 본교실, 체육관';
    location.value = locations[i];
    location.autocomplete = 'off';

    row.append(label, time, subject, location);
    table.appendChild(row);
  }

  const actions = document.createElement('div');
  actions.className = 'editor-actions';
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'store_slt';
  saveButton.textContent = config.name + ' 저장하기';
  actions.appendChild(saveButton);

  scheduleArea.append(titleRow, table, actions);
}

function saveSelectedDay() {
  const config = DAY_CONFIG[selectedDay];
  const savedSubjects = {};
  const savedLocations = {};

  config.fields.forEach((field, index) => {
    const subject = document.querySelector('#c' + (index + 1));
    const location = document.querySelector('#location' + (index + 1));
    savedSubjects[field] = subject ? subject.value.trim() : '';
    savedLocations['location' + (index + 1)] = location ? location.value.trim() : '';
  });

  localStorage.setItem(config.key, JSON.stringify(savedSubjects));
  localStorage.setItem(config.locationKey, JSON.stringify(savedLocations));
  alert(config.name + ' 시간표를 저장했습니다.');
}

function selectDay(dayNumber, clickedButton) {
  selectedDay = dayNumber;
  document.querySelectorAll('.day-btn').forEach((button) => button.classList.remove('active'));
  if (clickedButton) clickedButton.classList.add('active');
  makeScheduleEditor(dayNumber);
}

const dayButtons = [
  ['.mon', 1], ['.tues', 2], ['.wednes', 3], ['.thurs', 4], ['.fri', 5]
];

dayButtons.forEach(([selector, day]) => {
  const button = document.querySelector(selector);
  if (!button) return;
  button.addEventListener('click', () => selectDay(day, button));
});

const scheduleArea = document.querySelector('#scheduleArea');
if (scheduleArea) {
  scheduleArea.addEventListener('click', (event) => {
    if (event.target.classList.contains('store_slt')) saveSelectedDay();
  });

  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date());
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 };
  const initialDay = map[weekday] || 1;
  const initialSelector = dayButtons.find(([, day]) => day === initialDay)?.[0] || '.mon';
  const initialButton = document.querySelector(initialSelector);
  selectDay(initialDay, initialButton);
}
