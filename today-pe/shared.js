window.OneulPE = (() => {
  const STORAGE = {
    studentProfile: 'oneulPe.studentProfile.v2',
    teacherProfiles: 'oneulPe.teacherProfiles.v2',
    teacherSession: 'oneulPe.teacherSession.v2',
    lessons: 'oneulPe.lessons.v2',
    lessonChanges: 'oneulPe.lessonChanges.v1',
    studentReadChanges: 'oneulPe.studentReadChanges.v1',
    schoolGeo: 'oneulPe.schoolGeo.v1',
  };

  const CONFIG = window.ONEUL_PE_CONFIG || {};

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

  function withNeisKey(params) {
    if (CONFIG.NEIS_API_KEY) params.set('KEY', CONFIG.NEIS_API_KEY);
    return params;
  }

  async function searchSchools(query) {
    const normalized = String(query || '').trim();
    if (normalized.length < 2) return [];

    try {
      const proxy = await fetch(`/api/schools?q=${encodeURIComponent(normalized)}`);
      if (proxy.ok) {
        const payload = await proxy.json();
        if (Array.isArray(payload.rows)) return payload.rows;
      }
      throw new Error(`School proxy HTTP ${proxy.status}`);
    } catch (error) {
      console.warn('학교검색 서버 프록시를 사용할 수 없어 NEIS 직접 조회로 전환합니다.', error);
    }

    const params = withNeisKey(new URLSearchParams({
      Type: 'json',
      pIndex: '1',
      pSize: CONFIG.NEIS_API_KEY ? '30' : '5',
      SCHUL_NM: normalized,
    }));

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

  function neisDateKey(date = new Date()) {
    return localDateKey(date).replaceAll('-', '');
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

  function extractTotalCount(dataset) {
    const head = dataset?.[0]?.head;
    if (!Array.isArray(head)) return null;
    const countEntry = head.find((entry) => Object.prototype.hasOwnProperty.call(entry, 'list_total_count'));
    return countEntry?.list_total_count ?? null;
  }

  function isPhysicalEducationSubject(subject = '') {
    const normalized = String(subject).replace(/\s+/g, ' ').trim();
    return [
      '체육',
      '운동과 건강',
      '스포츠 생활',
      '스포츠',
      '체육탐구',
      '체육 탐구',
    ].some((keyword) => normalized.includes(keyword));
  }

  async function fetchPeTimetable(school, date = new Date()) {
    const params = withNeisKey(new URLSearchParams({
      Type: 'json',
      pIndex: '1',
      pSize: CONFIG.NEIS_API_KEY ? '1000' : '5',
      ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
      SD_SCHUL_CODE: school.SD_SCHUL_CODE,
      ALL_TI_YMD: neisDateKey(date),
    }));

    const response = await fetch(`https://open.neis.go.kr/hub/hisTimetable?${params.toString()}`);
    if (!response.ok) throw new Error(`NEIS timetable HTTP ${response.status}`);
    const data = await response.json();
    const dataset = data?.hisTimetable;
    const allRows = dataset?.[1]?.row ?? [];
    const totalCount = extractTotalCount(dataset);
    const rows = allRows
      .filter((row) => isPhysicalEducationSubject(row.ITRT_CNTNT))
      .sort((a, b) => Number(a.PERIO) - Number(b.PERIO)
        || Number(a.GRADE) - Number(b.GRADE)
        || Number(a.CLASS_NM) - Number(b.CLASS_NM));

    return {
      rows,
      totalCount,
      receivedCount: allRows.length,
      sampleLimited: !CONFIG.NEIS_API_KEY && (totalCount === null || Number(totalCount) > allRows.length),
      hasApiKey: Boolean(CONFIG.NEIS_API_KEY),
    };
  }

  async function geocodeSchool(school) {
    const schoolCode = schoolCodeOf(school);
    const cache = readJSON(localStorage, STORAGE.schoolGeo, {});
    if (cache[schoolCode]?.lat && cache[schoolCode]?.lon) return cache[schoolCode];

    const query = school.ORG_RDNMA || `${school.SCHUL_NM} ${school.LCTN_SC_NM || ''}`;
    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'kr',
      'accept-language': 'ko',
      q: query,
    });

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      if (!response.ok) throw new Error(`Geocoding HTTP ${response.status}`);
      const rows = await response.json();
      if (rows?.[0]) {
        const result = {
          lat: Number(rows[0].lat),
          lon: Number(rows[0].lon),
          displayName: rows[0].display_name || query,
          source: 'OpenStreetMap Nominatim',
        };
        cache[schoolCode] = result;
        writeJSON(localStorage, STORAGE.schoolGeo, cache);
        return result;
      }
    } catch (error) {
      console.warn('Primary geocoding failed', error);
    }

    const fallbackParams = new URLSearchParams({
      name: school.SCHUL_NM,
      count: '5',
      language: 'ko',
      format: 'json',
    });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${fallbackParams.toString()}`);
    if (!response.ok) throw new Error(`Fallback geocoding HTTP ${response.status}`);
    const data = await response.json();
    const match = data?.results?.find((item) => item.country_code === 'KR') || data?.results?.[0];
    if (!match) return null;

    const result = {
      lat: Number(match.latitude),
      lon: Number(match.longitude),
      displayName: [match.name, match.admin1, match.admin2].filter(Boolean).join(' '),
      source: 'Open-Meteo geocoding',
    };
    cache[schoolCode] = result;
    writeJSON(localStorage, STORAGE.schoolGeo, cache);
    return result;
  }

  async function fetchWeather(lat, lon) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: 'Asia/Seoul',
      current: 'temperature_2m,weather_code,precipitation',
      hourly: 'temperature_2m,precipitation_probability,weather_code',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: '3',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
    return response.json();
  }

  function weatherCodeInfo(code) {
    const value = Number(code);
    if (value === 0) return { icon: '☀️', label: '맑음' };
    if ([1, 2].includes(value)) return { icon: '🌤️', label: '대체로 맑음' };
    if (value === 3) return { icon: '☁️', label: '흐림' };
    if ([45, 48].includes(value)) return { icon: '🌫️', label: '안개' };
    if ([51, 53, 55, 56, 57].includes(value)) return { icon: '🌦️', label: '이슬비' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return { icon: '🌧️', label: '비' };
    if ([71, 73, 75, 77, 85, 86].includes(value)) return { icon: '🌨️', label: '눈' };
    if ([95, 96, 99].includes(value)) return { icon: '⛈️', label: '뇌우' };
    return { icon: '🌡️', label: '날씨' };
  }

  return {
    STORAGE,
    CONFIG,
    readJSON,
    writeJSON,
    escapeHTML,
    schoolCodeOf,
    compactSchool,
    searchSchools,
    renderSchoolButton,
    localDateKey,
    neisDateKey,
    formatDateKo,
    formatUpdated,
    isPhysicalEducationSubject,
    fetchPeTimetable,
    geocodeSchool,
    fetchWeather,
    weatherCodeInfo,
    showToast,
  };
})();
