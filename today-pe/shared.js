window.OneulPE = (() => {
  const STORAGE = {
    studentProfile: 'oneulPe.studentProfile.v2',
    teacherProfiles: 'oneulPe.teacherProfiles.v2',
    teacherSession: 'oneulPe.teacherSession.v2',
    lessons: 'oneulPe.lessons.v2',
  };

  function readJSON(storage, key, fallback) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function escapeHTML(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function schoolCodeOf(school) {
    return `${school.ATPT_OFCDC_SC_CODE}:${school.SD_SCHUL_CODE}`;
  }

  function compactSchool(school) {
    return {
      ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
      SD_SCHUL_CODE: school.SD_SCHUL_CODE,
      SCHUL_NM: school.SCHUL_NM,
      SCHUL_KND_SC_NM: school.SCHUL_KND_SC_NM,
      LCTN_SC_NM: school.LCTN_SC_NM,
      ORG_RDNMA: school.ORG_RDNMA,
    };
  }

  async function searchSchools(query) {
    const params = new URLSearchParams({
      Type: 'json',
      pIndex: '1',
      pSize: '30',
      SCHUL_NM: query,
    });

    const response = await fetch(`https://open.neis.go.kr/hub/schoolInfo?${params.toString()}`);
    if (!response.ok) throw new Error(`NEIS HTTP ${response.status}`);
    const data = await response.json();
    return data?.schoolInfo?.[1]?.row ?? [];
  }

  function renderSchoolButton(school, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'school-item';
    button.innerHTML = `
      <strong>${escapeHTML(school.SCHUL_NM)}</strong>
      <span>${escapeHTML(school.SCHUL_KND_SC_NM || '')} · ${escapeHTML(school.LCTN_SC_NM || '')}</span>
      <span>${escapeHTML(school.ORG_RDNMA || '')}</span>
    `;
    button.addEventListener('click', () => onClick(compactSchool(school)));
    return button;
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
    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  return {
    STORAGE,
    readJSON,
    writeJSON,
    escapeHTML,
    schoolCodeOf,
    compactSchool,
    searchSchools,
    renderSchoolButton,
    localDateKey,
    formatDateKo,
    formatUpdated,
    showToast,
  };
})();
