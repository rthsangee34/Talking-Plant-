import React from 'react';
import { X, CheckCircle2, Download, Smartphone, ArrowRight, ShieldCheck, Info } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueToLogin: () => void;
  installStatus: 'accepted' | 'dismissed' | 'unavailable' | 'already-installed' | 'prompted';
  isIOS?: boolean;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  onContinueToLogin,
  installStatus,
  isIOS,
}) => {
  const { isAuthenticated } = useAuthStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-emerald-900/10 text-stone-900 transform transition-all animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 mb-5 shadow-xs">
          {installStatus === 'already-installed' || installStatus === 'accepted' ? (
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          ) : (
            <Smartphone className="w-7 h-7 text-emerald-700" />
          )}
        </div>

        {/* Modal Title */}
        <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-950 font-['Outfit'] tracking-tight">
          {installStatus === 'already-installed'
            ? 'Talking Plant is Installed!'
            : installStatus === 'accepted'
            ? 'Installation Started!'
            : 'Get Started with Talking Plant'}
        </h3>

        {/* Modal Body / Status explanation */}
        <div className="mt-3 text-sm text-stone-600 space-y-2.5 leading-relaxed">
          {installStatus === 'already-installed' && (
            <p>
              The application is already installed on your device. You can launch it directly from your home screen or continue right now in your browser.
            </p>
          )}

          {installStatus === 'accepted' && (
            <p>
              Talking Plant has been added to your device. Next, sign in with your Google account to connect with your plant companion.
            </p>
          )}

          {installStatus === 'dismissed' && (
            <p>
              Installation was skipped. You can always install Talking Plant later from your browser menu. You can continue right now in your browser.
            </p>
          )}

          {installStatus === 'unavailable' && (
            <>
              {isIOS ? (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs">
                  <div className="font-bold mb-1 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-700" />
                    <span>How to install on iOS Safari:</span>
                  </div>
                  <span>Tap the <strong>Share</strong> button at the bottom of Safari, then choose <strong>&apos;Add to Home Screen&apos;</strong>.</span>
                </div>
              ) : (
                <p>
                  Talking Plant runs smoothly in any modern web browser as a Progressive Web App. Continue to sign in with Google to explore your plant.
                </p>
              )}
            </>
          )}

          {installStatus === 'prompted' && (
            <p>
              Please follow the on-screen browser prompt to complete the installation.
            </p>
          )}

          <div className="flex items-start gap-2 pt-2 text-xs text-stone-700 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Note: Installing the app does not automatically log you in. Google authentication is required to access your plant.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-7 flex flex-col gap-3">
          <button
            onClick={() => {
              onClose();
              onContinueToLogin();
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-sm shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98"
          >
            <span>{isAuthenticated ? 'Open Plant Companion' : 'Continue to Google Login'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            Back to Explore
          </button>
        </div>

      </div>
    </div>
  );
};
