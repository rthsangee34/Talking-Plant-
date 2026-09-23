import React, { useState, useEffect } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  ClipboardPaste,
  XCircle,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/plant/settings-store';
import plantTalkLogo from '../../../public/plant-talk.png';

/**
 * ============================================================================
 * PLANT TALK v4.0 — GEMINI AI SETUP MODAL
 * ============================================================================
 * NOTE ON CLIENT-SIDE KEY SECURITY:
 * Storing the Gemini API key in sessionStorage provides isolation for the current
 * browser tab session and prevents permanent disk/localStorage persistence.
 * However, because code runs in the user's browser, client-side API keys can
 * technically be inspected within browser developer tools. Users should be
 * advised to use dedicated development keys with appropriate usage limits.
 * ============================================================================
 */

export const ApiKeySetupModal: React.FC = () => {
  const {
    apiKey,
    isSetupModalOpen,
    closeSetupModal,
    validateAndConnectKey,
  } = useSettingsStore();

  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isSetupModalOpen) {
      setInputKey(apiKey || '');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isSetupModalOpen, apiKey]);

  if (!isSetupModalOpen) return null;

  const handlePaste = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setInputKey(text.trim());
          setErrorMessage(null);
        }
      }
    } catch {
      // Clipboard permissions denied
    }
  };

  const handleClear = () => {
    setInputKey('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputKey.trim();

    if (!trimmed) {
      setErrorMessage('API key cannot be empty. Please enter your Gemini API key.');
      return;
    }

    setIsValidating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const result = await validateAndConnectKey(trimmed);
    setIsValidating(false);

    if (result.success) {
      setSuccessMessage('Gemini AI connected successfully! Loading dashboard…');
      setTimeout(() => {
        closeSetupModal();
      }, 700);
    } else {
      setErrorMessage(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl shadow-emerald-950/50 flex flex-col overflow-hidden text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-setup-title"
      >
        {/* Header with Plant Talk Branding */}
        <div className="relative px-5 pt-6 pb-4 bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-900 border-b border-slate-800 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 p-2 shadow-inner shadow-emerald-500/20 mb-3 flex items-center justify-center">
            <img src={plantTalkLogo} alt="Plant Talk" className="w-full h-full object-contain" />
          </div>

          <h2 id="api-setup-title" className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Plant Talk <span className="text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">v4.0</span>
          </h2>
          <p className="text-xs font-semibold text-emerald-400 mt-0.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Gemini AI Setup
          </p>
          <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">
            Enter your Google Gemini API key to enable live camera plant analysis, botanical diagnoses, and plant speech synthesis.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-300">
              <label htmlFor="gemini-key-input" className="flex items-center gap-1.5 font-semibold">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                Gemini API Key
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePaste}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="w-3 h-3" /> Paste
                </button>
                {inputKey && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                    title="Clear input"
                  >
                    <XCircle className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
            </div>

            {/* Input Wrapper */}
            <div className="relative flex items-center">
              <input
                id="gemini-key-input"
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy••••••••••••••••••••••••••••••"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isValidating}
                autoComplete="off"
                spellCheck="false"
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono text-slate-100 placeholder:text-slate-600 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key'}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Feedback states */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">
                <span className="font-semibold text-rose-300">Connection Failed: </span>
                {errorMessage}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-200 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Connect Action Button */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              disabled={isValidating || !inputKey.trim()}
              className="w-full min-h-[42px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl py-2.5 px-4 shadow-lg shadow-emerald-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating Key with Gemini…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Connect AI</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={closeSetupModal}
              className="w-full py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors text-center cursor-pointer"
            >
              Skip for now (Browse Offline / Telemetry Mode)
            </button>
          </div>
        </form>

        {/* Security & Info Footer */}
        <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Isolated to current browser session</span>
          </div>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
          >
            <span>Get Gemini Key</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
