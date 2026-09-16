const {
  escapeHTML,
  localDateKey,
  formatDateKo,
  showToast,
  fetchPeTimetable,
  geocodeSchool,
  fetchWeather,
  weatherCodeInfo,
} = window.OneulPE;
const Backend = window.OneulPEBackend;

const DEFAULT_PERIOD_TIMES = {
  '1': '09:00', '2': '10:00', '3': '11:00', '4': '12:00',
  '5': '13:30', '6': '14:30', '7': '15:30', '8': '16:30',
};

function offsetDateKey(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

async function bootTeacherPortal() {
  try {
    const profile = await Backend.getTeacherSession();
    if (!profile?.verified) {
      window.location.replace('./teacher-login.html');
      return;
    }
    await startTeacherPortal(profile);
  } catch (error) {
    console.error(error);
    window.location.replace('./teacher-login.html');
  }
}

async function startTeacherPortal(profile) {
  let lessons = [];
  let schoolTeachers = [];
  let filterMode = 'all';
  let scheduleRows = [];
  let scheduleProvider = null;
  let periodTimes = { ...DEFAULT_PERIOD_TIMES };
  let weatherForecast = null;
  let schoolGeo = null;

  const overlay = document.getElementById('lessonEditorOverlay');
  const lessonForm = document.getElementById('lessonForm');
  const deleteButton = document.getElementById('deleteLessonButton');
  const list = document.getElementById('teacherLessonList');
  const allFilter = document.getElementById('allLessonsFilter');
  const myFilter = document.getElementById('myLessonsFilter');
  const scheduleList = document.getElementById('peSchedule');
  const scheduleStatus = document.getElementById('scheduleStatus');
  const providerBadge = document.getElementById('scheduleProviderBadge');
  const weatherStatus = document.getElementById('weatherStatus');
  const teacherChoices = document.getElementById('lessonTeacherChoices');
  const historySection = document.getElementById('lessonHistorySection');
  const historyList = document.getElementById('lessonHistoryList');

  document.getElementById('teacherSchoolBadge').textContent = profile.school.SCHUL_NM;
  document.getElementById('teacherSchoolName').textContent = profile.school.SCHUL_NM;
  document.getElementById('teacherSchoolAddress').textContent = `${profile.school.LCTN_SC_NM || ''} · ${profile.school.ORG_RDNMA || ''}`;
  document.getElementById('teacherIdentity').textContent = `${profile.name} 선생님`;
  document.getElementById('teacherRoleLabel').textContent = profile.role === 'school_admin' ? '학교 관리자' : '체육교사';
  document.getElementById('teacherTodayLabel').textContent = formatDateKo(new Date());
  document.getElementById('teacherBackendMode').textContent = Backend.modeLabel;

  function getTeacherNames(lesson) {
    if (Array.isArray(lesson.teacherNames) && lesson.teacherNames.length) return lesson.teacherNames;
    return [lesson.teacherName || '체육교사'];
  }

  function isMine(lesson) {
    if (Array.isArray(lesson.teacherIds)) return lesson.teacherIds.includes(profile.teacherId);
    return lesson.teacherId === profile.teacherId;
  }

  function findConfiguredLesson(row) {
    return lessons.find((lesson) => (
      lesson.date === localDateKey()
      && String(lesson.grade) === String(row.grade)
      && String(lesson.classNo) === String(row.classNo)
      && String(lesson.period) === String(row.period)
    ));
  }

  async function refreshLessons(showMessage = false) {
    try {
      lessons = await Backend.listTeacherLessons({
        profile,
        from: offsetDateKey(-7),
        to: offsetDateKey(14),
      });
      renderLessons();
      renderSchedule();
      if (showMessage) showToast('최신 수업 안내를 불러왔어요.');
    } catch (error) {
      console.error(error);
      showToast('등록된 수업 안내를 불러오지 못했습니다.');
    }
  }

  async function loadSchoolTeachers() {
    try {
      schoolTeachers = await Backend.listSchoolTeachers(profile);
    } catch (error) {
      console.error(error);
      schoolTeachers = [{ teacherId: profile.teacherId, name: profile.name, role: profile.role, isMe: true }];
    }
  }

  function renderLessons() {
    const today = localDateKey();
    let todayLessons = lessons
      .filter((lesson) => lesson.date === today)
      .sort((a, b) => Number(a.period) - Number(b.period)
        || Number(a.grade) - Number(b.grade)
        || Number(a.classNo) - Number(b.classNo));

    if (filterMode === 'mine') todayLessons = todayLessons.filter(isMine);

    list.innerHTML = '';
    if (!todayLessons.length) {
      list.innerHTML = `<p class="muted">${filterMode === 'mine' ? '오늘 내 수업으로 등록된 체육수업이 없습니다.' : '오늘 등록된 체육수업 안내가 없습니다.'}</p>`;
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

  async function loadPendingTeachers() {
    if (profile.role !== 'school_admin') return;
    const card = document.getElementById('teacherApprovalCard');
    const pendingList = document.getElementById('pendingTeacherList');
    card.classList.remove('hidden');
    pendingList.innerHTML = '<p class="muted">승인 대기 교사를 확인하는 중입니다…</p>';
    try {
      const pending = await Backend.listPendingTeachers(profile);
      if (!pending.length) {
        pendingList.innerHTML = '<p class="muted">현재 승인 대기 중인 교사가 없습니다.</p>';
        return;
      }
      pendingList.innerHTML = '';
      pending.forEach((teacher) => {
        const item = document.createElement('article');
        item.className = 'teacher-lesson-item';
        item.innerHTML = `
          <div><strong>${escapeHTML(teacher.name)}</strong><small>${escapeHTML(teacher.email || '')}</small></div>
          <div class="actions"><button class="primary-button" type="button" data-approve-teacher="${escapeHTML(teacher.teacherId)}">승인</button></div>
        `;
        pendingList.appendChild(item);
      });
      pendingList.querySelectorAll('[data-approve-teacher]').forEach((button) => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await Backend.approveTeacher(profile, button.dataset.approveTeacher);
            showToast('교사를 승인했습니다.');
            await Promise.all([loadPendingTeachers(), loadSchoolTeachers()]);
          } catch (error) {
            console.error(error);
            showToast(error?.message || '교사 승인에 실패했습니다.');
          } finally {
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      console.error(error);
      pendingList.innerHTML = '<p class="muted">승인 대기 목록을 불러오지 못했습니다.</p>';
    }
  }

  if (profile.role === 'school_admin') {
    document.getElementById('refreshPendingTeachersButton').addEventListener('click', loadPendingTeachers);
    loadPendingTeachers();
  }

  function normalizeDirectNeis(result) {
    return {
      provider: 'neis-direct',
      rows: result.rows.map((row) => ({
        grade: Number(row.GRADE),
        classNo: Number(row.CLASS_NM),
        period: Number(row.PERIO),
        subject: row.ITRT_CNTNT || '체육',
        teacher: '',
        classroom: '',
        changed: false,
      })),
      periodTimes: [],
      warning: result.sampleLimited
        ? '개발 모드 NEIS 조회는 최대 5건 제한 때문에 일부 체육수업이 빠질 수 있습니다.'
        : null,
      fallbackUsed: true,
    };
  }

  async function fetchPreferredSchedule() {
    const params = new URLSearchParams({
      schoolName: profile.school.SCHUL_NM,
      region: profile.school.LCTN_SC_NM || '',
      officeCode: profile.school.ATPT_OFCDC_SC_CODE || '',
      schoolCode: profile.school.SD_SCHUL_CODE || '',
      date: localDateKey().replaceAll('-', ''),
    });

    try {
      const response = await fetch(`/api/timetable?${params.toString()}`);
      if (!response.ok) throw new Error(`Preferred timetable API HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('컴시간 중계 API를 사용할 수 없어 브라우저 NEIS fallback을 사용합니다.', error);
      const directNeis = await fetchPeTimetable(profile.school, new Date());
      return normalizeDirectNeis(directNeis);
    }
  }

  function providerLabel(provider) {
    if (provider === 'comcigan') return '컴시간알리미';
    if (provider === 'neis') return 'NEIS fallback';
    if (provider === 'neis-direct') return 'NEIS 직접 fallback';
    return '시간표 데이터';
  }

  function updatePeriodTimes(times = []) {
    periodTimes = { ...DEFAULT_PERIOD_TIMES };
    times.forEach((item) => {
      if (item?.number && item?.start) periodTimes[String(item.number)] = item.start;
    });
  }

  function getPeriodWeather(period) {
    if (!weatherForecast?.hourly?.time?.length) return null;
    const start = periodTimes[String(period)] || DEFAULT_PERIOD_TIMES[String(period)] || '09:00';
    const [hourText, minuteText = '0'] = String(start).split(':');
    let hour = Number(hourText);
    if (Number(minuteText) >= 30) hour += 1;
    const target = `${localDateKey()}T${String(hour).padStart(2, '0')}:00`;
    const index = weatherForecast.hourly.time.indexOf(target);
    if (index < 0) return null;
    return {
      time: start,
      temperature: weatherForecast.hourly.temperature_2m?.[index],
      rainProbability: weatherForecast.hourly.precipitation_probability?.[index],
      code: weatherForecast.hourly.weather_code?.[index],
    };
  }

  function renderSchedule() {
    scheduleList.innerHTML = '';
    if (!scheduleRows.length) {
      scheduleList.innerHTML = '<p class="muted">오늘 확인된 체육수업이 없습니다.</p>';
      return;
    }

    scheduleRows.forEach((row, index) => {
      const configured = findConfiguredLesson(row);
      const weather = getPeriodWeather(row.period);
      const weatherInfo = weather ? weatherCodeInfo(weather.code) : null;
      const rainRisk = weather && Number(weather.rainProbability) >= 60;
      const outdoor = configured && /운동장|야외|외부/.test(configured.location || '');
      const item = document.createElement('article');
      item.className = `schedule-item${rainRisk && outdoor ? ' weather-risk' : ''}`;

      const weatherText = weather
        ? `${weatherInfo.icon} ${escapeHTML(weather.time)} · ${Math.round(weather.temperature)}℃ · 강수 ${Math.round(weather.rainProbability ?? 0)}%`
        : '날씨 불러오는 중';
      const teacherText = row.teacher ? `${escapeHTML(row.teacher)} 선생님` : '';
      const roomText = row.classroom ? ` · ${escapeHTML(row.classroom)}` : '';
      const changedText = row.changed ? '<span class="change-chip">시간표 변경됨</span>' : '';

      let action = `<button type="button" class="ghost-button" data-schedule-index="${index}">안내 등록</button>`;
      if (configured) {
        action = isMine(configured)
          ? `<button type="button" class="ghost-button" data-edit-id="${escapeHTML(configured.id)}">내 안내 수정</button>`
          : `<span class="read-only-label">${escapeHTML(getTeacherNames(configured).join(', '))} 등록</span>`;
      }

      item.innerHTML = `
        <div class="schedule-period"><strong>${escapeHTML(row.period)}교시</strong><small>${escapeHTML(periodTimes[String(row.period)] || '')}</small></div>
        <div class="schedule-main">
          <div class="schedule-title-line"><strong>${escapeHTML(row.grade)}-${escapeHTML(row.classNo)} · ${escapeHTML(row.subject)}</strong>${changedText}</div>
          <small>${teacherText}${roomText}</small>
          <span class="period-weather">${weatherText}</span>
          ${rainRisk && outdoor ? '<span class="weather-warning">⚠️ 야외수업 우천 확인 필요</span>' : ''}
        </div>
        <div class="schedule-action">${action}</div>
      `;
      scheduleList.appendChild(item);
    });

    scheduleList.querySelectorAll('[data-schedule-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const row = scheduleRows[Number(button.dataset.scheduleIndex)];
        if (!row) return;
        openEditor(null, {
          date: localDateKey(),
          period: row.period,
          grade: row.grade,
          classNo: row.classNo,
          activity: row.subject === '체육' ? '' : row.subject,
          location: row.classroom || '',
        });
      });
    });
    scheduleList.querySelectorAll('[data-edit-id]').forEach((button) => {
      button.addEventListener('click', () => openEditor(button.dataset.editId));
    });
  }

  async function loadSchedule() {
    scheduleStatus.textContent = '컴시간알리미에서 오늘 시간표를 확인하고 있어요…';
    providerBadge.classList.add('hidden');
    scheduleList.innerHTML = '';
    try {
      const result = await fetchPreferredSchedule();
      scheduleRows = Array.isArray(result.rows) ? result.rows : [];
      scheduleProvider = result.provider || 'unknown';
      updatePeriodTimes(result.periodTimes || []);
      providerBadge.textContent = `현재 데이터: ${providerLabel(scheduleProvider)}`;
      providerBadge.classList.remove('hidden');
      scheduleStatus.textContent = scheduleProvider === 'comcigan'
        ? `컴시간알리미 기준으로 오늘 체육수업 ${scheduleRows.length}개를 찾았습니다.`
        : `컴시간 조회가 되지 않아 ${providerLabel(scheduleProvider)}로 전환했습니다. 체육수업 ${scheduleRows.length}개를 찾았습니다.`;
      if (result.warning) scheduleStatus.textContent += ` ${result.warning}`;
      renderSchedule();
    } catch (error) {
      console.error(error);
      scheduleRows = [];
      scheduleStatus.textContent = '컴시간과 NEIS 모두에서 시간표를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
      renderSchedule();
    }
  }

  function renderWeatherSummary() {
    if (!weatherForecast) return;
    const current = weatherForecast.current || {};
    const todayIndex = weatherForecast.daily?.time?.indexOf(localDateKey()) ?? -1;
    const info = weatherCodeInfo(current.weather_code);
    document.getElementById('weatherIcon').textContent = info.icon;
    document.getElementById('weatherTemp').textContent = Number.isFinite(current.temperature_2m) ? `${Math.round(current.temperature_2m)}℃` : '--℃';
    document.getElementById('weatherDescription').textContent = info.label;
    if (todayIndex >= 0) {
      const high = weatherForecast.daily.temperature_2m_max?.[todayIndex];
      const low = weatherForecast.daily.temperature_2m_min?.[todayIndex];
      const rain = weatherForecast.daily.precipitation_probability_max?.[todayIndex];
      document.getElementById('weatherHighLow').textContent = `${Math.round(high)}℃ / ${Math.round(low)}℃`;
      document.getElementById('weatherRainMax').textContent = `${Math.round(rain ?? 0)}%`;
    }
    document.getElementById('weatherSummary').classList.remove('hidden');
    if (schoolGeo) {
      document.getElementById('weatherSource').textContent = `학교 위치 ${schoolGeo.lat.toFixed(4)}, ${schoolGeo.lon.toFixed(4)} · ${schoolGeo.source} · 날씨 Open-Meteo`;
    }
    renderSchedule();
  }

  async function loadWeather() {
    weatherStatus.textContent = '학교 주소를 기준으로 위치와 날씨를 확인하고 있어요…';
    document.getElementById('weatherSummary').classList.add('hidden');
    try {
      schoolGeo = await geocodeSchool(profile.school);
      if (!schoolGeo) throw new Error('학교 위치를 찾지 못했습니다.');
      weatherForecast = await fetchWeather(schoolGeo.lat, schoolGeo.lon);
      weatherStatus.textContent = '학교 위치 기준 현재 날씨와 각 체육 교시의 시간대 예보입니다.';
      renderWeatherSummary();
    } catch (error) {
      console.error(error);
      weatherStatus.textContent = '학교 위치 또는 날씨를 불러오지 못했습니다.';
    }
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

  function renderTeacherChoices(selectedIds = [profile.teacherId]) {
    const selected = new Set(selectedIds?.length ? selectedIds : [profile.teacherId]);
    teacherChoices.innerHTML = '';
    if (!schoolTeachers.length) {
      teacherChoices.innerHTML = '<p class="muted">승인된 교사 목록을 불러오지 못했습니다.</p>';
      return;
    }

    schoolTeachers.forEach((teacher) => {
      const label = document.createElement('label');
      label.className = 'teacher-choice-card';
      const checked = selected.has(teacher.teacherId);
      const lockSelf = teacher.teacherId === profile.teacherId && profile.role !== 'school_admin';
      label.innerHTML = `
        <input type="checkbox" name="lessonTeacher" value="${escapeHTML(teacher.teacherId)}" ${checked ? 'checked' : ''} ${lockSelf ? 'disabled' : ''} />
        <span>
          <strong>${escapeHTML(teacher.name)}${teacher.teacherId === profile.teacherId ? ' · 나' : ''}</strong>
          <small>${teacher.role === 'school_admin' ? '학교 관리자' : '체육교사'}</small>
        </span>
      `;
      teacherChoices.appendChild(label);
    });
  }

  function historyValue(snapshot, key, alternate = null) {
    if (!snapshot) return undefined;
    if (snapshot[key] !== undefined) return snapshot[key];
    if (alternate && snapshot[alternate] !== undefined) return snapshot[alternate];
    return undefined;
  }

  function describeHistory(change) {
    if (change.changeType === 'create') return '수업 안내를 처음 등록했습니다.';
    if (change.changeType === 'delete') return '수업 안내를 삭제했습니다.';
    if (change.changeType === 'teachers') return '공동 담당 교사를 변경했습니다.';

    const before = change.beforeData || {};
    const after = change.afterData || {};
    const diffs = [];
    const fields = [
      ['activity', 'activity', '종목'],
      ['location', 'location', '장소'],
      ['period', 'period', '교시'],
      ['lesson_date', 'date', '날짜'],
    ];
    fields.forEach(([remoteKey, localKey, label]) => {
      const oldValue = historyValue(before, localKey, remoteKey);
      const newValue = historyValue(after, localKey, remoteKey);
      if (String(oldValue ?? '') !== String(newValue ?? '')) diffs.push(`${label} ${oldValue || '미정'} → ${newValue || '미정'}`);
    });
    const oldEquipment = historyValue(before, 'equipment') || [];
    const newEquipment = historyValue(after, 'equipment') || [];
    if (JSON.stringify(oldEquipment) !== JSON.stringify(newEquipment)) diffs.push('준비물 변경');
    if ((historyValue(before, 'notice') || '') !== (historyValue(after, 'notice') || '')) diffs.push('추가 안내 변경');
    return diffs.length ? diffs.join(' · ') : '수업 안내를 수정했습니다.';
  }

  function formatHistoryTime(value) {
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(new Date(value));
  }

  async function renderLessonHistory(lessonId) {
    if (!lessonId) {
      historySection.classList.add('hidden');
      return;
    }
    historySection.classList.remove('hidden');
    historyList.innerHTML = '<p class="muted">변경 이력을 불러오는 중입니다…</p>';
    try {
      const history = await Backend.listLessonHistory({ profile, lessonId });
      if (!history.length) {
        historyList.innerHTML = '<p class="muted">아직 기록된 변경 이력이 없습니다.</p>';
        return;
      }
      historyList.innerHTML = history.slice(0, 20).map((change) => `
        <article class="history-item">
          <strong>${escapeHTML(describeHistory(change))}</strong>
          <span>${escapeHTML(change.changedByName || '체육교사')}</span>
          <small>${escapeHTML(formatHistoryTime(change.createdAt))}</small>
        </article>
      `).join('');
    } catch (error) {
      console.error(error);
      historyList.innerHTML = '<p class="muted">변경 이력을 불러오지 못했습니다.</p>';
    }
  }

  async function openEditor(id = null, preset = null) {
    lessonForm.reset();
    clearChoiceButtons();
    document.getElementById('lessonId').value = '';
    document.getElementById('lessonDate').value = preset?.date || localDateKey();
    document.getElementById('editorTitle').textContent = '수업 등록';
    deleteButton.classList.add('hidden');
    historySection.classList.add('hidden');
    historyList.innerHTML = '';
    renderTeacherChoices([profile.teacherId]);

    if (preset) {
      document.getElementById('lessonPeriod').value = String(preset.period || '');
      document.getElementById('lessonGrade').value = String(preset.grade || '');
      document.getElementById('lessonClasses').value = String(preset.classNo || '');
      document.getElementById('lessonActivity').value = preset.activity || '';
      document.getElementById('lessonLocation').value = preset.location || '';
      syncChoiceButtons('activityChoices', preset.activity || '');
      syncChoiceButtons('locationChoices', preset.location || '');
    }

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
      renderTeacherChoices(lesson.teacherIds?.length ? lesson.teacherIds : [profile.teacherId]);
      document.getElementById('editorTitle').textContent = '내 수업 수정';
      deleteButton.classList.remove('hidden');
      renderLessonHistory(lesson.id);
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
  document.getElementById('refreshScheduleButton').addEventListener('click', loadSchedule);
  document.getElementById('refreshWeatherButton').addEventListener('click', loadWeather);
  document.getElementById('refreshLessonHistoryButton').addEventListener('click', () => {
    renderLessonHistory(document.getElementById('lessonId').value);
  });

  lessonForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const editingId = document.getElementById('lessonId').value || null;
    const classNos = [...new Set(document.getElementById('lessonClasses').value
      .split(',').map((value) => value.trim())
      .filter((value) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 30))];
    if (!classNos.length) {
      showToast('반 번호를 확인해주세요.');
      return;
    }

    let equipment = [...document.querySelectorAll('input[name="equipment"]:checked')].map((input) => input.value);
    if (equipment.includes('없음')) equipment = ['없음'];
    const teacherIds = [...document.querySelectorAll('input[name="lessonTeacher"]:checked')].map((input) => input.value);
    if (profile.role !== 'school_admin' && !teacherIds.includes(profile.teacherId)) teacherIds.push(profile.teacherId);
    if (!teacherIds.length) {
      showToast('담당 교사를 한 명 이상 선택해주세요.');
      return;
    }

    const base = {
      date: document.getElementById('lessonDate').value,
      period: document.getElementById('lessonPeriod').value,
      grade: document.getElementById('lessonGrade').value,
      activity: document.getElementById('lessonActivity').value.trim(),
      location: document.getElementById('lessonLocation').value.trim(),
      equipment,
      notice: document.getElementById('lessonNotice').value.trim(),
    };

    const submit = lessonForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const saved = await Backend.saveTeacherLessons({ profile, editingId, classNos, base });
      for (const lesson of saved) {
        await Backend.setLessonTeachers({ profile, lessonId: lesson.id, teacherIds });
      }
      closeEditor();
      await refreshLessons();
      showToast(`${classNos.length}개 반의 수업을 저장했습니다.`);
    } catch (error) {
      console.error(error);
      showToast(error?.message || '수업 저장에 실패했습니다.');
    } finally {
      submit.disabled = false;
    }
  });

  deleteButton.addEventListener('click', async () => {
    const id = document.getElementById('lessonId').value;
    if (!id || !window.confirm('이 수업을 삭제할까요?')) return;
    deleteButton.disabled = true;
    try {
      await Backend.deleteTeacherLesson({ profile, lessonId: id });
      closeEditor();
      await refreshLessons();
      showToast('수업을 삭제했습니다.');
    } catch (error) {
      console.error(error);
      showToast(error?.message || '수업 삭제에 실패했습니다.');
    } finally {
      deleteButton.disabled = false;
    }
  });

  document.getElementById('teacherLogoutButton').addEventListener('click', async () => {
    await Backend.logoutTeacher();
    window.location.replace('./teacher-login.html');
  });

  await loadSchoolTeachers();
  await refreshLessons();
  Promise.allSettled([loadSchedule(), loadWeather()]);

  if (Backend.remoteEnabled) {
    Backend.subscribeToLessons(() => refreshLessons(false));
  }
}

bootTeacherPortal();
