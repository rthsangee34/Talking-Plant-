import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sprout, Shield, Loader2, AlertCircle } from 'lucide-react';
import { signInWithGoogle, User } from '../../services/firebase/firebase';
import { setAppInstalled } from '../../lib/install-manager';

interface LoginPageProps {
  onSuccess: (user?: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const { user, error: authError } = await signInWithGoogle();
      if (user) {
        // Mark installation confirmed
        setAppInstalled(true);
        onSuccess(user);
      } else if (authError) {
        setError(
          authError.includes('popup-closed-by-user')
            ? 'Sign-in was cancelled. Please complete Google sign-in to continue.'
            : authError
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Google authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center p-4 bg-[#0c2417] text-stone-900 select-none font-sans overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          BOTANICAL BACKGROUND
          ───────────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/setup-bg.jpg"
          alt="Plant Talk Botanical Background"
          className="w-full h-full object-cover object-center filter brightness-[0.95] contrast-[1.05]"
        />
        <div className="absolute inset-0 bg-emerald-950/45 backdrop-blur-[2px]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CENTERED LOGIN CARD (Matching AuthModal styling)
          ───────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/80 text-stone-900 overflow-hidden"
      >
        {/* Top ambient botanical gradient sheen */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-emerald-200/50 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-teal-200/40 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-emerald-600/25 mb-3">
            <Sprout className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-950 tracking-tight font-['Outfit']">
            Sign In to Plant Talk
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 mt-1 max-w-xs">
            Sign in with Google to connect your plant, sync sensors, and enable AI voice conversations.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button: Google Sign In */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 active:scale-98 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-3 text-sm font-semibold text-stone-800 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{loading ? 'Connecting with Google...' : 'Sign in with Google'}</span>
          </button>
        </div>

        {/* Security Assurance Badge */}
        <div className="mt-6 pt-4 border-t border-stone-200/80 flex items-center justify-center gap-2 text-[11px] text-stone-500">
          <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Secure Authentication powered by Google Firebase</span>
        </div>
      </motion.div>
    </div>
  );
};
