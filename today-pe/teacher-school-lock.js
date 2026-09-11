(() => {
  const Backend = window.OneulPEBackend;
  const OneulPE = window.OneulPE;
  if (!Backend || !OneulPE || Backend.remoteEnabled) return;

  const originalLoginTeacher = Backend.loginTeacher.bind(Backend);

  Backend.loginTeacher = async (input) => {
    const email = String(input?.email || '').trim().toLowerCase();
    const selectedSchoolCode = OneulPE.schoolCodeOf(input?.school || {});
    const profiles = OneulPE.readJSON(localStorage, OneulPE.STORAGE.teacherProfiles, []);
    const existing = profiles.find((teacher) => String(teacher.email || '').trim().toLowerCase() === email);

    if (existing && existing.schoolCode !== selectedSchoolCode) {
      throw new Error('SCHOOL_CHANGE_REQUIRES_OPERATOR');
    }

    return originalLoginTeacher(input);
  };
})();
