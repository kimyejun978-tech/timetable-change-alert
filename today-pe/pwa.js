window.OneulPEPWA = (() => {
  const config = window.ONEUL_PE_CONFIG || {};
  const PUSH_PREF_KEY = 'oneulPe.pushEnabled.v1';
  let deferredInstallPrompt = null;
  let registrationPromise = Promise.resolve(null);
  let pushSubscribed = false;

  if ('serviceWorker' in navigator && window.isSecureContext) {
    registrationPromise = navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
      return null;
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButton();
  });

  function installButton() {
    return document.getElementById('installAppButton');
  }

  function notificationButton() {
    return document.getElementById('enableNotificationsButton');
  }

  function pushPreference() {
    const raw = localStorage.getItem(PUSH_PREF_KEY);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  }

  function setPushPreference(enabled) {
    localStorage.setItem(PUSH_PREF_KEY, enabled ? '1' : '0');
  }

  function currentStudentProfile() {
    const api = window.OneulPE;
    if (!api?.STORAGE?.studentProfile || !api?.readJSON) return null;
    return api.readJSON(localStorage, api.STORAGE.studentProfile, null);
  }

  function updateInstallButton() {
    const button = installButton();
    if (!button) return;
    button.classList.toggle('hidden', !deferredInstallPrompt);
  }

  function updateNotificationButton() {
    const button = notificationButton();
    if (!button) return;
    if (!('Notification' in window) || !window.isSecureContext) {
      button.classList.add('hidden');
      return;
    }

    button.classList.remove('hidden');
    if (Notification.permission === 'denied') {
      button.textContent = '알림 차단됨';
      button.disabled = true;
      return;
    }
    if (pushSubscribed) {
      button.textContent = '푸시 끄기';
      button.disabled = false;
      return;
    }
    if (Notification.permission === 'granted' && !config.VAPID_PUBLIC_KEY) {
      button.textContent = '알림 권한 켜짐';
      button.disabled = true;
      return;
    }

    button.textContent = '알림 켜기';
    button.disabled = false;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
  }

  async function requestInstall() {
    if (!deferredInstallPrompt) return false;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallButton();
    return choice?.outcome === 'accepted';
  }

  async function ensureNotificationPermission() {
    if (!('Notification' in window) || !window.isSecureContext) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    const permission = await Notification.requestPermission();
    updateNotificationButton();
    return permission;
  }

  async function getPushSubscription() {
    const registration = await registrationPromise;
    return registration?.pushManager?.getSubscription?.() || null;
  }

  async function subscribePushForStudent(profile) {
    if (!profile?.school || !profile?.grade || !profile?.classNo) return { status: 'profile_required' };
    if (!config.VAPID_PUBLIC_KEY) return { status: 'not_configured' };
    const permission = await ensureNotificationPermission();
    if (permission !== 'granted') return { status: permission };

    const registration = await registrationPromise;
    if (!registration?.pushManager) return { status: 'unsupported' };

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.VAPID_PUBLIC_KEY),
      });
    }

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school: {
          officeCode: profile.school.ATPT_OFCDC_SC_CODE,
          schoolCode: profile.school.SD_SCHUL_CODE,
        },
        grade: Number(profile.grade),
        classNo: Number(profile.classNo),
        subscription: subscription.toJSON(),
      }),
    });
    if (!response.ok) throw new Error(`PUSH_SUBSCRIBE_HTTP_${response.status}`);

    setPushPreference(true);
    pushSubscribed = true;
    updateNotificationButton();
    return { status: 'subscribed' };
  }

  async function subscribeCurrentStudent() {
    const profile = currentStudentProfile();
    if (!profile) return { status: 'profile_required' };
    try {
      return await subscribePushForStudent(profile);
    } catch (error) {
      console.warn('Student push subscription failed', error);
      pushSubscribed = false;
      updateNotificationButton();
      return { status: 'failed' };
    }
  }

  async function unsubscribePush() {
    const subscription = await getPushSubscription();
    setPushPreference(false);

    if (!subscription) {
      pushSubscribed = false;
      updateNotificationButton();
      return true;
    }

    const serialized = subscription.toJSON?.() || {};
    const auth = String(serialized.keys?.auth || '');
    if (auth) {
      try {
        const response = await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint, auth }),
        });
        if (!response.ok) console.warn('push unsubscribe backend failed', response.status);
      } catch (error) {
        console.warn('push unsubscribe backend failed', error);
      }
    }

    await subscription.unsubscribe();
    pushSubscribed = false;
    updateNotificationButton();
    return true;
  }

  async function showLocalNotification(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const registration = await registrationPromise;
    if (registration?.showNotification) {
      await registration.showNotification(title, {
        icon: './icon.svg',
        badge: './icon.svg',
        ...options,
      });
      return true;
    }
    new Notification(title, { icon: './icon.svg', ...options });
    return true;
  }

  async function initializePushState() {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !config.VAPID_PUBLIC_KEY) {
      updateNotificationButton();
      return;
    }

    const existing = await getPushSubscription();
    const preference = pushPreference();

    if (preference === false) {
      if (existing) await unsubscribePush();
      updateNotificationButton();
      return;
    }

    if (existing) {
      pushSubscribed = true;
      updateNotificationButton();
      // 기존 구독을 서버와 다시 동기화합니다. 과거 버전에서 만들어진 구독도 canonical 학교 정보로 갱신됩니다.
      if (currentStudentProfile()) await subscribeCurrentStudent();
      return;
    }

    if (preference === true && currentStudentProfile()) {
      await subscribeCurrentStudent();
      return;
    }

    updateNotificationButton();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    updateInstallButton();
    updateNotificationButton();
    installButton()?.addEventListener('click', requestInstall);
    notificationButton()?.addEventListener('click', async () => {
      const button = notificationButton();
      if (button) button.disabled = true;

      try {
        if (pushSubscribed) {
          await unsubscribePush();
          window.OneulPE?.showToast?.('체육 변경 푸시 알림을 껐어요.');
          return;
        }

        const permission = await ensureNotificationPermission();
        window.dispatchEvent(new CustomEvent('oneulpe:notification-permission', { detail: { permission } }));
        if (permission === 'granted') {
          if (config.VAPID_PUBLIC_KEY) {
            const result = await subscribeCurrentStudent();
            window.OneulPE?.showToast?.(result.status === 'subscribed'
              ? '체육 변경 푸시 알림을 켰어요.'
              : '알림 권한은 켰지만 푸시 연결은 아직 준비 중이에요.');
          } else {
            window.OneulPE?.showToast?.('브라우저 알림 권한을 켰어요.');
          }
        } else if (permission === 'denied') {
          window.OneulPE?.showToast?.('브라우저에서 알림 권한이 차단되어 있어요.');
        }
      } finally {
        updateNotificationButton();
      }
    });

    await initializePushState();
  });

  return {
    registrationPromise,
    requestInstall,
    ensureNotificationPermission,
    subscribePushForStudent,
    subscribeCurrentStudent,
    unsubscribePush,
    showLocalNotification,
    canNotify: () => 'Notification' in window && Notification.permission === 'granted',
    pushConfigured: () => Boolean(config.VAPID_PUBLIC_KEY),
    pushEnabledByUser: () => pushPreference() === true,
  };
})();