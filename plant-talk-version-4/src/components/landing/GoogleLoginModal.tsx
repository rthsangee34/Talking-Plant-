import React from 'react';
import { X, AlertCircle, Loader2, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const { 
    signInWithGoogle, 
    isAuthenticating, 
    error, 
    clearError, 
    isAuthenticated,
    user 
  } = useAuthStore();

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    clearError();
    const success = await signInWithGoogle();
    if (success) {
      setTimeout(() => {
        onLoginSuccess();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-emerald-900/10 text-stone-900 transform transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isAuthenticating}
          className="absolute right-4 top-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Icon */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center p-1.5 shadow-xs">
            <img 
              src="/planttalklogo.png" 
              alt="Talking Plant" 
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h3 className="text-xl font-bold text-emerald-950 font-['Outfit'] tracking-tight">
              Sign In to Talking Plant
            </h3>
            <p className="text-xs text-stone-700 font-medium">
              Secure Google Authentication
            </p>
          </div>
        </div>

        {/* If user is already authenticated */}
        {isAuthenticated && user ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-950">
                  Signed in as {user.displayName || user.email}
                </p>
                <p className="text-xs text-emerald-800">
                  Your session is active.
                </p>
              </div>
            </div>

            <button
              onClick={() => onLoginSuccess()}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Continue to Plant Companion</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-stone-600 leading-relaxed font-normal">
              Sign in with your Google account to access your plant companion, real-time telemetry, and AI voice conversations.
            </p>

            {/* Error Message */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Google Sign-In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isAuthenticating}
              className="w-full py-3.5 px-6 rounded-2xl border border-stone-300 hover:border-emerald-600 bg-white hover:bg-stone-50 text-stone-800 font-bold text-sm shadow-xs hover:shadow-md flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                  <span>Connecting with Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                  <span>Sign in with Google</span>
                </>
              )}
            </button>

            {/* Privacy & Security note */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-[11px] text-emerald-900 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Protected by Firebase Authentication. Your credentials are never stored or logged.</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
