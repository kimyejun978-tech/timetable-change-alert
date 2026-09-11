(() => {
  const Backend = window.OneulPEBackend;
  if (!Backend || !Backend.loginTeacher) return;

  function projectRef() {
    const url = String(window.ONEUL_PE_CONFIG?.SUPABASE_URL || '');
    return url.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1] || '';
  }

  function accessToken() {
    const ref = projectRef();
    if (!ref) return null;
    try {
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.access_token || parsed?.currentSession?.access_token || null;
    } catch {
      return null;
    }
  }

  async function getApprovalContext() {
    const config = window.ONEUL_PE_CONFIG || {};
    const token = accessToken();
    if (!Backend.remoteEnabled || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !token) return null;

    const response = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/get_my_teacher_approval_context`, {
      method: 'POST',
      headers: {
        apikey: config.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!response.ok) return null;
    return response.json();
  }

  const originalLoginTeacher = Backend.loginTeacher.bind(Backend);
  Backend.loginTeacher = async (input) => {
    const result = await originalLoginTeacher(input);
    if (!Backend.remoteEnabled || result?.status !== 'pending') return result;

    try {
      const context = await getApprovalContext();
      if (!context) return result;
      return {
        ...result,
        approvalRoute: context.approvalRoute || null,
        status: context.approvalRoute === 'operator' ? 'pending_initial_admin' : 'pending',
      };
    } catch (error) {
      console.warn('교사 승인 경로 확인 실패', error);
      return result;
    }
  };

  Backend.getTeacherApprovalContext = getApprovalContext;
})();
