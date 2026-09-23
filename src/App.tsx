import React, { useEffect, useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';
import { PlantTalkDashboard } from './components/dashboard/PlantTalkDashboard';
import { useSettingsStore } from './stores/plant/settings-store';
import { useExperienceStore } from './stores/plant/experience-store';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function App() {
  const { apiKey, apiKeyConfigured, apiStatus, validateAndConnectKey, setApiKeyConfigured } =
    useSettingsStore();
  const { toast } = useExperienceStore();

  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [hasEnteredApp, setHasEnteredApp] = useState<boolean>(false);

  // ───────────────────────────────────────────────────────────────────────────
  // STARTUP INITIALIZATION
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function checkStartupApiKey() {
      const storedKey = apiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY || '';

      if (!storedKey) {
        if (isMounted) {
          setIsInitializing(false);
        }
        return;
      }

      try {
        await validateAndConnectKey(storedKey);
      } catch {
        // Fallback gracefully without blocking landing page
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    checkStartupApiKey();

    return () => {
      isMounted = false;
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // STARTUP INITIALIZATION SPLASH (Smooth, quick)
  // ───────────────────────────────────────────────────────────────────────────
  if (isInitializing) {
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
          LANDING PAGE -> EXISTING PLANT TALK DASHBOARD
          1. Initial state: Motion Graphics Landing Page
          2. Install App / Sign in with Google -> Opens Existing Dashboard
          ───────────────────────────────────────────────────────────────────── */}
      {!hasEnteredApp ? (
        <LandingPage
          onSuccess={async () => {
            const keyToUse = apiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY || '';
            try {
              await validateAndConnectKey(keyToUse);
            } catch (err) {
              console.warn('[Plant Talk] Auto-connection warning:', err);
            }
            setApiKeyConfigured(true);
            setHasEnteredApp(true);
          }}
        />
      ) : (
        <PlantTalkDashboard
          onDisconnect={() => {
            setApiKeyConfigured(false);
            setHasEnteredApp(false);
          }}
        />
      )}
    </>
  );
}
