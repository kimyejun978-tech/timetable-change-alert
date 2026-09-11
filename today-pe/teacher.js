const {
  STORAGE,
  readJSON,
  writeJSON,
  escapeHTML,
  localDateKey,
  formatDateKo,
  showToast,
} = window.OneulPE;

const session = readJSON(sessionStorage, STORAGE.teacherSession, null);
const teacherProfiles = readJSON(localStorage, STORAGE.teacherProfiles, []);
const authorizedTeacher = session && teacherProfiles.find((teacher) => (
  teacher.id === session.teacherId
  && teacher.schoolCode === session.schoolCode
  && teacher.email === session.email
));

if (!authorizedTeacher) {
  window.location.replace('./teacher-login.html');
} else {
  startTeacherPortal();
}

function startTeacherPortal() {
  let lessons = readJSON(localStorage, STORAGE.lessons, []);
  let filterMode = 'all';

  const overlay = document.getElementById('lessonEditorOverlay');
  const lessonForm = document.getElementById('lessonForm');
  const deleteButton = document.getElementById('deleteLessonButton');
  const list = document.getElementById('teacherLessonList');
  const allFilter = document.getElementById('allLessonsFilter');
  const myFilter = document.getElementById('myLessonsFilter');

  document.getElementById('teacherSchoolBadge').textContent = session.school.SCHUL_NM;
  document.getElementById('teacherSchoolName').textContent = session.school.SCHUL_NM;
  document.getElementById('teacherSchoolAddress').textContent = `${session.school.LCTN_SC_NM || ''} · ${session.school.ORG_RDNMA || ''}`;
  document.getElementById('teacherIdentity').textContent = `${session.name} 선생님`;
  document.getElementById('teacherTodayLabel').textContent = formatDateKo(new Date());

  function getTeacherNames(lesson) {
    if (Array.isArray(lesson.teacherNames) && lesson.teacherNames.length) return lesson.teacherNames;
    return [lesson.teacherName || '체육교사'];
  }

  function isMine(lesson) {
    if (Array.isArray(lesson.teacherIds)) return lesson.teacherIds.includes(session.teacherId);
    return lesson.teacherId === session.teacherId;
  }

  function renderLessons() {
    lessons = readJSON(localStorage, STORAGE.lessons, []);
    const today = localDateKey();
    let todayLessons = lessons
      .filter((lesson) => lesson.schoolCode === session.schoolCode && lesson.date === today)
      .sort((a, b) => Number(a.period) - Number(b.period)
        || Number(a.grade) - Number(b.grade)
        || Number(a.classNo) - Number(b.classNo));

    if (filterMode === 'mine') todayLessons = todayLessons.filter(isMine);

    list.innerHTML = '';
    if (!todayLessons.length) {
      list.innerHTML = `<p class="muted">${filterMode === 'mine' ? '오늘 내 수업으로 등록된 체육수업이 없습니다.' : '오늘 등록된 체육수업이 없습니다.'}</p>`;
      return;
    }

    todayLessons.forEach((lesson) => {
      const mine = isMine(lesson);
      const item = document.createElement('article');
      item.className = `teacher-lesson-item${mine ? ' mine' : ''}`;
      item.innerHTML = `
        <div class="lesson-row-main">
          <div class="period-badge">${escapeHTML(lesson.period)}교시</div>
          <div>
            <strong>${escapeHTML(lesson.grade)}-${escapeHTML(lesson.classNo)} · ${escapeHTML(lesson.activity)}</strong>
            <small>${escapeHTML(lesson.location)}${lesson.equipment?.length ? ` · ${escapeHTML(lesson.equipment.join(', '))}` : ''}</small>
            <small class="teacher-owner">담당: ${escapeHTML(getTeacherNames(lesson).join(', '))}</small>
          </div>
        </div>
        <div class="actions">
          ${mine ? `<button type="button" class="ghost-button" data-edit-id="${escapeHTML(lesson.id)}">수정</button>` : '<span class="read-only-label">조회만 가능</span>'}
        </div>
      `;
      list.appendChild(item);
    });

    list.querySelectorAll('[data-edit-id]').forEach((button) => {
      button.addEventListener('click', () => openEditor(button.dataset.editId));
    });
  }

  function setFilter(next) {
    filterMode = next;
    allFilter.classList.toggle('selected', next === 'all');
    myFilter.classList.toggle('selected', next === 'mine');
    renderLessons();
  }

  allFilter.addEventListener('click', () => setFilter('all'));
  myFilter.addEventListener('click', () => setFilter('mine'));

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
    document.getElementById(inputId).addEventListener('input', (event) => {
      syncChoiceButtons(groupId, event.target.value);
    });
  }

  wireChoiceGroup('activityChoices', 'lessonActivity');
  wireChoiceGroup('locationChoices', 'lessonLocation');

  function openEditor(id = null) {
    lessonForm.reset();
    clearChoiceButtons();
    document.getElementById('lessonId').value = '';
    document.getElementById('lessonDate').value = localDateKey();
    document.getElementById('editorTitle').textContent = '수업 등록';
    deleteButton.classList.add('hidden');

    if (id) {
      const lesson = lessons.find((item) => item.id === id);
      if (!lesson || !isMine(lesson)) {
        showToast('다른 선생님의 수업은 수정할 수 없습니다.');
        return;
      }

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
      document.getElementById('editorTitle').textContent = '내 수업 수정';
      deleteButton.classList.remove('hidden');
    }

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeEditor() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('newLessonButton').addEventListener('click', () => openEditor());
  document.getElementById('editorCloseButton').addEventListener('click', closeEditor);

  lessonForm.addEventListener('submit', (event) => {
    event.preventDefault();
    lessons = readJSON(localStorage, STORAGE.lessons, []);

    const editingId = document.getElementById('lessonId').value;
    const classNos = [...new Set(document.getElementById('lessonClasses').value
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 30))];

    if (!classNos.length) {
      showToast('반 번호를 확인해주세요.');
      return;
    }

    let equipment = [...document.querySelectorAll('input[name="equipment"]:checked')].map((input) => input.value);
    if (equipment.includes('없음')) equipment = ['없음'];

    const base = {
      schoolCode: session.schoolCode,
      schoolName: session.school.SCHUL_NM,
      date: document.getElementById('lessonDate').value,
      period: document.getElementById('lessonPeriod').value,
      grade: document.getElementById('lessonGrade').value,
      activity: document.getElementById('lessonActivity').value.trim(),
      location: document.getElementById('lessonLocation').value.trim(),
      equipment,
      notice: document.getElementById('lessonNotice').value.trim(),
      teacherIds: [session.teacherId],
      teacherNames: [session.name],
      teacherId: session.teacherId,
      teacherName: session.name,
      updatedAt: new Date().toISOString(),
    };

    const conflicts = classNos.map((classNo) => lessons.find((lesson) => (
      lesson.id !== editingId
      && lesson.schoolCode === base.schoolCode
      && lesson.date === base.date
      && String(lesson.grade) === String(base.grade)
      && String(lesson.classNo) === String(classNo)
      && String(lesson.period) === String(base.period)
    ))).filter(Boolean);

    const foreignConflict = conflicts.find((lesson) => !isMine(lesson));
    if (foreignConflict) {
      showToast(`${foreignConflict.grade}-${foreignConflict.classNo} ${foreignConflict.period}교시는 ${getTeacherNames(foreignConflict).join(', ')} 선생님이 이미 등록했습니다.`);
      return;
    }

    if (editingId) {
      const index = lessons.findIndex((lesson) => lesson.id === editingId);
      if (index < 0 || !isMine(lessons[index])) {
        showToast('수정 권한이 없습니다.');
        closeEditor();
        return;
      }
      lessons.splice(index, 1);
    }

    classNos.forEach((classNo) => {
      const existingIndex = lessons.findIndex((lesson) => (
        lesson.schoolCode === base.schoolCode
        && lesson.date === base.date
        && String(lesson.grade) === String(base.grade)
        && String(lesson.classNo) === String(classNo)
        && String(lesson.period) === String(base.period)
        && isMine(lesson)
      ));

      const nextLesson = {
        ...base,
        classNo,
        id: existingIndex >= 0 ? lessons[existingIndex].id : crypto.randomUUID(),
      };

      if (existingIndex >= 0) lessons[existingIndex] = nextLesson;
      else lessons.push(nextLesson);
    });

    writeJSON(localStorage, STORAGE.lessons, lessons);
    closeEditor();
    renderLessons();
    showToast(`${classNos.length}개 반의 수업을 저장했습니다.`);
  });

  deleteButton.addEventListener('click', () => {
    const id = document.getElementById('lessonId').value;
    if (!id) return;
    const lesson = lessons.find((item) => item.id === id);
    if (!lesson || !isMine(lesson)) {
      showToast('삭제 권한이 없습니다.');
      return;
    }
    if (!window.confirm('이 수업을 삭제할까요?')) return;
    lessons = lessons.filter((item) => item.id !== id);
    writeJSON(localStorage, STORAGE.lessons, lessons);
    closeEditor();
    renderLessons();
    showToast('수업을 삭제했습니다.');
  });

  document.getElementById('teacherLogoutButton').addEventListener('click', () => {
    sessionStorage.removeItem(STORAGE.teacherSession);
    window.location.replace('./teacher-login.html');
  });

  renderLessons();
}
