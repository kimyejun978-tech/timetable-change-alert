window.OneulPEPush = (() => {
  const config = window.ONEUL_PE_CONFIG || {};
  const enabled = Boolean(
    config.SUPABASE_URL
    && config.SUPABASE_ANON_KEY
    && config.VAPID_PUBLIC_KEY
    && window.supabase?.createClient
  );

  const client = enabled
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
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
    if (!enabled || !lesson) return { status: 'skipped' };
    try {
      const { data } = await client.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return { status: 'no_session' };
      const message = messageFor(lesson, action);
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          grade: Number(lesson.grade),
          classNo: Number(lesson.classNo),
          title: message.title,
          body: message.body,
          url: './student.html',
          tag: `oneul-pe-${lesson.grade}-${lesson.classNo}`,
        }),
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

  return {
    enabled,
    sendForLesson,
  };
})();
