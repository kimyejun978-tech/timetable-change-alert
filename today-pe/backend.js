window.OneulPEBackend = (() => {
  const { STORAGE, readJSON, writeJSON, schoolCodeOf } = window.OneulPE;
  const config = window.ONEUL_PE_CONFIG || {};
  const remoteEnabled = Boolean(
    config.SUPABASE_URL
    && config.SUPABASE_ANON_KEY
    && window.supabase?.createClient
  );
  const client = remoteEnabled
    ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
    : null;

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function normalizeTeacherProfile(profile) {
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
      email: profile.email || '',
      role: profile.role || 'teacher',
      verified: profile.verified !== false,
      schoolId: profile.school_id || null,
      school,
      schoolCode: profile.schoolCode || schoolCodeOf(school),
    };
  }

  function normalizeLesson(row) {
    return {
      id: row.id,
      schoolId: row.school_id || null,
      schoolCode: row.school_code || row.schoolCode,
      schoolName: row.school_name || row.schoolName,
      date: row.lesson_date || row.date,
      period: String(row.period),
      grade: String(row.grade),
      classNo: String(row.class_number ?? row.classNo),
      activity: row.activity || '',
      location: row.location || '',
      equipment: Array.isArray(row.equipment) ? row.equipment : [],
      notice: row.notice || '',
      teacherIds: row.teacher_ids || row.teacherIds || (row.teacher_id ? [row.teacher_id] : []),
      teacherNames: row.teacher_names || row.teacherNames || (row.teacher_name ? [row.teacher_name] : []),
      teacherId: row.teacher_id || row.created_by || row.teacherIds?.[0] || null,
      teacherName: row.teacher_name || row.teacherNames?.[0] || '',
      updatedAt: row.updated_at || row.updatedAt,
    };
  }

  function normalizeChange(row) {
    return {
      id: row.id,
      lessonId: row.lessonId || row.lesson_id || null,
      schoolCode: row.schoolCode || row.school_code || '',
      lessonDate: row.lessonDate || row.lesson_date || '',
      period: String(row.period || ''),
      grade: String(row.grade || ''),
      classNo: String(row.classNo ?? row.class_number ?? ''),
      changeType: row.changeType || row.change_type || 'update',
      changedByName: row.changedByName || row.changed_by_name || '',
      beforeData: row.beforeData ?? row.before_data ?? null,
      afterData: row.afterData ?? row.after_data ?? null,
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    };
  }

  function localChangeSnapshot(lesson) {
    if (!lesson) return null;
    return {
      id: lesson.id,
      date: lesson.date,
      period: lesson.period,
      grade: lesson.grade,
      classNo: lesson.classNo,
      activity: lesson.activity,
      location: lesson.location,
      equipment: Array.isArray(lesson.equipment) ? [...lesson.equipment] : [],
      notice: lesson.notice || '',
      teacherIds: Array.isArray(lesson.teacherIds) ? [...lesson.teacherIds] : [],
      teacherNames: Array.isArray(lesson.teacherNames) ? [...lesson.teacherNames] : [],
    };
  }

  function appendLocalChange(changes, { profile, lesson, changeType, beforeData = null, afterData = null }) {
    const source = afterData || beforeData || localChangeSnapshot(lesson) || {};
    changes.push({
      id: crypto.randomUUID(),
      lessonId: lesson?.id || source.id || null,
      schoolCode: profile.schoolCode,
      lessonDate: source.date || '',
      period: String(source.period || ''),
      grade: String(source.grade || ''),
      classNo: String(source.classNo || ''),
      changeType,
      changedByName: profile.name,
      beforeData,
      afterData,
      createdAt: new Date().toISOString(),
    });
  }

  async function remoteProfile() {
    const { data: authData } = await client.auth.getUser();
    if (!authData?.user) return null;
    const { data, error } = await client.rpc('get_my_teacher_profile');
    if (error) throw error;
    if (!data) return null;
    return normalizeTeacherProfile({ ...data, email: authData.user.email || '' });
  }

  async function localLogin({ school, name, email, password }) {
    const schoolCode = schoolCodeOf(school);
    const passwordHash = await sha256(password);
    const profiles = readJSON(localStorage, STORAGE.teacherProfiles, []);
    let teacher = profiles.find((item) => item.email === email && item.schoolCode === schoolCode);

    if (teacher) {
      const storedHash = teacher.passwordHash || teacher.pinHash;
      if (storedHash !== passwordHash) throw new Error('비밀번호가 일치하지 않습니다.');
      if (teacher.verified === undefined) teacher.verified = true;
      if (!teacher.role) teacher.role = 'teacher';
    } else {
      const schoolTeachers = profiles.filter((item) => item.schoolCode === schoolCode);
      const firstTeacher = schoolTeachers.length === 0;
      teacher = {
        id: crypto.randomUUID(),
        name,
        email,
        school,
        schoolCode,
        passwordHash,
        role: firstTeacher ? 'school_admin' : 'teacher',
        verified: firstTeacher,
        createdAt: new Date().toISOString(),
      };
      profiles.push(teacher);
    }

    const index = profiles.findIndex((item) => item.id === teacher.id);
    profiles[index] = teacher;
    writeJSON(localStorage, STORAGE.teacherProfiles, profiles);

    if (!teacher.verified) return { status: 'pending', profile: normalizeTeacherProfile(teacher) };

    const session = {
      teacherId: teacher.id,
      name: teacher.name,
      email: teacher.email,
      role: teacher.role,
      verified: teacher.verified,
      school: teacher.school,
      schoolCode: teacher.schoolCode,
      signedInAt: new Date().toISOString(),
    };
    writeJSON(sessionStorage, STORAGE.teacherSession, session);
    return { status: 'ok', profile: normalizeTeacherProfile(teacher) };
  }

  async function remoteLogin({ school, name, email, password }) {
    let authResult = await client.auth.signInWithPassword({ email, password });
    if (authResult.error) {
      const signUp = await client.auth.signUp({ email, password });
      if (signUp.error) throw signUp.error;
      if (!signUp.data.session) return { status: 'confirmation_required' };
      authResult = signUp;
    }

    const { error: registerError } = await client.rpc('register_teacher_profile', {
      p_name: name,
      p_neis_office_code: school.ATPT_OFCDC_SC_CODE,
      p_neis_school_code: school.SD_SCHUL_CODE,
      p_school_name: school.SCHUL_NM,
      p_school_region: school.LCTN_SC_NM || '',
      p_school_address: school.ORG_RDNMA || '',
    });
    if (registerError) throw registerError;

    const profile = await remoteProfile();
    if (!profile) throw new Error('교사 프로필을 불러오지 못했습니다.');
    if (!profile.verified) return { status: 'pending', profile };
    return { status: 'ok', profile };
  }

  async function loginTeacher(input) {
    const normalized = { ...input, email: input.email.trim().toLowerCase() };
    return remoteEnabled ? remoteLogin(normalized) : localLogin(normalized);
  }

  async function getTeacherSession() {
    if (remoteEnabled) return remoteProfile();
    const session = readJSON(sessionStorage, STORAGE.teacherSession, null);
    if (!session) return null;
    const profiles = readJSON(localStorage, STORAGE.teacherProfiles, []);
    const teacher = profiles.find((item) => item.id === session.teacherId && item.schoolCode === session.schoolCode);
    if (!teacher || teacher.verified === false) return null;
    return normalizeTeacherProfile({ ...teacher, email: teacher.email || session.email });
  }

  async function logoutTeacher() {
    if (remoteEnabled) await client.auth.signOut();
    sessionStorage.removeItem(STORAGE.teacherSession);
  }

  async function listStudentLessons({ school, grade, classNo, from, to }) {
    if (!remoteEnabled) {
      return readJSON(localStorage, STORAGE.lessons, [])
        .filter((lesson) => (
          lesson.schoolCode === schoolCodeOf(school)
          && String(lesson.grade) === String(grade)
          && String(lesson.classNo) === String(classNo)
          && lesson.date >= from
          && lesson.date <= to
        ));
    }

    const { data, error } = await client.rpc('get_student_lessons', {
      p_neis_office_code: school.ATPT_OFCDC_SC_CODE,
      p_neis_school_code: school.SD_SCHUL_CODE,
      p_grade: Number(grade),
      p_class_number: Number(classNo),
      p_from: from,
      p_to: to,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map(normalizeLesson);
  }

  async function listTeacherLessons({ profile, from, to }) {
    if (!remoteEnabled) {
      return readJSON(localStorage, STORAGE.lessons, [])
        .filter((lesson) => lesson.schoolCode === profile.schoolCode && lesson.date >= from && lesson.date <= to);
    }
    const { data, error } = await client.rpc('get_teacher_lessons', { p_from: from, p_to: to });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map(normalizeLesson);
  }

  async function saveTeacherLessons({ profile, editingId = null, classNos, base }) {
    if (!remoteEnabled) {
      let lessons = readJSON(localStorage, STORAGE.lessons, []);
      const changes = readJSON(localStorage, STORAGE.lessonChanges, []);
      const getIds = (lesson) => lesson.teacherIds || (lesson.teacherId ? [lesson.teacherId] : []);
      const isMine = (lesson) => getIds(lesson).includes(profile.teacherId);
      const originalEditing = editingId ? lessons.find((lesson) => lesson.id === editingId) : null;

      if (editingId && (!originalEditing || !isMine(originalEditing))) throw new Error('수정 권한이 없습니다.');

      const conflicts = classNos.map((classNo) => lessons.find((lesson) => (
        lesson.id !== editingId
        && lesson.schoolCode === profile.schoolCode
        && lesson.date === base.date
        && String(lesson.grade) === String(base.grade)
        && String(lesson.classNo) === String(classNo)
        && String(lesson.period) === String(base.period)
      ))).filter(Boolean);
      const foreignConflict = conflicts.find((lesson) => !isMine(lesson));
      if (foreignConflict) {
        const names = foreignConflict.teacherNames?.length ? foreignConflict.teacherNames : [foreignConflict.teacherName || '다른 교사'];
        throw new Error(`${foreignConflict.grade}-${foreignConflict.classNo} ${foreignConflict.period}교시는 ${names.join(', ')} 선생님이 이미 등록했습니다.`);
      }

      if (editingId) lessons = lessons.filter((lesson) => lesson.id !== editingId);

      const saved = [];
      classNos.forEach((classNo, index) => {
        const existingIndex = lessons.findIndex((lesson) => (
          lesson.schoolCode === profile.schoolCode
          && lesson.date === base.date
          && String(lesson.grade) === String(base.grade)
          && String(lesson.classNo) === String(classNo)
          && String(lesson.period) === String(base.period)
          && isMine(lesson)
        ));
        const existing = existingIndex >= 0 ? lessons[existingIndex] : null;
        const carryTeachers = index === 0 && originalEditing
          ? {
            teacherIds: originalEditing.teacherIds?.length ? originalEditing.teacherIds : [profile.teacherId],
            teacherNames: originalEditing.teacherNames?.length ? originalEditing.teacherNames : [profile.name],
          }
          : {
            teacherIds: existing?.teacherIds?.length ? existing.teacherIds : [profile.teacherId],
            teacherNames: existing?.teacherNames?.length ? existing.teacherNames : [profile.name],
          };
        const next = {
          ...base,
          classNo,
          schoolCode: profile.schoolCode,
          schoolName: profile.school.SCHUL_NM,
          ...carryTeachers,
          teacherId: carryTeachers.teacherIds[0],
          teacherName: carryTeachers.teacherNames[0],
          updatedAt: new Date().toISOString(),
          id: index === 0 && editingId ? editingId : (existing?.id || crypto.randomUUID()),
        };

        const before = index === 0 && originalEditing ? originalEditing : existing;
        if (existingIndex >= 0) lessons[existingIndex] = next;
        else lessons.push(next);
        appendLocalChange(changes, {
          profile,
          lesson: next,
          changeType: before ? 'update' : 'create',
          beforeData: localChangeSnapshot(before),
          afterData: localChangeSnapshot(next),
        });
        saved.push(next);
      });
      writeJSON(localStorage, STORAGE.lessons, lessons);
      writeJSON(localStorage, STORAGE.lessonChanges, changes);
      return saved;
    }

    const saved = [];
    for (let i = 0; i < classNos.length; i += 1) {
      const classNo = classNos[i];
      const { data, error } = await client.rpc('save_pe_lesson', {
        p_id: i === 0 ? (editingId || null) : null,
        p_lesson_date: base.date,
        p_period: Number(base.period),
        p_grade: Number(base.grade),
        p_class_number: Number(classNo),
        p_activity: base.activity,
        p_location: base.location,
        p_equipment: base.equipment,
        p_notice: base.notice || '',
      });
      if (error) {
        if (String(error.message).includes('SLOT_OWNED_BY_OTHER_TEACHER')) {
          throw new Error(`${base.grade}-${classNo} ${base.period}교시는 다른 선생님이 이미 등록했습니다.`);
        }
        throw error;
      }
      saved.push(normalizeLesson(data));
    }
    return saved;
  }

  async function deleteTeacherLesson({ profile, lessonId }) {
    if (!remoteEnabled) {
      let lessons = readJSON(localStorage, STORAGE.lessons, []);
      const changes = readJSON(localStorage, STORAGE.lessonChanges, []);
      const lesson = lessons.find((item) => item.id === lessonId);
      const ids = lesson?.teacherIds || (lesson?.teacherId ? [lesson.teacherId] : []);
      if (!lesson || !ids.includes(profile.teacherId)) throw new Error('삭제 권한이 없습니다.');
      appendLocalChange(changes, {
        profile,
        lesson,
        changeType: 'delete',
        beforeData: localChangeSnapshot(lesson),
        afterData: null,
      });
      lessons = lessons.filter((item) => item.id !== lessonId);
      writeJSON(localStorage, STORAGE.lessons, lessons);
      writeJSON(localStorage, STORAGE.lessonChanges, changes);
      return;
    }
    const { error } = await client.rpc('delete_pe_lesson', { p_id: lessonId });
    if (error) throw error;
  }

  async function listPendingTeachers(profile) {
    if (profile.role !== 'school_admin') return [];
    if (!remoteEnabled) {
      return readJSON(localStorage, STORAGE.teacherProfiles, [])
        .filter((teacher) => teacher.schoolCode === profile.schoolCode && teacher.verified === false)
        .map((teacher) => ({ teacherId: teacher.id, name: teacher.name, email: teacher.email, createdAt: teacher.createdAt }));
    }
    const { data, error } = await client.rpc('get_pending_teachers');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function approveTeacher(profile, teacherId) {
    if (profile.role !== 'school_admin') throw new Error('관리자 권한이 필요합니다.');
    if (!remoteEnabled) {
      const profiles = readJSON(localStorage, STORAGE.teacherProfiles, []);
      const target = profiles.find((teacher) => teacher.id === teacherId && teacher.schoolCode === profile.schoolCode);
      if (!target) throw new Error('승인할 교사를 찾지 못했습니다.');
      target.verified = true;
      writeJSON(localStorage, STORAGE.teacherProfiles, profiles);
      return;
    }
    const { error } = await client.rpc('approve_teacher', { p_teacher_user_id: teacherId });
    if (error) throw error;
  }

  async function listSchoolTeachers(profile) {
    if (!remoteEnabled) {
      return readJSON(localStorage, STORAGE.teacherProfiles, [])
        .filter((teacher) => teacher.schoolCode === profile.schoolCode && teacher.verified !== false)
        .map((teacher) => ({
          teacherId: teacher.id,
          name: teacher.name,
          role: teacher.role || 'teacher',
          isMe: teacher.id === profile.teacherId,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
    const { data, error } = await client.rpc('get_school_teachers');
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function setLessonTeachers({ profile, lessonId, teacherIds }) {
    const uniqueIds = [...new Set(teacherIds)].filter(Boolean);
    if (!uniqueIds.length) throw new Error('담당 교사를 한 명 이상 선택해주세요.');

    if (!remoteEnabled) {
      const lessons = readJSON(localStorage, STORAGE.lessons, []);
      const profiles = readJSON(localStorage, STORAGE.teacherProfiles, []);
      const changes = readJSON(localStorage, STORAGE.lessonChanges, []);
      const lesson = lessons.find((item) => item.id === lessonId);
      if (!lesson || lesson.schoolCode !== profile.schoolCode) throw new Error('수업을 찾지 못했습니다.');
      const currentIds = lesson.teacherIds || (lesson.teacherId ? [lesson.teacherId] : []);
      if (!currentIds.includes(profile.teacherId) && profile.role !== 'school_admin') throw new Error('수정 권한이 없습니다.');
      if (profile.role !== 'school_admin' && !uniqueIds.includes(profile.teacherId)) throw new Error('본인은 공동 담당에서 제외할 수 없습니다.');

      const selected = uniqueIds.map((id) => profiles.find((teacher) => (
        teacher.id === id && teacher.schoolCode === profile.schoolCode && teacher.verified !== false
      )));
      if (selected.some((teacher) => !teacher)) throw new Error('선택한 교사 정보를 확인해주세요.');

      const before = localChangeSnapshot(lesson);
      lesson.teacherIds = uniqueIds;
      lesson.teacherNames = selected.map((teacher) => teacher.name);
      lesson.teacherId = uniqueIds[0];
      lesson.teacherName = lesson.teacherNames[0];
      lesson.updatedAt = new Date().toISOString();
      appendLocalChange(changes, {
        profile,
        lesson,
        changeType: 'teachers',
        beforeData: before,
        afterData: localChangeSnapshot(lesson),
      });
      writeJSON(localStorage, STORAGE.lessons, lessons);
      writeJSON(localStorage, STORAGE.lessonChanges, changes);
      return;
    }

    const { error } = await client.rpc('set_lesson_teachers', {
      p_lesson_id: lessonId,
      p_teacher_ids: uniqueIds,
    });
    if (error) throw error;
  }

  async function listLessonHistory({ profile, lessonId }) {
    if (!remoteEnabled) {
      return readJSON(localStorage, STORAGE.lessonChanges, [])
        .filter((change) => change.schoolCode === profile.schoolCode && change.lessonId === lessonId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(normalizeChange);
    }
    const { data, error } = await client.rpc('get_lesson_history', { p_lesson_id: lessonId });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map(normalizeChange);
  }

  async function listStudentNotifications({ school, grade, classNo, from }) {
    if (!remoteEnabled) {
      return readJSON(localStorage, STORAGE.lessonChanges, [])
        .filter((change) => (
          change.schoolCode === schoolCodeOf(school)
          && String(change.grade) === String(grade)
          && String(change.classNo) === String(classNo)
          && new Date(change.createdAt) >= new Date(from)
          && ['create', 'update', 'delete'].includes(change.changeType)
        ))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(normalizeChange);
    }

    const { data, error } = await client.rpc('get_student_notifications', {
      p_neis_office_code: school.ATPT_OFCDC_SC_CODE,
      p_neis_school_code: school.SD_SCHUL_CODE,
      p_grade: Number(grade),
      p_class_number: Number(classNo),
      p_from: from,
    });
    if (error) throw error;
    return (Array.isArray(data) ? data : []).map(normalizeChange);
  }

  function subscribeToLessons(onChange) {
    if (!remoteEnabled) return () => {};
    const channel = client
      .channel('oneul-pe-lessons')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pe_lessons' }, () => onChange?.())
      .subscribe();
    return () => client.removeChannel(channel);
  }

  return {
    remoteEnabled,
    modeLabel: remoteEnabled ? 'Supabase 실시간 모드' : '로컬 데모 모드',
    loginTeacher,
    getTeacherSession,
    logoutTeacher,
    listStudentLessons,
    listTeacherLessons,
    saveTeacherLessons,
    deleteTeacherLesson,
    listPendingTeachers,
    approveTeacher,
    listSchoolTeachers,
    setLessonTeachers,
    listLessonHistory,
    listStudentNotifications,
    subscribeToLessons,
  };
})();
