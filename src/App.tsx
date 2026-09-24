import React, { useEffect, useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { LoginPage } from './components/auth/LoginPage';
import { HomePage } from './components/setup/HomePage';
import { PlantTalkDashboard } from './components/dashboard/PlantTalkDashboard';
import { useSettingsStore } from './stores/plant/settings-store';
import { useExperienceStore } from './stores/plant/experience-store';
import { useFirebaseAuthSession, signOutUser } from './services/firebase/firebase';
import { useIsAppInstalled } from './lib/install-manager';
import { useAppRoute } from './lib/router';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function App() {
  const { apiKey, validateAndConnectKey, setApiKeyConfigured } = useSettingsStore();
  const { toast } = useExperienceStore();

  const [installed, setInstalled] = useIsAppInstalled();
  const { user, authLoading, isAuthenticated } = useFirebaseAuthSession();
  const [route, navigate] = useAppRoute();
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // ───────────────────────────────────────────────────────────────────────────
  // STARTUP INITIALIZATION
  // Validate stored API key if present on startup, and resolve splash screen
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function checkStartupApiKey() {
      const storedKey = apiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY || '';

      if (storedKey) {
        try {
          await validateAndConnectKey(storedKey);
          setApiKeyConfigured(true);
        } catch {
          // Graceful fallback without blocking app startup
        }
      }

      if (isMounted) {
        setIsInitializing(false);
      }
    }

    checkStartupApiKey();

    return () => {
      isMounted = false;
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // ROUTE GUARDS & REDIRECTION LOGIC
  // Enforces mutually exclusive routing rules and prevents redirect loops:
  // 1. If not installed -> Landing Page ONLY.
  // 2. If installed & not authenticated -> Login ONLY.
  // 3. If installed & authenticated -> Homepage (or Main UI if on /dashboard).
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Hold routing decisions until authentication session and initial setup are resolved
    if (authLoading || isInitializing) return;

    if (!installed) {
      // Rule 1: Fresh user / Not installed -> Show Landing Page
      if (route !== 'landing') {
        navigate('landing', true);
      }
    } else if (!isAuthenticated) {
      // Rule 2: Installed but not authenticated -> Show Login
      // Landing Page must NOT appear again after installation.
      // Homepage / Main UI cannot be accessed without authentication.
      if (route !== 'login') {
        navigate('login', true);
      }
    } else {
      // Rule 3: Installed and authenticated
      // If user was directed to Landing or Login or root '/', send to Homepage
      if (route === 'landing' || route === 'login') {
        navigate('home', true);
      }
      // If route is 'home' or 'dashboard', remain on that route (preserves refresh state)
    }
  }, [authLoading, isInitializing, installed, isAuthenticated, route, navigate]);

  // ───────────────────────────────────────────────────────────────────────────
  // STARTUP INITIALIZATION SPLASH
  // Shown during auth session restoration and initial key verification to prevent
  // page flashing or false redirects during page refresh.
  // ───────────────────────────────────────────────────────────────────────────
  if (authLoading || isInitializing) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[#0d281a] text-white font-sans select-none p-4">
        <div className="relative mb-4">
          <img
            src="/plant-talk.png"
            alt="Plant Talk Loading"
            className="w-20 h-20 object-contain filter drop-shadow-lg animate-pulse"
          />
        </div>
        <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Preparing Talking Plant Experience...</span>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // VIEW RENDERING
  // Deterministic component rendering guided by installation and auth state
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-bounce max-w-[90vw]">
          <div
            className={`px-3.5 py-2 rounded-xl shadow-xl text-xs font-bold border flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-700 text-white border-emerald-600'
                : toast.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500'
                : toast.type === 'warning'
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800 text-white border-slate-700'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">{toast.message}</span>
          </div>
        </div>
      )}

      {/* 1. NOT INSTALLED: Landing Page */}
      {!installed && (
        <LandingPage
          onInstall={() => {
            setInstalled(true);
            navigate('login');
          }}
          onSuccess={() => {
            setInstalled(true);
            navigate('home');
          }}
        />
      )}

      {/* 2. INSTALLED BUT NOT AUTHENTICATED: Login Screen */}
      {installed && !isAuthenticated && (
        <LoginPage
          onSuccess={() => {
            navigate('home');
          }}
        />
      )}

      {/* 3. INSTALLED AND AUTHENTICATED: Homepage or Main UI Dashboard */}
      {installed && isAuthenticated && (
        <>
          {route === 'dashboard' ? (
            <PlantTalkDashboard
              onDisconnect={() => {
                navigate('home');
              }}
              onSignOut={async () => {
                await signOutUser();
                navigate('login');
              }}
            />
          ) : (
            <HomePage
              onSuccess={() => {
                navigate('dashboard');
              }}
            />
          )}
        </>
      )}
    </>
  );
}
