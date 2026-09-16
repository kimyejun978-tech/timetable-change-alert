const STORAGE = {
  profile: 'oneulPe.profile.v1',
  lessons: 'oneulPe.lessons.v1',
};

const views = [...document.querySelectorAll('.view')];
const topbar = document.getElementById('topbar');
const schoolBadge = document.getElementById('schoolBadge');
const toast = document.getElementById('toast');

let pendingRole = null;
let pendingSchool = null;
let profile = readJSON(STORAGE.profile, null);
let lessons = readJSON(STORAGE.lessons, []);

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveProfile() {
  localStorage.setItem(STORAGE.profile, JSON.stringify(profile));
}

function saveLessons() {
  localStorage.setItem(STORAGE.lessons, JSON.stringify(lessons));
}

function showView(id, { withTopbar = true } = {}) {
  views.forEach((view) => view.classList.toggle('hidden', view.id !== id));
  topbar.classList.toggle('hidden', !withTopbar);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateKo(date = new Date()) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

function formatUpdated(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function schoolCodeOf(school) {
  return `${school.ATPT_OFCDC_SC_CODE}:${school.SD_SCHUL_CODE}`;
}

function updateTopbar() {
  if (!profile?.school) return;
  schoolBadge.textContent = profile.school.SCHUL_NM;
}

function boot() {
  if (!profile) {
    showView('roleView', { withTopbar: false });
    return;
  }

  updateTopbar();
  if (profile.role === 'student') {
    renderStudentHome();
    showView('studentHomeView');
  } else {
    renderTeacherHome();
    showView('teacherHomeView');
  }
}

// 역할 선택

document.querySelectorAll('[data-role]').forEach((button) => {
  button.addEventListener('click', () => {
    pendingRole = button.dataset.role;
    pendingSchool = null;
    showView('schoolView', { withTopbar: false });
    setTimeout(() => document.getElementById('schoolSearchInput').focus(), 100);
  });
});

document.getElementById('schoolBackButton').addEventListener('click', () => {
  showView('roleView', { withTopbar: false });
});

document.querySelectorAll('[data-back="school"]').forEach((button) => {
  button.addEventListener('click', () => showView('schoolView', { withTopbar: false }));
});

// NEIS 전국 학교 검색

const schoolSearchForm = document.getElementById('schoolSearchForm');
const schoolSearchInput = document.getElementById('schoolSearchInput');
const schoolSearchStatus = document.getElementById('schoolSearchStatus');
const schoolResults = document.getElementById('schoolResults');

schoolSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = schoolSearchInput.value.trim();
  if (query.length < 2) {
    schoolSearchStatus.textContent = '학교 이름을 두 글자 이상 입력해주세요.';
    return;
  }

  schoolSearchStatus.textContent = '전국 학교 정보를 검색하고 있어요…';
  schoolResults.innerHTML = '';

  try {
    const params = new URLSearchParams({
      Type: 'json',
      pIndex: '1',
      pSize: '30',
      SCHUL_NM: query,
    });
    const response = await fetch(`https://open.neis.go.kr/hub/schoolInfo?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rows = data?.schoolInfo?.[1]?.row ?? [];

    if (!rows.length) {
      const neisMessage = data?.RESULT?.MESSAGE;
      schoolSearchStatus.textContent = neisMessage && !neisMessage.includes('정상 처리')
        ? `검색 결과가 없습니다. (${neisMessage})`
        : '검색 결과가 없습니다. 학교 이름을 조금 짧게 입력해보세요.';
      return;
    }

    schoolSearchStatus.textContent = `${rows.length}개 학교를 찾았습니다.`;
    rows.forEach((school) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'school-item';
      button.innerHTML = `
        <strong>${escapeHTML(school.SCHUL_NM)}</strong>
        <span>${escapeHTML(school.SCHUL_KND_SC_NM || '')} · ${escapeHTML(school.LCTN_SC_NM || '')}</span>
        <span>${escapeHTML(school.ORG_RDNMA || '')}</span>
      `;
      button.addEventListener('click', () => chooseSchool(school));
      schoolResults.appendChild(button);
    });
  } catch (error) {
    console.error(error);
    schoolSearchStatus.textContent = 'NEIS 학교 검색에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
  }
});

function chooseSchool(school) {
  pendingSchool = {
    ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
    SD_SCHUL_CODE: school.SD_SCHUL_CODE,
    SCHUL_NM: school.SCHUL_NM,
    SCHUL_KND_SC_NM: school.SCHUL_KND_SC_NM,
    LCTN_SC_NM: school.LCTN_SC_NM,
    ORG_RDNMA: school.ORG_RDNMA,
  };

  const summary = `
    <strong>${escapeHTML(pendingSchool.SCHUL_NM)}</strong><br />
    ${escapeHTML(pendingSchool.LCTN_SC_NM || '')} · ${escapeHTML(pendingSchool.ORG_RDNMA || '')}
  `;

  if (pendingRole === 'student') {
    document.getElementById('studentSchoolSummary').innerHTML = summary;
    showView('studentSetupView', { withTopbar: false });
  } else {
    document.getElementById('teacherSchoolSummary').innerHTML = summary;
    showView('teacherSetupView', { withTopbar: false });
  }
}

// 학생/교사 초기 설정

document.getElementById('studentSetupForm').addEventListener('submit', (event) => {
  event.preventDefault();
  profile = {
    role: 'student',
    school: pendingSchool,
    grade: document.getElementById('studentGrade').value,
    classNo: document.getElementById('studentClassNo').value,
  };
  saveProfile();
  updateTopbar();
  renderStudentHome();
  showView('studentHomeView');
  showToast('내 학교와 반을 저장했어요.');
});

document.getElementById('teacherSetupForm').addEventListener('submit', (event) => {
  event.preventDefault();
  profile = {
    role: 'teacher',
    school: pendingSchool,
    teacherName: document.getElementById('teacherName').value.trim(),
    teacherPin: document.getElementById('teacherPin').value,
  };
  saveProfile();
  updateTopbar();
  renderTeacherHome();
  showView('teacherHomeView');
  showToast('교사 프로필을 저장했어요.');
});

// 학생 화면

function lessonMatchesStudent(lesson) {
  return lesson.schoolCode === schoolCodeOf(profile.school)
    && String(lesson.grade) === String(profile.grade)
    && String(lesson.classNo) === String(profile.classNo);
}

function renderStudentHome() {
  if (!profile || profile.role !== 'student') return;

  document.getElementById('studentDateLabel').textContent = formatDateKo(new Date());
  document.getElementById('studentClassLabel').textContent = `${profile.grade}학년 ${profile.classNo}반 · 오늘의 체육`;

  const today = localDateKey();
  const todayLessons = lessons
    .filter((lesson) => lessonMatchesStudent(lesson) && lesson.date === today)
    .sort((a, b) => Number(a.period) - Number(b.period));

  renderTodayLessonCard(todayLessons);
  renderWeekLessons();
}

function renderTodayLessonCard(todayLessons) {
  const card = document.getElementById('todayLessonCard');

  if (!todayLessons.length) {
    card.className = 'lesson-card empty';
    card.innerHTML = `
      <div>
        <div class="lesson-meta"><span class="meta-chip">${escapeHTML(formatDateKo(new Date()))}</span></div>
        <h3>아직 등록 전이에요</h3>
        <p>오늘 수업 정보가 아직 등록되지 않았습니다.</p>
      </div>
      <p class="lesson-note">체육 수업이 없는 날인지, 아직 선생님이 등록하지 않은 상태인지는 교사 등록 정보에 따라 구분하도록 서버 버전에서 확장할 예정입니다.</p>
    `;
    return;
  }

  const lesson = todayLessons[0];
  const equipment = lesson.equipment?.length ? lesson.equipment.join(' · ') : '준비물 없음';
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
    <div class="updated-label">마지막 수정 ${escapeHTML(formatUpdated(lesson.updatedAt))}</div>
  `;
}

function mondayOf(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function renderWeekLessons() {
  const container = document.getElementById('weekLessonList');
  const monday = mondayOf(new Date());
  const dayLabels = ['월', '화', '수', '목', '금'];

  container.innerHTML = '';
  for (let i = 0; i < 5; i += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const key = localDateKey(date);
    const dayLessons = lessons
      .filter((lesson) => lessonMatchesStudent(lesson) && lesson.date === key)
      .sort((a, b) => Number(a.period) - Number(b.period));

    const row = document.createElement('div');
    row.className = 'week-item';
    if (dayLessons.length) {
      const lesson = dayLessons[0];
      row.innerHTML = `
        <div class="week-day">${dayLabels[i]}</div>
        <div class="week-main">
          <strong>${escapeHTML(lesson.activity)}</strong>
          <small>${escapeHTML(lesson.location)}${lesson.notice ? ` · ${escapeHTML(lesson.notice)}` : ''}</small>
        </div>
        <div class="week-period">${escapeHTML(lesson.period)}교시</div>
      `;
    } else {
      row.innerHTML = `
        <div class="week-day">${dayLabels[i]}</div>
        <div class="week-main"><strong>등록된 체육 수업 없음</strong><small>${date.getMonth() + 1}/${date.getDate()}</small></div>
      `;
    }
    container.appendChild(row);
  }
}

document.getElementById('refreshStudentButton').addEventListener('click', () => {
  lessons = readJSON(STORAGE.lessons, []);
  renderStudentHome();
  showToast('최신 정보를 불러왔어요.');
});

// 교사 화면

function renderTeacherHome() {
  if (!profile || profile.role !== 'teacher') return;
  document.getElementById('teacherGreeting').textContent = `${profile.teacherName || '선생님'}, 오늘 수업을 등록해볼까요?`;

  const container = document.getElementById('teacherLessonList');
  const today = localDateKey();
  const schoolCode = schoolCodeOf(profile.school);
  const todayLessons = lessons
    .filter((lesson) => lesson.schoolCode === schoolCode && lesson.date === today)
    .sort((a, b) => Number(a.period) - Number(b.period) || Number(a.grade) - Number(b.grade) || Number(a.classNo) - Number(b.classNo));

  if (!todayLessons.length) {
    container.innerHTML = '<p class="muted">오늘 등록된 체육 수업이 없습니다. 오른쪽 위에서 첫 수업을 등록해보세요.</p>';
    return;
  }

  container.innerHTML = '';
  todayLessons.forEach((lesson) => {
    const item = document.createElement('div');
    item.className = 'teacher-lesson-item';
    item.innerHTML = `
      <div>
        <strong>${escapeHTML(lesson.grade)}-${escapeHTML(lesson.classNo)} · ${escapeHTML(lesson.period)}교시 · ${escapeHTML(lesson.activity)}</strong>
        <small>${escapeHTML(lesson.location)}${lesson.equipment?.length ? ` · ${escapeHTML(lesson.equipment.join(', '))}` : ''}</small>
      </div>
      <div class="actions">
        <button type="button" class="ghost-button" data-edit-id="${escapeHTML(lesson.id)}">수정</button>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', () => openLessonEditor(button.dataset.editId));
  });
}

document.getElementById('newLessonButton').addEventListener('click', () => openLessonEditor());
document.getElementById('editorBackButton').addEventListener('click', () => {
  renderTeacherHome();
  showView('teacherHomeView');
});

const lessonForm = document.getElementById('lessonForm');
const deleteLessonButton = document.getElementById('deleteLessonButton');

function openLessonEditor(id = null) {
  lessonForm.reset();
  document.getElementById('lessonId').value = '';
  document.getElementById('lessonDate').value = localDateKey();
  document.getElementById('lessonActivity').value = '';
  document.getElementById('lessonLocation').value = '';
  clearChoiceButtons();
  deleteLessonButton.classList.add('hidden');
  document.getElementById('editorTitle').textContent = '수업 등록';

  if (id) {
    const lesson = lessons.find((item) => item.id === id);
    if (!lesson) return;
    document.getElementById('lessonId').value = lesson.id;
    document.getElementById('lessonDate').value = lesson.date;
    document.getElementById('lessonPeriod').value = lesson.period;
    document.getElementById('lessonGrade').value = lesson.grade;
    document.getElementById('lessonClasses').value = lesson.classNo;
    document.getElementById('lessonActivity').value = lesson.activity;
    document.getElementById('lessonLocation').value = lesson.location;
    document.getElementById('lessonNotice').value = lesson.notice || '';
    document.querySelectorAll('input[name="equipment"]').forEach((input) => {
      input.checked = lesson.equipment?.includes(input.value) ?? false;
    });
    syncChoiceButtons('activityChoices', lesson.activity);
    syncChoiceButtons('locationChoices', lesson.location);
    deleteLessonButton.classList.remove('hidden');
    document.getElementById('editorTitle').textContent = '수업 수정';
  }

  showView('lessonEditorView');
}

function clearChoiceButtons() {
  document.querySelectorAll('.choice-button').forEach((button) => button.classList.remove('selected'));
}

function syncChoiceButtons(groupId, value) {
  document.querySelectorAll(`#${groupId} .choice-button`).forEach((button) => {
    button.classList.toggle('selected', button.dataset.value === value);
  });
}

function wireChoiceGroup(groupId, inputId) {
  document.querySelectorAll(`#${groupId} .choice-button`).forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById(inputId).value = button.dataset.value;
      syncChoiceButtons(groupId, button.dataset.value);
    });
  });
  document.getElementById(inputId).addEventListener('input', (event) => syncChoiceButtons(groupId, event.target.value));
}

