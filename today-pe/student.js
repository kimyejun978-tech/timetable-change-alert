const {
  STORAGE,
  readJSON,
  writeJSON,
  escapeHTML,
  searchSchools,
  renderSchoolButton,
  localDateKey,
  formatDateKo,
  formatUpdated,
  fetchPeTimetable,
  showToast,
} = window.OneulPE;
const Backend = window.OneulPEBackend;

let studentProfile = readJSON(localStorage, STORAGE.studentProfile, null);
let lessons = [];
let selectedSchool = null;
let loadingLessons = false;
let todaySchedule = { known: false, rows: [], provider: null };

const setupView = document.getElementById('studentSetupView');
const homeView = document.getElementById('studentHomeView');
const schoolBadge = document.getElementById('studentSchoolBadge');
const schoolSearchForm = document.getElementById('studentSchoolSearchForm');
const schoolSearchInput = document.getElementById('studentSchoolSearchInput');
const schoolSearchStatus = document.getElementById('studentSchoolSearchStatus');
const schoolResults = document.getElementById('studentSchoolResults');
const classForm = document.getElementById('studentClassForm');
const schoolSummary = document.getElementById('studentSchoolSummary');
const refreshButton = document.getElementById('refreshStudentButton');

function showOnly(view) {
  setupView.classList.toggle('hidden', view !== 'setup');
  homeView.classList.toggle('hidden', view !== 'home');
}

function mondayOf(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function weekRange() {
  const monday = mondayOf(new Date());
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { monday, friday, from: localDateKey(monday), to: localDateKey(friday) };
}

async function loadLessons() {
  if (!studentProfile?.school || loadingLessons) return;
  loadingLessons = true;
  refreshButton.disabled = true;
  try {
    const { from, to } = weekRange();
    lessons = await Backend.listStudentLessons({
      school: studentProfile.school,
      grade: studentProfile.grade,
      classNo: studentProfile.classNo,
      from,
      to,
    });
  } catch (error) {
    console.error(error);
    lessons = [];
    showToast('수업 정보를 불러오지 못했습니다.');
  } finally {
    loadingLessons = false;
    refreshButton.disabled = false;
  }
}

function normalizeDirectNeis(result) {
  const rows = result.rows.map((row) => ({
    grade: Number(row.GRADE),
    classNo: Number(row.CLASS_NM),
    period: Number(row.PERIO),
    subject: row.ITRT_CNTNT || '체육',
  }));
  const mine = rows.filter((row) => (
    String(row.grade) === String(studentProfile.grade)
    && String(row.classNo) === String(studentProfile.classNo)
  ));
  return {
    known: mine.length > 0 || !result.sampleLimited,
    rows: mine,
    provider: 'neis-direct',
  };
}

async function loadTodaySchedule() {
  const school = studentProfile.school;
  const params = new URLSearchParams({
    schoolName: school.SCHUL_NM,
    region: school.LCTN_SC_NM || '',
    officeCode: school.ATPT_OFCDC_SC_CODE || '',
    schoolCode: school.SD_SCHUL_CODE || '',
    date: localDateKey().replaceAll('-', ''),
  });

  try {
    const response = await fetch(`/api/timetable?${params.toString()}`);
    if (!response.ok) throw new Error(`Timetable API ${response.status}`);
    const result = await response.json();
    const rows = (Array.isArray(result.rows) ? result.rows : []).filter((row) => (
      String(row.grade) === String(studentProfile.grade)
      && String(row.classNo) === String(studentProfile.classNo)
    ));
    todaySchedule = { known: true, rows, provider: result.provider || 'unknown' };
  } catch (error) {
    console.warn('서버 시간표 조회 실패, 브라우저 NEIS fallback 사용', error);
    try {
      todaySchedule = normalizeDirectNeis(await fetchPeTimetable(school, new Date()));
    } catch (fallbackError) {
      console.warn('학생 시간표 fallback 실패', fallbackError);
      todaySchedule = { known: false, rows: [], provider: null };
    }
  }
}

async function boot() {
  document.getElementById('studentBackendMode').textContent = Backend.modeLabel;
  if (!studentProfile?.school || !studentProfile?.grade || !studentProfile?.classNo) {
    showOnly('setup');
    schoolBadge.textContent = '학생 포털';
    return;
  }

  schoolBadge.textContent = studentProfile.school.SCHUL_NM;
  showOnly('home');
  await renderStudentHome();
}

schoolSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = schoolSearchInput.value.trim();
  if (query.length < 2) {
    schoolSearchStatus.textContent = '학교 이름을 두 글자 이상 입력해주세요.';
    return;
  }

  schoolSearchStatus.textContent = '전국 학교 정보를 검색하고 있어요…';
  schoolResults.innerHTML = '';
  classForm.classList.add('hidden');

  try {
    const rows = await searchSchools(query);
    if (!rows.length) {
      schoolSearchStatus.textContent = '검색 결과가 없습니다. 학교 이름을 조금 짧게 입력해보세요.';
      return;
    }

    schoolSearchStatus.textContent = `${rows.length}개 학교를 찾았습니다.`;
    rows.forEach((school) => schoolResults.appendChild(renderSchoolButton(school, chooseSchool)));
  } catch (error) {
    console.error(error);
    schoolSearchStatus.textContent = 'NEIS 학교 검색에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  }
});

