(() => {
  const form = document.getElementById('studentClassForm');
  const resetButton = document.getElementById('studentResetButton');
  const PWA = window.OneulPEPWA;
  const API = window.OneulPE;
  const PUSH_PREF_KEY = 'oneulPe.pushEnabled.v1';
  if (!form || !PWA || !API) return;

  const baseCanNotify = typeof PWA.canNotify === 'function'
    ? PWA.canNotify.bind(PWA)
    : () => false;
  PWA.canNotify = () => baseCanNotify() && localStorage.getItem(PUSH_PREF_KEY) !== '0';

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

  resetButton?.addEventListener('click', () => {
    const wasPushEnabled = PWA.pushEnabledByUser?.() === true;
    if (!wasPushEnabled) return;

    queueMicrotask(async () => {
      // student.js에서 confirm이 취소되면 기존 프로필이 그대로 남으므로 아무것도 하지 않습니다.
      const profile = API.readJSON(localStorage, API.STORAGE.studentProfile, null);
      if (profile) return;

      // 이전 반 구독은 제거하되 사용자의 “푸시 사용” 선택은 유지합니다.
      await PWA.unsubscribePush?.();
      localStorage.setItem(PUSH_PREF_KEY, '1');
    });
  });
})();
