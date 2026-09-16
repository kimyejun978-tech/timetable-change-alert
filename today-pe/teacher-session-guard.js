(() => {
  const Backend = window.OneulPEBackend;
  if (!Backend) return;

  let checking = false;
  let revoked = false;

  async function checkTeacherAccess() {
    if (checking || revoked) return;
    checking = true;
    try {
      const profile = await Backend.getTeacherSession();
      if (profile?.verified) return;

      revoked = true;
      window.OneulPE?.showToast?.('교사 접근 권한이 변경되어 다시 로그인이 필요합니다.');
      try { await Backend.logoutTeacher(); } catch {}
      setTimeout(() => window.location.replace('./teacher-login.html'), 600);
    } catch (error) {
      // 일시적인 네트워크 장애만으로 로그아웃시키지 않는다.
      console.warn('교사 권한 재검증 실패', error);
    } finally {
      checking = false;
    }
  }

  const timer = window.setInterval(checkTeacherAccess, 60_000);
  window.addEventListener('online', checkTeacherAccess);
  window.addEventListener('storage', checkTeacherAccess);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkTeacherAccess();
  });
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
})();