function chooseSchool(school) {
  selectedSchool = school;
  schoolSummary.innerHTML = `
    <strong>${escapeHTML(school.SCHUL_NM)}</strong><br />
    ${escapeHTML(school.LCTN_SC_NM || '')} · ${escapeHTML(school.ORG_RDNMA || '')}
  `;
  classForm.classList.remove('hidden');
  classForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

classForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedSchool) {
    showToast('학교를 먼저 선택해주세요.');
    return;
  }

  studentProfile = {
    school: selectedSchool,
    grade: document.getElementById('studentGrade').value,
    classNo: document.getElementById('studentClassNo').value,
  };
  writeJSON(localStorage, STORAGE.studentProfile, studentProfile);
  schoolBadge.textContent = selectedSchool.SCHUL_NM;
  showOnly('home');
  await renderStudentHome();
  showToast('학교와 반을 저장했어요.');
});

async function renderStudentHome() {
  document.getElementById('studentDateLabel').textContent = formatDateKo(new Date());
  document.getElementById('studentClassLabel').textContent = `${studentProfile.grade}학년 ${studentProfile.classNo}반 · 오늘의 체육`;
  document.getElementById('studentBackendMode').textContent = Backend.modeLabel;

  document.getElementById('todayLessons').innerHTML = `
    <section class="lesson-card empty">
      <div><h3>불러오는 중…</h3><p>오늘 시간표와 선생님 안내를 함께 확인하고 있습니다.</p></div>
    </section>
  `;

  await Promise.all([loadLessons(), loadTodaySchedule()]);
  const today = localDateKey();
  const todayLessons = lessons
    .filter((lesson) => lesson.date === today)
    .sort((a, b) => Number(a.period) - Number(b.period));

  renderTodayLessons(todayLessons);
  renderWeekLessons();
}

