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
  showToast,
} = window.OneulPE;
const Backend = window.OneulPEBackend;

let studentProfile = readJSON(localStorage, STORAGE.studentProfile, null);
let lessons = [];
let selectedSchool = null;
let loadingLessons = false;

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
    rows.forEach((school) => {
      schoolResults.appendChild(renderSchoolButton(school, chooseSchool));
    });
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

  const todayContainer = document.getElementById('todayLessons');
  todayContainer.innerHTML = `
    <section class="lesson-card empty">
      <div><h3>불러오는 중…</h3><p>선생님이 등록한 최신 체육 정보를 확인하고 있습니다.</p></div>
    </section>
  `;

  await loadLessons();
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

  if (!todayLessons.length) {
    container.innerHTML = `
      <section class="lesson-card empty">
        <div>
          <div class="lesson-meta"><span class="meta-chip">${escapeHTML(formatDateKo(new Date()))}</span></div>
          <h3>아직 안내 전이에요</h3>
          <p>오늘 체육 수업 안내가 아직 등록되지 않았습니다.</p>
        </div>
      </section>
    `;
    return;
  }

  todayLessons.forEach((lesson) => {
    const equipment = lesson.equipment?.length ? lesson.equipment.join(' · ') : '준비물 없음';
    const teachers = lesson.teacherNames?.length
      ? lesson.teacherNames.join(', ')
      : (lesson.teacherName || '체육교사');
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
  classForm.classList.add('hidden');
  schoolResults.innerHTML = '';
  schoolSearchStatus.textContent = '';
  schoolBadge.textContent = '학생 포털';
  showOnly('setup');
});

boot();
