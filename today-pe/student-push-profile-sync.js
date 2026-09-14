(() => {
  const form = document.getElementById('studentClassForm');
  const PWA = window.OneulPEPWA;
  if (!form || !PWA) return;

  form.addEventListener('submit', () => {
    // student.js가 같은 submit 이벤트에서 localStorage 프로필을 먼저 갱신합니다.
    // 그 뒤 기존 Push endpoint를 새 학교/학년/반으로 다시 upsert합니다.
    queueMicrotask(async () => {
      if (!PWA.pushEnabledByUser?.()) return;
      const result = await PWA.subscribeCurrentStudent?.();
      if (result?.status === 'failed') {
        console.warn('학생 반 변경 후 Push 구독 동기화에 실패했습니다.');
      }
    });
  });
})();
