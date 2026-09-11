window.OneulPEPWA = (() => {
  let deferredInstallPrompt = null;
  let registrationPromise = Promise.resolve(null);

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
    if (Notification.permission === 'granted') {
      button.textContent = '알림 켜짐';
      button.disabled = true;
    } else if (Notification.permission === 'denied') {
      button.textContent = '알림 차단됨';
      button.disabled = true;
    } else {
      button.textContent = '알림 켜기';
      button.disabled = false;
    }
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
      if (permission === 'granted') {
        window.OneulPE?.showToast?.('브라우저 알림을 켰어요.');
      } else if (permission === 'denied') {
        window.OneulPE?.showToast?.('브라우저에서 알림 권한이 차단되어 있어요.');
      }
    });
  });

  return {
    registrationPromise,
    requestInstall,
    ensureNotificationPermission,
    showLocalNotification,
    canNotify: () => 'Notification' in window && Notification.permission === 'granted',
  };
})();
