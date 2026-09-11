(() => {
  const Backend = window.OneulPEBackend;
  if (!Backend) return;

  function anonymizeLesson(lesson) {
    if (!lesson) return lesson;
    return {
      ...lesson,
      teacherIds: [],
      teacherNames: [],
      teacherId: null,
      teacherName: '',
    };
  }

  function anonymizeNotification(change) {
    if (!change) return change;
    return {
      ...change,
      changedByName: '',
    };
  }

  const originalLessons = Backend.listStudentLessons.bind(Backend);
  Backend.listStudentLessons = async (args) => {
    const rows = await originalLessons(args);
    return (Array.isArray(rows) ? rows : []).map(anonymizeLesson);
  };

  const originalNotifications = Backend.listStudentNotifications.bind(Backend);
  Backend.listStudentNotifications = async (args) => {
    const rows = await originalNotifications(args);
    return (Array.isArray(rows) ? rows : []).map(anonymizeNotification);
  };
})();
