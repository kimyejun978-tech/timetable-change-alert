window.OneulPEPWA = (() => {
  const config = window.ONEUL_PE_CONFIG || {};
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
    if (pushSubscribed) {
      button.textContent = '푸시 켜짐';
      button.disabled = true;
    } else if (Notification.permission === 'granted') {
      button.textContent = config.VAPID_PUBLIC_KEY ? '푸시 연결 중' : '알림 켜짐';
      button.disabled = true;
    } else if (Notification.permission === 'denied') {
      button.textContent = '알림 차단됨';
      button.disabled = true;
    } else {
      button.textContent = '알림 켜기';
      button.disabled = false;
    }
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
          name: profile.school.SCHUL_NM,
          region: profile.school.LCTN_SC_NM || '',
          address: profile.school.ORG_RDNMA || '',
        },
        grade: Number(profile.grade),
        classNo: Number(profile.classNo),
        subscription: subscription.toJSON(),
      }),
    });
    if (!response.ok) throw new Error(`PUSH_SUBSCRIBE_HTTP_${response.status}`);

    pushSubscribed = true;
    updateNotificationButton();
    return { status: 'subscribed' };
  }

  async function unsubscribePush() {
    const registration = await registrationPromise;
    const subscription = await registration?.pushManager?.getSubscription?.();
    if (!subscription) return false;
    try {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    } catch (error) {
      console.warn('push unsubscribe backend failed', error);
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

  document.addEventListener('DOMContentLoaded', () => {
    updateInstallButton();
    updateNotificationButton();
    installButton()?.addEventListener('click', requestInstall);
    notificationButton()?.addEventListener('click', async () => {
      const permission = await ensureNotificationPermission();
      window.dispatchEvent(new CustomEvent('oneulpe:notification-permission', { detail: { permission } }));
      if (permission === 'granted') {
        window.OneulPE?.showToast?.(config.VAPID_PUBLIC_KEY ? '알림 권한을 허용했어요. 푸시를 연결합니다.' : '브라우저 알림을 켰어요.');
      } else if (permission === 'denied') {
        window.OneulPE?.showToast?.('브라우저에서 알림 권한이 차단되어 있어요.');
      }
    });
  });

  return {
    registrationPromise,
    requestInstall,
    ensureNotificationPermission,
    subscribePushForStudent,
    unsubscribePush,
    showLocalNotification,
    canNotify: () => 'Notification' in window && Notification.permission === 'granted',
    pushConfigured: () => Boolean(config.VAPID_PUBLIC_KEY),
  };
})();
