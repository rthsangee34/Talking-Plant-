import { useState, useEffect } from 'react';

export const INSTALL_STORAGE_KEY = 'planttalk_installed';

/**
 * Checks if the application is installed as a PWA or has been marked as installed.
 */
export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    // 1. Check persistent localStorage flag
    if (window.localStorage?.getItem(INSTALL_STORAGE_KEY) === 'true') {
      return true;
    }

    // 2. Check browser PWA standalone display modes
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any)?.standalone === true ||
      document.referrer?.includes('android-app://');

    if (isStandalone) {
      window.localStorage?.setItem(INSTALL_STORAGE_KEY, 'true');
      return true;
    }
  } catch {
    // Fallback gracefully in case of storage sandboxing
  }

  return false;
}

/**
 * Sets the installation state in persistent storage and notifies active listeners.
 */
export function setAppInstalled(installed: boolean = true): void {
  if (typeof window === 'undefined') return;

  try {
    if (installed) {
      window.localStorage?.setItem(INSTALL_STORAGE_KEY, 'true');
    } else {
      window.localStorage?.removeItem(INSTALL_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[InstallManager] Unable to access localStorage:', err);
  }

  window.dispatchEvent(
    new CustomEvent('app-installed-change', { detail: installed })
  );
}

/**
 * React hook to reactively track installation state across components and PWA events.
 */
export function useIsAppInstalled(): [boolean, (installed?: boolean) => void] {
  const [installed, setInstalledState] = useState<boolean>(isAppInstalled);

  useEffect(() => {
    const handleInstalledChange = (e: any) => {
      if (typeof e.detail === 'boolean') {
        setInstalledState(e.detail);
      } else {
        setInstalledState(isAppInstalled());
      }
    };

    const handleAppInstalledEvent = () => {
      console.log('[InstallManager] Native appinstalled event detected');
      setAppInstalled(true);
      setInstalledState(true);
    };

    window.addEventListener('app-installed-change', handleInstalledChange as EventListener);
    window.addEventListener('appinstalled', handleAppInstalledEvent);

    return () => {
      window.removeEventListener('app-installed-change', handleInstalledChange as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalledEvent);
    };
  }, []);

  const updateInstalled = (val: boolean = true) => {
    setAppInstalled(val);
    setInstalledState(val);
  };

  return [installed, updateInstalled];
}
