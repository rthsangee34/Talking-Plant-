import React, { useState } from 'react';
import {
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Link as LinkIcon,
  ChevronDown,
  Brain,
  Mic,
  Radio,
  Camera,
  Sprout,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { defaultAIProvider } from '../../services/ai/gemini-provider';

interface HomePageProps {
  onSuccess?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSuccess }) => {
  const { apiKey, setApiKeyConfigured, setApiStatus, validateAndConnectKey } = useSettingsStore();

  const [inputKey, setInputKey] = useState<string>(
    apiKey || import.meta.env.VITE_GEMINI_API_KEY || ''
  );
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputKey.trim();

    if (!trimmed) {
      setErrorMessage('Please enter your API key.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsValidating(true);

    try {
      const validation = await defaultAIProvider.validateKey(trimmed);

      if (validation.valid) {
        setSuccessMessage('✓ Connected successfully! Opening Plant Talk...');
        await validateAndConnectKey(trimmed);
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
        }, 700);
      } else {
        setErrorMessage(validation.message || 'The API key could not be validated. Please check the key and try again.');
      }
    } catch {
      setErrorMessage('Unable to connect to the AI service. Check your internet connection and try again.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] lg:h-screen lg:max-h-screen w-full max-w-full overflow-x-hidden overflow-y-auto lg:overflow-hidden select-none flex flex-col justify-between font-sans scroll-smooth">
      {/* ─────────────────────────────────────────────────────────────
          BOTANICAL BACKGROUND WITH BOKEH & SOIL SPROUT
          ───────────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/setup-bg.jpg"
          alt="Lush Botanical Seedling Background"
          className="w-full h-full object-cover object-center filter brightness-[1.02] contrast-[1.02]"
        />
        {/* Soft daylight and depth overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/25 via-white/10 to-emerald-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.4)_0%,transparent_70%)]" />
      </div>

      {/* Main Content Grid */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
          
          {/* ─────────────────────────────────────────────────────────
              BRAND IDENTITY & FEATURE HIGHLIGHTS
              (Desktop: Left Column | Mobile: Order 1 with smooth scroll to configuration)
              ───────────────────────────────────────────────────────── */}
          <div className="lg:col-span-6 flex flex-col items-start text-left bg-white/35 backdrop-blur-md p-5 sm:p-8 rounded-2xl sm:rounded-[32px] border border-white/70 shadow-xl order-1">
            {/* VCET Talking Plant Official Logo Badge - Clean Transparent Die-Cut */}
            <div className="relative mb-2 sm:mb-3">
              <img
                src="/plant-talk.png"
                alt="VCET Talking Plant - Smart Agriculture Project"
                className="w-24 sm:w-32 md:w-36 h-auto object-contain filter drop-shadow-md hover:scale-105 transition-transform"
              />
            </div>

            {/* Plant Talk Main Title & Slogan */}
            <div className="flex items-center gap-2.5 sm:gap-3 mt-1">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-emerald-700 flex items-center justify-center text-white shadow-md shrink-0">
                <Sprout className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-emerald-950 font-['Outfit']">
                  Plant Talk
                </h1>
                <p className="text-emerald-900 font-semibold text-sm sm:text-base md:text-lg tracking-tight">
                  Your Plant&apos;s AI Companion
                </p>
              </div>
            </div>

            {/* Explanatory intro */}
            <p className="text-stone-800 text-xs sm:text-sm md:text-base leading-relaxed mt-3 sm:mt-4 mb-4 sm:mb-6 max-w-lg font-medium">
              Connect your AI API to unlock intelligent plant monitoring, plant analysis, voice conversations, and personalized plant care.
            </p>

            {/* 4 Feature Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 sm:gap-3.5 w-full max-w-lg">
              {/* Feature 1 */}
              <div className="flex items-center gap-3 p-2 sm:p-2.5 rounded-xl bg-white/30 sm:bg-transparent border sm:border-0 border-white/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-emerald-100/90 border border-emerald-300/60 flex items-center justify-center text-emerald-800 shrink-0 shadow-2xs">
                  <Brain className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">AI-powered plant analysis</h2>
                  <p className="text-[11px] sm:text-xs text-stone-700 font-medium">Get smart insights about your plant</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-center gap-3 p-2 sm:p-2.5 rounded-xl bg-white/30 sm:bg-transparent border sm:border-0 border-white/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-emerald-100/90 border border-emerald-300/60 flex items-center justify-center text-emerald-800 shrink-0 shadow-2xs">
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">Voice plant assistant</h2>
                  <p className="text-[11px] sm:text-xs text-stone-700 font-medium">Talk to your plant, get real-time answers</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-center gap-3 p-2 sm:p-2.5 rounded-xl bg-white/30 sm:bg-transparent border sm:border-0 border-white/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-emerald-100/90 border border-emerald-300/60 flex items-center justify-center text-emerald-800 shrink-0 shadow-2xs">
                  <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">Sensor-aware recommendations</h2>
                  <p className="text-[11px] sm:text-xs text-stone-700 font-medium">Based on real environmental data</p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex items-center gap-3 p-2 sm:p-2.5 rounded-xl bg-white/30 sm:bg-transparent border sm:border-0 border-white/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-emerald-100/90 border border-emerald-300/60 flex items-center justify-center text-emerald-800 shrink-0 shadow-2xs">
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">Camera plant monitoring</h2>
                  <p className="text-[11px] sm:text-xs text-stone-700 font-medium">See your plant, anytime, anywhere</p>
                </div>
              </div>
            </div>

            {/* Playful cursive handwriting note */}
            <div className="mt-4 sm:mt-6 ml-1 sm:ml-2 transform -rotate-1 sm:-rotate-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <span className="font-['Caveat',cursive] text-xl sm:text-2xl md:text-3xl text-emerald-900 font-bold tracking-wide drop-shadow-xs">
                Better Care — Bigger Growth 🍃
              </span>

              {/* Mobile Scroll Indicator Button */}
              <a
                href="#ai-config-card"
                className="lg:hidden inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-emerald-800 text-white text-xs font-bold shadow-md hover:bg-emerald-900 transition-all active:scale-95"
              >
                <span>Setup AI Connection</span>
                <span className="animate-bounce">↓</span>
              </a>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              RIGHT COLUMN: FROSTED WHITE AI CONFIGURATION CARD
              (Order 2 on mobile: accessible via natural touch scroll or setup button)
              ───────────────────────────────────────────────────────── */}
          <div id="ai-config-card" className="lg:col-span-6 flex justify-center lg:justify-end order-2 scroll-mt-6">
            <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-2xl sm:rounded-[32px] p-5 sm:p-8 md:p-9 shadow-2xl border border-white/90 text-stone-900">
              
              {/* Card Header */}
              <div className="flex items-start gap-3 sm:gap-3.5 mb-5 sm:mb-6">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-100 border border-emerald-300/70 flex items-center justify-center text-emerald-800 shrink-0 shadow-xs">
                  <Sprout className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-950 font-['Outfit']">
                    Configure Your AI Connection
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 font-medium mt-0.5">
                    Enter your Gemini API key to enable AI-powered features and start your plant journey.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {/* AI Provider Selector */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 tracking-wider uppercase mb-1.5">
                    AI Provider
                  </label>
                  <div className="relative">
                    <div className="w-full flex items-center justify-between px-3.5 py-3 sm:py-2.5 rounded-xl border border-stone-300/90 bg-stone-50/90 shadow-xs text-sm font-semibold text-stone-800">
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-sky-600" />
                        <span>Google Gemini</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-stone-500" />
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500 font-medium mt-1">
                    Powered by Google&apos;s Gemini AI
                  </p>
                </div>

                {/* Gemini API Key Input */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 tracking-wider uppercase mb-1.5">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={inputKey}
                      onChange={(e) => {
                        setInputKey(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Enter your API key here"
                      disabled={isValidating}
                      autoComplete="off"
                      spellCheck="false"
                      className="w-full px-3.5 py-3 sm:py-2.5 pr-11 rounded-xl border border-stone-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white text-stone-900 text-base sm:text-sm placeholder:text-stone-400 font-mono tracking-wider transition-all disabled:bg-stone-100 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-2 sm:p-1 transition-colors cursor-pointer"
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Security Guarantee Box */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50/70 border border-teal-200/70 text-teal-900 text-xs leading-relaxed">
                  <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Your API key is stored securely and never shared.</span>
                    <span className="block text-[11px] text-teal-800/90 mt-0.5">
                      We do not save or log your key.
                    </span>
                  </div>
                </div>

                {/* Dynamic Error State */}
                {errorMessage && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Dynamic Success State */}
                {successMessage && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isValidating}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-900 hover:to-emerald-800 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting to Plant Talk AI...</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      <span>Connect & Continue →</span>
                    </>
                  )}
                </button>

                {/* Required Notice Badge */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Your API key is required to use Plant Talk AI.</span>
                </div>
              </form>
            </div>
          </div>

        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          FOOTER BRANDING
          ───────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 py-4 text-center text-xs text-stone-700 font-medium">
        <span>🌱 Plant Talk | AI + IoT + Better Plants</span>
      </footer>
    </div>
  );
};
