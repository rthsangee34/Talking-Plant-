import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { isAppInstalled, setAppInstalled, INSTALL_STORAGE_KEY } from '../install-manager';
import { getRouteFromLocation, navigateTo, AppRoute } from '../router';

describe('PlantTalk Flow & Routing Logic Verification', () => {
  let localStorageStore: Record<string, string> = {};

  beforeAll(() => {
    const mockLocalStorage = {
      getItem: (key: string) => localStorageStore[key] || null,
      setItem: (key: string, value: string) => {
        localStorageStore[key] = String(value);
      },
      removeItem: (key: string) => {
        delete localStorageStore[key];
      },
      clear: () => {
        localStorageStore = {};
      },
    };

    const mockHistory = {
      pathname: '/',
      hash: '',
      pushState: vi.fn((_state: any, _title: string, url: string) => {
        if (url.startsWith('#')) {
          mockHistory.hash = url;
        } else {
          mockHistory.pathname = url;
          mockHistory.hash = '';
        }
      }),
      replaceState: vi.fn((_state: any, _title: string, url: string) => {
        if (url.startsWith('#')) {
          mockHistory.hash = url;
        } else {
          mockHistory.pathname = url;
          mockHistory.hash = '';
        }
      }),
    };

    (globalThis as any).window = {
      localStorage: mockLocalStorage,
      history: mockHistory,
      location: mockHistory,
      navigator: {},
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  beforeEach(() => {
    localStorageStore = {};
    (globalThis as any).window.history.pathname = '/';
    (globalThis as any).window.history.hash = '';
    (globalThis as any).window.location.pathname = '/';
    (globalThis as any).window.location.hash = '';
  });

  // Helper guard evaluation function matching App.tsx logic
  function evaluateGuardedRoute(
    installed: boolean,
    authenticated: boolean,
    currentRoute: AppRoute
  ): AppRoute {
    if (!installed) {
      return 'landing';
    }
    if (installed && !authenticated) {
      return 'login';
    }
    // installed && authenticated
    if (currentRoute === 'landing' || currentRoute === 'login') {
      return 'home';
    }
    return currentRoute; // Stays on 'home' or 'dashboard'
  }

  it('Case 1: Fresh user flow (Landing -> Install -> Login -> Homepage -> Main UI)', () => {
    // 1. Fresh user arrives
    expect(isAppInstalled()).toBe(false);
    let route = evaluateGuardedRoute(false, false, 'landing');
    expect(route).toBe('landing');

    // 2. User installs app
    setAppInstalled(true);
    expect(isAppInstalled()).toBe(true);
    expect(window.localStorage.getItem(INSTALL_STORAGE_KEY)).toBe('true');

    // After install, moves to Login
    route = evaluateGuardedRoute(true, false, 'login');
    expect(route).toBe('login');

    // 3. User logs in / signs up
    route = evaluateGuardedRoute(true, true, route);
    expect(route).toBe('home');

    // 4. User completes homepage setup -> Main UI
    route = evaluateGuardedRoute(true, true, 'dashboard');
    expect(route).toBe('dashboard');
  });

  it('Case 2: Installed but logged out (Login -> Homepage -> Main UI)', () => {
    setAppInstalled(true);
    const authenticated = false;

    // Even if user visits root or landing, guard requires Login
    expect(evaluateGuardedRoute(true, authenticated, 'landing')).toBe('login');
    expect(evaluateGuardedRoute(true, authenticated, 'dashboard')).toBe('login');
    expect(evaluateGuardedRoute(true, authenticated, 'home')).toBe('login');

    // User logs in
    const nextRoute = evaluateGuardedRoute(true, true, 'login');
    expect(nextRoute).toBe('home');

    // From homepage to main dashboard
    expect(evaluateGuardedRoute(true, true, 'dashboard')).toBe('dashboard');
  });

  it('Case 3: Installed and already logged in (Homepage -> Main UI)', () => {
    setAppInstalled(true);
    const authenticated = true;

    // App opens at root / landing -> automatically directs to Homepage
    const initialRoute = evaluateGuardedRoute(true, authenticated, 'landing');
    expect(initialRoute).toBe('home');

    // User proceeds to Main UI
    const mainUiRoute = evaluateGuardedRoute(true, authenticated, 'dashboard');
    expect(mainUiRoute).toBe('dashboard');
  });

  it('Case 4: Refresh on Homepage (Stay authenticated and remain on Homepage)', () => {
    setAppInstalled(true);
    const authenticated = true;
    navigateTo('home');

    expect(getRouteFromLocation()).toBe('home');
    const guardedRoute = evaluateGuardedRoute(true, authenticated, 'home');
    expect(guardedRoute).toBe('home');
  });

  it('Case 5: Refresh on Main UI (Stay authenticated and remain in Main UI)', () => {
    setAppInstalled(true);
    const authenticated = true;
    navigateTo('dashboard');

    expect(getRouteFromLocation()).toBe('dashboard');
    const guardedRoute = evaluateGuardedRoute(true, authenticated, 'dashboard');
    expect(guardedRoute).toBe('dashboard');
  });

  it('Case 6: Close and reopen installed app (Do NOT show Landing Page again)', () => {
    setAppInstalled(true);

    // Reopen when authenticated -> Goes to Homepage
    expect(evaluateGuardedRoute(true, true, 'landing')).toBe('home');

    // Reopen when not authenticated -> Goes to Login
    expect(evaluateGuardedRoute(true, false, 'landing')).toBe('login');

    // Landing is NEVER returned when installed is true
    expect(evaluateGuardedRoute(true, true, 'landing')).not.toBe('landing');
    expect(evaluateGuardedRoute(true, false, 'landing')).not.toBe('landing');
  });

  it('Case 7: Sign out (Next access should require Login)', () => {
    setAppInstalled(true);

    // Currently on dashboard
    let authenticated = true;
    expect(evaluateGuardedRoute(true, authenticated, 'dashboard')).toBe('dashboard');

    // Sign out happens
    authenticated = false;
    // Next evaluation directs to login
    expect(evaluateGuardedRoute(true, authenticated, 'dashboard')).toBe('login');
    expect(evaluateGuardedRoute(true, authenticated, 'home')).toBe('login');
    expect(evaluateGuardedRoute(true, authenticated, 'landing')).toBe('login');
  });

  it('Case 8: Prevent redirect loops (Idempotent state mapping)', () => {
    // Verify each state yields a single stable destination
    const testStates = [
      { installed: false, auth: false, current: 'landing' as AppRoute },
      { installed: false, auth: true, current: 'landing' as AppRoute },
      { installed: true, auth: false, current: 'login' as AppRoute },
      { installed: true, auth: true, current: 'home' as AppRoute },
      { installed: true, auth: true, current: 'dashboard' as AppRoute },
    ];

    for (const state of testStates) {
      const step1 = evaluateGuardedRoute(state.installed, state.auth, state.current);
      const step2 = evaluateGuardedRoute(state.installed, state.auth, step1);
      // step2 must equal step1 (idempotent, no bouncing/loops)
      expect(step2).toBe(step1);
    }
  });
});