function renderTodayLessons(todayLessons) {
  const container = document.getElementById('todayLessons');
  container.innerHTML = '';

  const guideByPeriod = new Map(todayLessons.map((lesson) => [String(lesson.period), lesson]));
  const scheduledByPeriod = new Map(todaySchedule.rows.map((row) => [String(row.period), row]));
  const periods = [...new Set([...guideByPeriod.keys(), ...scheduledByPeriod.keys()])]
    .sort((a, b) => Number(a) - Number(b));

  if (!periods.length) {
    if (todaySchedule.known) {
      container.innerHTML = `
        <section class="lesson-card empty">
          <div>
            <div class="lesson-meta"><span class="meta-chip">${escapeHTML(formatDateKo(new Date()))}</span></div>
            <h3>오늘은 체육이 없어요</h3>
            <p>현재 시간표 기준으로 오늘 예정된 체육 수업이 없습니다.</p>
          </div>
        </section>
      `;
    } else {
      container.innerHTML = `
        <section class="lesson-card empty">
          <div>
            <div class="lesson-meta"><span class="meta-chip">${escapeHTML(formatDateKo(new Date()))}</span></div>
            <h3>아직 안내 전이에요</h3>
            <p>시간표 확인이 불완전해 체육 여부를 확정하지 못했습니다. 선생님 안내가 등록되면 여기에 표시됩니다.</p>
          </div>
        </section>
      `;
    }
    return;
  }

  periods.forEach((period) => {
    const lesson = guideByPeriod.get(period);
    const scheduled = scheduledByPeriod.get(period);
    if (!lesson && scheduled) {
      const placeholder = document.createElement('section');
      placeholder.className = 'lesson-card empty';
      placeholder.innerHTML = `
        <div>
          <div class="lesson-meta">
            <span class="meta-chip">${escapeHTML(period)}교시</span>
            <span class="meta-chip">시간표 확인됨</span>
          </div>
          <h3>${escapeHTML(scheduled.subject || '체육')}</h3>
          <p>체육 수업은 예정되어 있지만 종목·장소·준비물 안내는 아직 등록되지 않았어요.</p>
        </div>
      `;
      container.appendChild(placeholder);
      return;
    }

    if (!lesson) return;
    const equipment = lesson.equipment?.length ? lesson.equipment.join(' · ') : '준비물 없음';
    const teachers = lesson.teacherNames?.length ? lesson.teacherNames.join(', ') : (lesson.teacherName || '체육교사');
    const card = document.createElement('section');
    card.className = 'lesson-card';
    card.innerHTML = `
      <div>
        <div class="lesson-meta">
          <span class="meta-chip">${escapeHTML(lesson.period)}교시</span>
          <span class="meta-chip">📍 ${escapeHTML(lesson.location)}</span>
        </div>
        <h3>${escapeHTML(lesson.activity)}</h3>
        <p>🎒 ${escapeHTML(equipment)}</p>
        ${lesson.notice ? `<p class="lesson-note">${escapeHTML(lesson.notice)}</p>` : ''}
      </div>
      <div class="updated-label">담당 ${escapeHTML(teachers)} · 마지막 수정 ${escapeHTML(formatUpdated(lesson.updatedAt))}</div>
    `;
    container.appendChild(card);
  });
}

function renderWeekLessons() {
  const container = document.getElementById('weekLessonList');
  const { monday } = weekRange();
  const dayLabels = ['월', '화', '수', '목', '금'];
  container.innerHTML = '';

  for (let i = 0; i < 5; i += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const key = localDateKey(date);
    const dayLessons = lessons
      .filter((lesson) => lesson.date === key)
      .sort((a, b) => Number(a.period) - Number(b.period));

    const row = document.createElement('div');
    row.className = 'week-item';
    if (!dayLessons.length) {
      row.innerHTML = `
        <div class="week-day">${dayLabels[i]}</div>
        <div class="week-main"><strong>등록된 체육 안내 없음</strong><small>${date.getMonth() + 1}/${date.getDate()}</small></div>
      `;
    } else {
      row.innerHTML = `
        <div class="week-day">${dayLabels[i]}</div>
        <div class="week-main">
          ${dayLessons.map((lesson) => `
            <div class="week-lesson-line">
              <strong>${escapeHTML(lesson.period)}교시 · ${escapeHTML(lesson.activity)}</strong>
              <small>${escapeHTML(lesson.location)}${lesson.notice ? ` · ${escapeHTML(lesson.notice)}` : ''}</small>
            </div>
          `).join('')}
        </div>
      `;
    }
    container.appendChild(row);
  }
}

refreshButton.addEventListener('click', async () => {
  await renderStudentHome();
  showToast('최신 정보를 불러왔어요.');
});

document.getElementById('studentResetButton').addEventListener('click', () => {
  if (!window.confirm('학교와 반 설정을 다시 할까요?')) return;
  localStorage.removeItem(STORAGE.studentProfile);
  studentProfile = null;
  selectedSchool = null;
  lessons = [];
  todaySchedule = { known: false, rows: [], provider: null };
  classForm.classList.add('hidden');
  schoolResults.innerHTML = '';
  schoolSearchStatus.textContent = '';
  schoolBadge.textContent = '학생 포털';
  showOnly('setup');
});

boot();
