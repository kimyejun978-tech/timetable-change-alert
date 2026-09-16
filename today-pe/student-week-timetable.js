(() => {
  const PROFILE_KEY = 'oneulPe.studentProfile.v2';
  const container = document.getElementById('weekLessonList');
  const refreshButton = document.getElementById('refreshStudentButton');
  const Backend = window.OneulPEBackend;
  const { localDateKey, escapeHTML } = window.OneulPE || {};
  if (!container || !Backend || !localDateKey || !escapeHTML) return;

  let observer = null;
  let refreshTimer = null;
  let requestSerial = 0;

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function mondayOf(date = new Date()) {
    const result = new Date(date);
    const weekday = result.getDay();
    const offset = weekday === 0 ? -6 : 1 - weekday;
    result.setDate(result.getDate() + offset);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function ymd(date) {
    return localDateKey(date).replaceAll('-', '');
  }

  function providerLabel(provider) {
    if (provider === 'comcigan') return '컴시간 기준';
    if (provider === 'neis') return 'NEIS 기준';
    return '시간표 기준';
  }

  function buildParams(profile, monday) {
    const school = profile.school;
    return new URLSearchParams({
      schoolName: school.SCHUL_NM || '',
      region: school.LCTN_SC_NM || '',
      officeCode: school.ATPT_OFCDC_SC_CODE || '',
      schoolCode: school.SD_SCHUL_CODE || '',
      date: ymd(monday),
      scope: 'week',
      grade: String(profile.grade),
      classNo: String(profile.classNo),
    });
  }

  function weekRange(monday) {
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return { from: localDateKey(monday), to: localDateKey(friday) };
  }

  async function fetchTeacherGuides(profile, monday) {
    const { from, to } = weekRange(monday);
    try {
      return await Backend.listStudentLessons({
        school: profile.school,
        grade: profile.grade,
        classNo: profile.classNo,
        from,
        to,
      });
    } catch (error) {
      console.warn('주간 교사 안내 조회 실패', error);
      return [];
    }
  }

  function lineForPeriod(period, scheduled, guide, provider) {
    if (guide) {
      const secondary = [guide.location, guide.notice].filter(Boolean).join(' · ');
      return `
        <div class="week-lesson-line">
          <strong>${escapeHTML(period)}교시 · ${escapeHTML(guide.activity || scheduled?.subject || '체육')}</strong>
          <small>${secondary ? `${escapeHTML(secondary)} · ` : ''}${escapeHTML(providerLabel(provider))}</small>
        </div>
      `;
    }

    return `
      <div class="week-lesson-line">
        <strong>${escapeHTML(period)}교시 · ${escapeHTML(scheduled?.subject || '체육')}</strong>
        <small>${escapeHTML(providerLabel(provider))}${scheduled?.teacher ? ` · 담당 ${escapeHTML(scheduled.teacher)}` : ''} · 수업 안내 미등록</small>
      </div>
    `;
  }

  function startObserving() {
    if (!observer) {
      observer = new MutationObserver(() => scheduleRefresh(120));
    }
    observer.observe(container, { childList: true, subtree: true });
  }

  function renderWeek({ monday, rows, guides, provider }) {
    const dayLabels = ['월', '화', '수', '목', '금'];
    observer?.disconnect();
    container.innerHTML = '';

    for (let i = 0; i < 5; i += 1) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const key = localDateKey(date);
      const scheduled = rows
        .filter((row) => row.date === key || Number(row.weekday) === i + 1)
        .sort((a, b) => Number(a.period) - Number(b.period));
      const dayGuides = guides
        .filter((lesson) => lesson.date === key)
        .sort((a, b) => Number(a.period) - Number(b.period));

      const scheduledByPeriod = new Map(scheduled.map((row) => [String(row.period), row]));
      const guideByPeriod = new Map(dayGuides.map((lesson) => [String(lesson.period), lesson]));
      const periods = [...new Set([...scheduledByPeriod.keys(), ...guideByPeriod.keys()])]
        .sort((a, b) => Number(a) - Number(b));

      const row = document.createElement('div');
      row.className = 'week-item';

      if (!periods.length) {
        row.innerHTML = `
          <div class="week-day">${dayLabels[i]}</div>
          <div class="week-main">
            <strong>체육 수업 없음</strong>
            <small>${date.getMonth() + 1}/${date.getDate()} · ${escapeHTML(providerLabel(provider))}</small>
          </div>
        `;
      } else {
        row.innerHTML = `
          <div class="week-day">${dayLabels[i]}</div>
          <div class="week-main">
            ${periods.map((period) => lineForPeriod(
              period,
              scheduledByPeriod.get(period),
              guideByPeriod.get(period),
              provider,
            )).join('')}
          </div>
        `;
      }

      container.appendChild(row);
    }

    startObserving();
  }

  async function refreshWeek() {
    const profile = readProfile();
    if (!profile?.school || !profile?.grade || !profile?.classNo) return;

    const serial = ++requestSerial;
    const monday = mondayOf(new Date());
    const params = buildParams(profile, monday);

    try {
      const [response, guides] = await Promise.all([
        fetch(`/api/timetable?${params.toString()}`),
        fetchTeacherGuides(profile, monday),
      ]);
      if (!response.ok) throw new Error(`Timetable API ${response.status}`);
      const result = await response.json();
      if (serial !== requestSerial) return;

      const rows = (Array.isArray(result.rows) ? result.rows : []).filter((row) => (
        String(row.grade) === String(profile.grade)
        && String(row.classNo) === String(profile.classNo)
      ));
      renderWeek({ monday, rows, guides, provider: result.provider || 'unknown' });
    } catch (error) {
      console.warn('주간 컴시간 시간표 조회 실패', error);
      // 기존 student.js가 그린 교사 안내는 그대로 유지한다.
    }
  }

  function scheduleRefresh(delay = 80) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshWeek, delay);
  }

  startObserving();
  scheduleRefresh(80);
  refreshButton?.addEventListener('click', () => scheduleRefresh(180));
  window.addEventListener('online', () => scheduleRefresh(120));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRefresh(120);
  });
})();