wireChoiceGroup('activityChoices', 'lessonActivity');
wireChoiceGroup('locationChoices', 'lessonLocation');

lessonForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const id = document.getElementById('lessonId').value;
  const classNos = [...new Set(document.getElementById('lessonClasses').value
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d{1,2}$/.test(value) && Number(value) > 0 && Number(value) <= 30))];

  if (!classNos.length) {
    showToast('반을 숫자로 입력해주세요. 여러 반은 쉼표로 구분할 수 있어요.');
    return;
  }

  let equipment = [...document.querySelectorAll('input[name="equipment"]:checked')].map((input) => input.value);
  if (equipment.includes('없음')) equipment = ['없음'];

  const base = {
    schoolCode: schoolCodeOf(profile.school),
    schoolName: profile.school.SCHUL_NM,
    teacherName: profile.teacherName,
    date: document.getElementById('lessonDate').value,
    period: document.getElementById('lessonPeriod').value,
    grade: document.getElementById('lessonGrade').value,
    activity: document.getElementById('lessonActivity').value.trim(),
    location: document.getElementById('lessonLocation').value.trim(),
    equipment,
    notice: document.getElementById('lessonNotice').value.trim(),
    updatedAt: new Date().toISOString(),
  };

  if (id) {
    const index = lessons.findIndex((lesson) => lesson.id === id);
    if (index >= 0) {
      lessons[index] = { ...lessons[index], ...base, classNo: classNos[0] };
      classNos.slice(1).forEach((classNo) => lessons.push({ ...base, classNo, id: crypto.randomUUID() }));
    }
  } else {
    classNos.forEach((classNo) => lessons.push({ ...base, classNo, id: crypto.randomUUID() }));
  }

  saveLessons();
  renderTeacherHome();
  showView('teacherHomeView');
  showToast(`${classNos.length}개 반의 수업을 저장했어요.`);
});

deleteLessonButton.addEventListener('click', () => {
  const id = document.getElementById('lessonId').value;
  if (!id) return;
  if (!window.confirm('이 수업 정보를 삭제할까요?')) return;
  lessons = lessons.filter((lesson) => lesson.id !== id);
  saveLessons();
  renderTeacherHome();
  showView('teacherHomeView');
  showToast('수업 정보를 삭제했어요.');
});

// 공통 설정

document.getElementById('resetButton').addEventListener('click', () => {
  if (!window.confirm('학교/역할 설정을 다시 할까요? 등록된 수업 데이터는 유지됩니다.')) return;
  localStorage.removeItem(STORAGE.profile);
  profile = null;
  pendingRole = null;
  pendingSchool = null;
  topbar.classList.add('hidden');
  showView('roleView', { withTopbar: false });
});

document.getElementById('homeButton').addEventListener('click', () => {
  if (profile?.role === 'student') {
    renderStudentHome();
    showView('studentHomeView');
  } else if (profile?.role === 'teacher') {
    renderTeacherHome();
    showView('teacherHomeView');
  }
});

boot();
