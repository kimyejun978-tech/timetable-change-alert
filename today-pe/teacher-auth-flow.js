(() => {
  const Backend = window.OneulPEBackend;
  const config = window.ONEUL_PE_CONFIG || {};
  const supabaseFactory = window.supabase?.createClient;
  const PENDING_KEY = 'oneulPe.pendingTeacherSignup.v1';
  const EMAIL_RETRY_COOLDOWN_MS = 10 * 60 * 1000;

  if (!Backend?.remoteEnabled || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !supabaseFactory) return;

  const client = supabaseFactory(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const originalLogoutTeacher = Backend.logoutTeacher.bind(Backend);

  function confirmationRedirectUrl() {
    const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (local) return `${window.location.origin}/today-pe/teacher-login.html`;
    return 'https://oneul-pe.vercel.app/today-pe/teacher-login.html';
  }

  function schoolCode(school) {
    return `${school?.ATPT_OFCDC_SC_CODE || ''}:${school?.SD_SCHUL_CODE || ''}`;
  }

  function pendingPayload({ school, name, email }, extra = {}) {
    return {
      name,
      email: String(email || '').trim().toLowerCase(),
      school: {
        ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
        SD_SCHUL_CODE: school.SD_SCHUL_CODE,
        SCHUL_NM: school.SCHUL_NM,
        LCTN_SC_NM: school.LCTN_SC_NM || '',
        ORG_RDNMA: school.ORG_RDNMA || '',
      },
      createdAt: Date.now(),
      emailSentAt: Number(extra.emailSentAt || 0),
      nextEmailAttemptAt: Number(extra.nextEmailAttemptAt || 0),
    };
  }

  function savePending(input, extra = {}) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pendingPayload(input, extra)));
  }

  function readPending() {
    try {
      const value = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
      if (!value?.school || !value?.email) return null;
      if (Date.now() - Number(value.createdAt || 0) > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(PENDING_KEY);
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  function clearPending() {
    localStorage.removeItem(PENDING_KEY);
  }

  function matchesPending(pending, { school, email }) {
    if (!pending) return false;
    return pending.email === String(email || '').trim().toLowerCase()
      && schoolCode(pending.school) === schoolCode(school);
  }

  function remainingEmailWaitSeconds(pending) {
    const remaining = Number(pending?.nextEmailAttemptAt || 0) - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  function isEmailRateLimitError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('email rate limit')
      || message.includes('rate limit exceeded')
      || message.includes('over_email_send_rate_limit');
  }

  function normalizeProfile(profile, email = '') {
    if (!profile) return null;
    const school = profile.school || {
      ATPT_OFCDC_SC_CODE: profile.neis_office_code,
      SD_SCHUL_CODE: profile.neis_school_code,
      SCHUL_NM: profile.school_name,
      LCTN_SC_NM: profile.school_region,
      ORG_RDNMA: profile.school_address,
    };
    return {
      teacherId: profile.teacher_id || profile.auth_user_id || profile.id,
      name: profile.name,
      email: profile.email || email,
      role: profile.role || 'teacher',
      verified: profile.verified !== false,
      schoolId: profile.school_id || null,
      school,
      schoolCode: `${school.ATPT_OFCDC_SC_CODE}:${school.SD_SCHUL_CODE}`,
    };
  }

  async function currentProfile() {
    const { data: authData, error: userError } = await client.auth.getUser();
    if (userError || !authData?.user) return null;
    const { data, error } = await client.rpc('get_my_teacher_profile');
    if (error) throw error;
    return normalizeProfile(data, authData.user.email || '');
  }

  async function registerProfile({ school, name }) {
    const { error } = await client.rpc('register_teacher_profile', {
      p_name: name,
      p_neis_office_code: school.ATPT_OFCDC_SC_CODE,
      p_neis_school_code: school.SD_SCHUL_CODE,
      p_school_name: school.SCHUL_NM,
      p_school_region: school.LCTN_SC_NM || '',
      p_school_address: school.ORG_RDNMA || '',
    });
    if (error) throw error;
  }

  async function finishPendingSignup() {
    const { data: authData, error: userError } = await client.auth.getUser();
    if (userError || !authData?.user) return null;

    const existing = await currentProfile();
    if (existing) {
      clearPending();
      return existing;
    }

    const pending = readPending();
    if (!pending) return null;
    if (pending.email !== String(authData.user.email || '').toLowerCase()) return null;

    await registerProfile(pending);
    clearPending();
    return currentProfile();
  }

  Backend.loginTeacher = async ({ school, name, email, password }) => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    let authResult = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (authResult.error) {
      const existingPending = readPending();
      if (matchesPending(existingPending, { school, email: normalizedEmail })) {
        const waitSeconds = remainingEmailWaitSeconds(existingPending);
        if (waitSeconds > 0) {
          return {
            status: 'confirmation_wait',
            retryAfterSeconds: waitSeconds,
            emailSent: Number(existingPending.emailSentAt || 0) > 0,
          };
        }
      }

      const nextEmailAttemptAt = Date.now() + EMAIL_RETRY_COOLDOWN_MS;
      savePending({ school, name, email: normalizedEmail }, {
        emailSentAt: Number(existingPending?.emailSentAt || 0),
        nextEmailAttemptAt,
      });

      const signUp = await client.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: confirmationRedirectUrl(),
          data: {
            teacher_name: name,
            app_name: '오늘체육',
            school_name: school.SCHUL_NM,
          },
        },
      });

      if (signUp.error) {
        if (isEmailRateLimitError(signUp.error)) {
          savePending({ school, name, email: normalizedEmail }, {
            emailSentAt: Number(existingPending?.emailSentAt || 0),
            nextEmailAttemptAt,
          });
          return {
            status: 'confirmation_rate_limited',
            retryAfterSeconds: Math.ceil(EMAIL_RETRY_COOLDOWN_MS / 1000),
          };
        }
        clearPending();
        throw signUp.error;
      }

      if (!signUp.data.session) {
        savePending({ school, name, email: normalizedEmail }, {
          emailSentAt: Date.now(),
          nextEmailAttemptAt,
        });
        return { status: 'confirmation_required' };
      }
      authResult = signUp;
    }

    let profile = await currentProfile();
    if (!profile) {
      await registerProfile({ school, name });
      clearPending();
      profile = await currentProfile();
    }

    if (!profile) throw new Error('교사 프로필을 불러오지 못했습니다.');
    if (!profile.verified) return { status: 'pending', profile };
    return { status: 'ok', profile };
  };

  Backend.getTeacherSession = async () => {
    const profile = await currentProfile();
    if (profile) return profile;
    return finishPendingSignup();
  };

  Backend.logoutTeacher = async () => {
    await Promise.allSettled([
      client.auth.signOut(),
      originalLogoutTeacher(),
    ]);
    clearPending();
  };

  Backend.confirmationRedirectUrl = confirmationRedirectUrl;
})();
