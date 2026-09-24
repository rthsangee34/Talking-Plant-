import { useState, useEffect, useCallback } from 'react';

export type AppRoute = 'landing' | 'login' | 'home' | 'dashboard';

/**
 * Normalizes location pathname/hash to one of the defined AppRoutes.
 */
export function getRouteFromLocation(): AppRoute {
  if (typeof window === 'undefined') return 'landing';

  // 1. Check hash first if present (e.g. #/login, #/home, #/dashboard)
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase().trim();
  if (hash === 'login' || hash === 'signin') return 'login';
  if (hash === 'home' || hash === 'setup') return 'home';
  if (hash === 'dashboard' || hash === 'main') return 'dashboard';
  if (hash === 'landing') return 'landing';

  // 2. Check window pathname (e.g. /login, /home, /dashboard)
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
  if (path === 'login' || path === 'signin') return 'login';
  if (path === 'home' || path === 'setup') return 'home';
  if (path === 'dashboard' || path === 'main') return 'dashboard';
  if (path === 'landing') return 'landing';

  // 3. Default root path '/'
  return 'landing';
}

/**
 * Programmatically navigate to an AppRoute using HTML5 History API and dispatch custom event.
 */
export function navigateTo(route: AppRoute, replace = false): void {
  if (typeof window === 'undefined') return;

  const targetPath = route === 'landing' ? '/' : `/${route}`;
  const currentPath = window.location.pathname;

  if (currentPath !== targetPath) {
    if (replace) {
      window.history.replaceState({ route }, '', targetPath);
    } else {
      window.history.pushState({ route }, '', targetPath);
    }
  }

  // Clear hash if navigating to clean path
  if (window.location.hash) {
    window.history.replaceState({ route }, '', targetPath);
  }

  window.dispatchEvent(
    new CustomEvent('app-route-change', { detail: route })
  );
}

/**
 * React hook to observe and change application routes.
 */
export function useAppRoute(): [AppRoute, (route: AppRoute, replace?: boolean) => void] {
  const [route, setRoute] = useState<AppRoute>(getRouteFromLocation);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRouteFromLocation());
    };

    const handleCustomRouteChange = (e: any) => {
      if (e?.detail) {
        setRoute(e.detail);
      } else {
        setRoute(getRouteFromLocation());
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('app-route-change', handleCustomRouteChange as EventListener);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('app-route-change', handleCustomRouteChange as EventListener);
    };
  }, []);

  const navigate = useCallback((targetRoute: AppRoute, replace = false) => {
    navigateTo(targetRoute, replace);
    setRoute(targetRoute);
  }, []);

  return [route, navigate];
}
