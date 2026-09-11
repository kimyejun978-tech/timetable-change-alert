window.OneulPEPush = (() => {
  const config = window.ONEUL_PE_CONFIG || {};
  const enabled = Boolean(
    config.SUPABASE_URL
    && config.SUPABASE_ANON_KEY
    && config.VAPID_PUBLIC_KEY
    && window.supabase?.createClient
  );
  const nativeFetch = window.fetch.bind(window);

  function headersObject(headers) {
    if (!headers) return {};
    if (headers instanceof Headers) return Object.fromEntries(headers.entries());
    if (Array.isArray(headers)) return Object.fromEntries(headers);
    return headers;
  }

  function requestBody(init) {
    if (!init?.body || typeof init.body !== 'string') return {};
    try { return JSON.parse(init.body); } catch { return {}; }
  }

  async function sendWithAuthorization(authorization, payload) {
    if (!enabled || !authorization) return { status: 'skipped' };
    try {
      const response = await nativeFetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorization,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.warn('Web Push send skipped/failed', response.status);
        return { status: 'failed', httpStatus: response.status };
      }
      return { status: 'sent', ...(await response.json()) };
    } catch (error) {
      console.warn('Web Push send failed', error);
      return { status: 'failed' };
    }
  }

  function installSupabaseRpcPushBridge() {
    if (!enabled || window.__oneulPePushBridgeInstalled) return;
    window.__oneulPePushBridgeInstalled = true;

    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url || '';
      const isSaveLesson = url.includes('/rest/v1/rpc/save_pe_lesson');
      const isDeleteLesson = url.includes('/rest/v1/rpc/delete_pe_lesson');
      const response = await nativeFetch(input, init);

      if (response.ok && (isSaveLesson || isDeleteLesson)) {
        const body = requestBody(init);
        const headers = headersObject(init.headers);
        const authorization = headers.Authorization || headers.authorization || '';

        if (isSaveLesson) {
          const action = body.p_id ? 'update' : 'create';
          void sendWithAuthorization(authorization, {
            action,
            grade: Number(body.p_grade),
            classNo: Number(body.p_class_number),
            title: action === 'create' ? '체육 안내가 등록됐어요' : '체육 안내가 변경됐어요',
            body: [
              `${body.p_grade}-${body.p_class_number}`,
              `${body.p_period}교시`,
              body.p_activity || '체육',
              body.p_location || '',
            ].filter(Boolean).join(' · '),
            url: './student.html',
            tag: `oneul-pe-${body.p_grade}-${body.p_class_number}`,
          });
        } else if (body.p_id) {
          void sendWithAuthorization(authorization, {
            action: 'delete',
            lessonId: body.p_id,
            title: '체육 안내가 취소됐어요',
            url: './student.html',
          });
        }
      }

      return response;
    };
  }

  const client = enabled
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: nativeFetch },
    })
    : null;

  function messageFor(lesson, action) {
    const titles = {
      create: '체육 안내가 등록됐어요',
      update: '체육 안내가 변경됐어요',
      delete: '체육 안내가 취소됐어요',
    };
    const body = [
      `${lesson.grade}-${lesson.classNo}`,
      `${lesson.period}교시`,
      lesson.activity || '체육',
      lesson.location || '',
    ].filter(Boolean).join(' · ');
    return { title: titles[action] || titles.update, body };
  }

  async function sendForLesson(lesson, action = 'update') {
    if (!enabled || !lesson || !client) return { status: 'skipped' };
    try {
      const { data } = await client.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return { status: 'no_session' };
      const message = messageFor(lesson, action);
      return sendWithAuthorization(`Bearer ${token}`, {
        action,
        grade: Number(lesson.grade),
        classNo: Number(lesson.classNo),
        lessonId: action === 'delete' ? lesson.id : undefined,
        title: message.title,
        body: message.body,
        url: './student.html',
        tag: `oneul-pe-${lesson.grade}-${lesson.classNo}`,
      });
    } catch (error) {
      console.warn('Web Push session lookup failed', error);
      return { status: 'failed' };
    }
  }

  installSupabaseRpcPushBridge();

  return {
    enabled,
    sendForLesson,
  };
})();
