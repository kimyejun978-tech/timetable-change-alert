window.OneulPEStudentResilience = (() => {
  const Backend = window.OneulPEBackend;
  const CACHE_KEY = 'oneulPe.studentRemoteCache.v1';
  const TIMETABLE_TTL_MS = 8 * 60 * 60 * 1000;
  const DATA_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  let lastFullRefreshAt = 0;
  let refreshTimer = null;
  let cacheNoticeShown = false;

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
  }

  function writeCache(cache) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  function cacheId(prefix, parts) {
    return `${prefix}:${parts.map((value) => String(value || '')).join(':')}`;
  }

  function schoolKey(school) {
    return `${school?.ATPT_OFCDC_SC_CODE || ''}:${school?.SD_SCHUL_CODE || ''}`;
  }

  function put(id, value) {
    const cache = readCache();
    cache[id] = { savedAt: Date.now(), value };
    const entries = Object.entries(cache)
      .sort((a, b) => Number(b[1]?.savedAt || 0) - Number(a[1]?.savedAt || 0))
      .slice(0, 40);
    writeCache(Object.fromEntries(entries));
  }

  function get(id, ttl = DATA_TTL_MS) {
    const entry = readCache()[id];
    if (!entry || !entry.savedAt || (Date.now() - entry.savedAt) > ttl) return null;
    return entry.value;
  }

  function announceCacheUse(label = '마지막 저장 정보') {
    const mode = document.getElementById('studentBackendMode');
    if (mode && !mode.textContent.includes('오프라인')) mode.textContent += ' · 오프라인 저장본';
    if (!cacheNoticeShown) {
      cacheNoticeShown = true;
      window.OneulPE?.showToast?.(`네트워크 연결이 불안정해 ${label}을 보여줘요.`);
    }
  }

  if (Backend) {
    const originalLessons = Backend.listStudentLessons.bind(Backend);
    Backend.listStudentLessons = async (args) => {
      const id = cacheId('lessons', [schoolKey(args.school), args.grade, args.classNo, args.from, args.to]);
      try {
        const value = await originalLessons(args);
        put(id, value);
        return value;
      } catch (error) {
        const cached = get(id);
        if (cached) {
          announceCacheUse('마지막 체육 안내');
          return cached;
        }
        throw error;
      }
    };

    const originalNotifications = Backend.listStudentNotifications.bind(Backend);
    Backend.listStudentNotifications = async (args) => {
      const id = cacheId('notifications', [schoolKey(args.school), args.grade, args.classNo]);
      try {
        const value = await originalNotifications(args);
        put(id, value);
        return value;
      } catch (error) {
        const cached = get(id);
        if (cached) {
          announceCacheUse('마지막 변경 알림');
          return cached;
        }
        throw error;
      }
    };
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const request = args[0];
    const rawUrl = typeof request === 'string' ? request : request?.url || '';
    const isTimetable = rawUrl.includes('/api/timetable?');
    if (!isTimetable) return nativeFetch(...args);

    const id = cacheId('timetable', [rawUrl]);
    try {
      const response = await nativeFetch(...args);
      if (response.ok) {
        const text = await response.clone().text();
        put(id, { status: response.status, contentType: response.headers.get('content-type') || 'application/json', text });
      }
      return response;
    } catch (error) {
      const cached = get(id, TIMETABLE_TTL_MS);
      if (!cached) throw error;
      announceCacheUse('마지막 시간표');
      return new Response(cached.text, {
        status: cached.status || 200,
        headers: { 'Content-Type': cached.contentType || 'application/json', 'X-OneulPE-Cache': '1' },
      });
    }
  };

  function requestFullRefresh(reason = 'auto') {
    const button = document.getElementById('refreshStudentButton');
    const home = document.getElementById('studentHomeView');
    if (!button || button.disabled || home?.classList.contains('hidden')) return;
    lastFullRefreshAt = Date.now();
    button.click();
    if (reason === 'online') window.OneulPE?.showToast?.('인터넷이 다시 연결되어 최신 정보를 확인해요.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    lastFullRefreshAt = Date.now();
    refreshTimer = setInterval(() => {
      if (!document.hidden && navigator.onLine && Date.now() - lastFullRefreshAt >= 90_000) {
        requestFullRefresh('interval');
      }
    }, 30_000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.onLine && Date.now() - lastFullRefreshAt >= 30_000) {
        requestFullRefresh('visible');
      }
    });

    window.addEventListener('online', () => requestFullRefresh('online'));
  });

  window.addEventListener('beforeunload', () => {
    if (refreshTimer) clearInterval(refreshTimer);
  });

  return { requestFullRefresh };
})();
