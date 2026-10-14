import React, { useEffect, useState } from 'react';
import { HomePage } from './components/setup/HomePage';
import { PlantTalkDashboard } from './components/dashboard/PlantTalkDashboard';
import { LandingPage } from './components/landing/LandingPage';
import { AuthStatusBar } from './components/common/AuthStatusBar';
import { useSettingsStore } from './stores/plant/settings-store';
import { useExperienceStore } from './stores/plant/experience-store';
import { useAuthStore } from './stores/auth-store';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function App() {
  const { 
    apiKey, 
    apiKeyConfigured, 
    apiStatus, 
    validateAndConnectKey, 
    setApiKeyConfigured 
  } = useSettingsStore();

  const { toast, showToast } = useExperienceStore();
  const { initializeAuth, isAuthenticated, isLoading: isAuthLoading } = useAuthStore();

  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  
  // View routing: 'landing' (public default) or 'app' (protected existing home page/dashboard)
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. FIREBASE AUTHENTICATION INITIALIZATION & ROUTING
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = initializeAuth();

    // Check URL hash / search params for direct navigation intents
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const viewParam = searchParams.get('view');

    if (hash === '#app' || viewParam === 'app') {
      // Intended protected route: will validate once auth is resolved
      setCurrentView('app');
    }

    return () => {
      unsubscribe();
    };
  }, [initializeAuth]);

  // Sync route protection: If user is on protected 'app' view but logs out, redirect to 'landing'
  useEffect(() => {
    if (!isAuthLoading) {
      if (currentView === 'app' && !isAuthenticated) {
        setCurrentView('landing');
      }
    }
  }, [isAuthenticated, isAuthLoading, currentView]);

  // ───────────────────────────────────────────────────────────────────────────
  // 2. APPLICATION STARTUP FLOW (API Key check on startup)
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function checkStartupApiKey() {
      const storedKey = apiKey?.trim();

      if (!storedKey) {
        if (isMounted) {
          setApiKeyConfigured(false);
          setIsInitializing(false);
        }
        return;
      }

      try {
        const result = await validateAndConnectKey(storedKey);
        if (isMounted) {
          if (result.success) {
            setApiKeyConfigured(true);
          } else {
            setApiKeyConfigured(false);
          }
          setIsInitializing(false);
        }
      } catch {
        if (isMounted) {
          setApiKeyConfigured(false);
          setIsInitializing(false);
        }
      }
    }

    checkStartupApiKey();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle entering the existing app after Google Login / verification
  const handleEnterApp = () => {
    if (isAuthenticated) {
      setCurrentView('app');
      window.location.hash = '#app';
    } else {
      showToast('Please sign in with Google to enter your plant dashboard.', 'warning');
    }
  };

  const handleReturnToLanding = () => {
    setCurrentView('landing');
    window.location.hash = '';
  };

  // ───────────────────────────────────────────────────────────────────────────
  // STARTUP INITIALIZATION SPLASH
  // ───────────────────────────────────────────────────────────────────────────
  if (isInitializing || isAuthLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f4f7f5] text-stone-800 font-sans select-none">
        <div className="relative mb-4">
          <img
            src="/planttalklogo.png"
            alt="Plant Talk Loading"
            className="w-24 h-24 object-contain filter drop-shadow-md animate-pulse"
          />
        </div>
        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
          <span>Starting Talking Plant...</span>
        </div>
      </div>
    );
  }

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

      {/* ─────────────────────────────────────────────────────────────────────
          VIEW ROUTER:
          VIEW A: PUBLIC LANDING PAGE (DEFAULT FOR VISITORS)
          VIEW B: PROTECTED EXISTING APP (REQUIRES GOOGLE AUTHENTICATION)
          ───────────────────────────────────────────────────────────────────── */}
      {currentView === 'landing' || !isAuthenticated ? (
        <LandingPage onEnterApp={handleEnterApp} />
      ) : (
        <div className="relative w-full min-h-screen">
          {/* ─────────────────────────────────────────────────────────────────
              PRESERVED EXISTING APPLICATION:
              STATE A: API KEY NOT CONFIGURED / INVALID -> SETUP PAGE
              STATE B: API KEY CONFIGURED AND VALID -> MAIN PLANT TALK DASHBOARD
              ───────────────────────────────────────────────────────────────── */}
          {!apiKeyConfigured || apiStatus !== 'AI_READY' ? (
            <HomePage 
              onSuccess={() => setApiKeyConfigured(true)} 
              onReturnToLanding={handleReturnToLanding}
            />
          ) : (
            <>
              <AuthStatusBar onReturnToLanding={handleReturnToLanding} />
              <PlantTalkDashboard onDisconnect={() => setApiKeyConfigured(false)} />
            </>
          )}
        </div>
      )}
    </>
  );
}
