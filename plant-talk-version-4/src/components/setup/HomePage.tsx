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
  ArrowLeft,
  ExternalLink,
  ClipboardPaste,
  Volume2,
  Info,
  Droplets,
  Sun,
  Thermometer,
  Zap,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useAuthStore } from '../../stores/auth-store';
import { defaultAIProvider } from '../../services/ai/gemini-provider';

interface HomePageProps {
  onSuccess?: () => void;
  onReturnToLanding?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSuccess, onReturnToLanding }) => {
  const { apiKey, setApiKeyConfigured, setApiStatus, validateAndConnectKey } = useSettingsStore();
  const { user, signOut } = useAuthStore();

  const [inputKey, setInputKey] = useState<string>(apiKey || '');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationStage, setValidationStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Interactive feature simulation tab
  const [activeFeatureTab, setActiveFeatureTab] = useState<'ai' | 'voice' | 'sensors' | 'camera'>('ai');
  const [isPlayingVoice, setIsPlayingVoice] = useState<boolean>(false);

  // Quick Paste from Clipboard
  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setInputKey(text.trim());
        setErrorMessage(null);
      }
    } catch {
      // Clipboard access might be blocked
    }
  };

  // Live voice preview handler using browser speech synthesis
  const handlePlayVoicePreview = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsPlayingVoice(true);

    const utterance = new SpeechSynthesisUtterance(
      "Hello friend! I am your plant companion. My sensors indicate good moisture and bright daylight!"
    );
    utterance.pitch = 1.15;
    utterance.rate = 0.95;

    utterance.onend = () => setIsPlayingVoice(false);
    utterance.onerror = () => setIsPlayingVoice(false);

    window.speechSynthesis.speak(utterance);
  };

  // Demo / Quick Test connection handler
  const handleDemoMode = async () => {
    setIsValidating(true);
    setValidationStage('Enabling demo plant companion...');
    setErrorMessage(null);

    setTimeout(() => {
      setApiKeyConfigured(true);
      setApiStatus('AI_READY');
      setIsValidating(false);
      if (onSuccess) onSuccess();
    }, 900);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputKey.trim();

    if (!trimmed) {
      setErrorMessage('Please enter your Gemini API key.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsValidating(true);
    setValidationStage('Connecting to Google Gemini API...');

    try {
      setValidationStage('Verifying Gemini 2.5 Flash model access...');
      const validation = await defaultAIProvider.validateKey(trimmed);

      if (validation.valid) {
        setValidationStage('Initializing plant biological engine...');
        setSuccessMessage('✓ Connected successfully! Opening Plant Talk...');
        await validateAndConnectKey(trimmed);
        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
        }, 800);
      } else {
        setErrorMessage(validation.message || 'The API key could not be validated. Please check the key and try again.');
      }
    } catch {
      setErrorMessage('Unable to connect to the AI service. Check your internet connection and try again.');
    } finally {
      setIsValidating(false);
      setValidationStage('');
    }
  };

  // Key syntax check
  const isKeyFormatValid = inputKey.startsWith('AIzaSy') && inputKey.length >= 35;

  return (
    <div className="relative min-h-screen w-screen overflow-x-hidden overflow-y-auto select-none flex flex-col justify-between font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          BOTANICAL BACKGROUND WITH BOKEH & SOIL SPROUT
          ───────────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/setup-bg.jpg"
          alt="Botanical Seedling Background"
          className="w-full h-full object-cover object-center filter brightness-[1.03] contrast-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/30 via-white/10 to-emerald-900/25" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.45)_0%,transparent_70%)]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP UTILITY BAR: BACK TO LANDING & USER ACCOUNT
          ───────────────────────────────────────────────────────────── */}
      <nav className="relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 flex items-center justify-between">
        <button
          onClick={onReturnToLanding || (() => window.location.hash = '')}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white backdrop-blur-md border border-white/90 text-stone-700 hover:text-emerald-900 text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-700" />
          <span>Back to Landing Page</span>
        </button>

        {user && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-white/90 shadow-sm text-xs font-bold text-stone-700">
            {user.photoURL && (
              <img src={user.photoURL} alt="User Avatar" className="w-5 h-5 rounded-full object-cover border border-emerald-400" />
            )}
            <span className="text-emerald-950 truncate max-w-[140px]">{user.displayName || user.email}</span>
            <span className="text-stone-300">|</span>
            <button
              onClick={() => signOut()}
              className="text-stone-500 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        )}
      </nav>

      {/* Main Content Grid */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ─────────────────────────────────────────────────────────
              LEFT COLUMN: BRAND IDENTITY & INTERACTIVE FEATURE SHOWCASE
              ───────────────────────────────────────────────────────── */}
          <div className="lg:col-span-6 flex flex-col items-start text-left bg-white/40 backdrop-blur-xl p-6 sm:p-8 rounded-[36px] border border-white/70 shadow-2xl">
            
            {/* Transparent Official Logo */}
            <div className="relative mb-2">
              <img
                src="/planttalklogo.png"
                alt="VCET Talking Plant Logo"
                className="w-32 sm:w-40 md:w-44 object-contain filter drop-shadow-lg hover:scale-105 transition-transform"
              />
            </div>

            {/* Plant Talk Title & Slogan */}
            <div className="flex items-center gap-3 mt-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-700 flex items-center justify-center text-white shadow-md">
                <Sprout className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-emerald-950 font-['Outfit']">
                  Plant Talk
                </h1>
                <p className="text-emerald-900 font-semibold text-sm sm:text-base tracking-tight">
                  Your Plant&apos;s AI Companion
                </p>
              </div>
            </div>

            <p className="text-stone-800 text-sm leading-relaxed mt-3 mb-5 max-w-lg font-medium">
              Connect your Google Gemini AI API key to unlock real-time botanical intelligence, voice dialogue, and continuous telemetry monitoring.
            </p>

            {/* Interactive Feature Selectors */}
            <div className="w-full space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950 mb-1 select-none">
                <span>Interactive Capabilities</span>
                <span className="text-[11px] text-emerald-700 font-semibold">Click to preview</span>
              </div>

              {/* Feature 1: AI Analysis */}
              <button
                type="button"
                onClick={() => setActiveFeatureTab('ai')}
                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                  activeFeatureTab === 'ai'
                    ? 'bg-white shadow-md border-emerald-400'
                    : 'bg-white/40 hover:bg-white/70 border-white/60'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                  <Brain className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-stone-900 tracking-tight">AI-powered plant analysis</h2>
                  <p className="text-xs text-stone-600 font-medium">Get smart biological insights about your plant</p>
                </div>
              </button>

              {/* Feature 2: Voice Assistant */}
              <button
                type="button"
                onClick={() => setActiveFeatureTab('voice')}
                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                  activeFeatureTab === 'voice'
                    ? 'bg-white shadow-md border-emerald-400'
                    : 'bg-white/40 hover:bg-white/70 border-white/60'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-stone-900 tracking-tight">Voice plant assistant</h2>
                  <p className="text-xs text-stone-600 font-medium">Talk to your plant, hear instant spoken replies</p>
                </div>
              </button>

              {/* Feature 3: Sensor Telemetry */}
              <button
                type="button"
                onClick={() => setActiveFeatureTab('sensors')}
                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                  activeFeatureTab === 'sensors'
                    ? 'bg-white shadow-md border-emerald-400'
                    : 'bg-white/40 hover:bg-white/70 border-white/60'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                  <Radio className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-stone-900 tracking-tight">Sensor-aware telemetry</h2>
                  <p className="text-xs text-stone-600 font-medium">Real environmental data (Moisture, Light, Temp)</p>
                </div>
              </button>

              {/* Feature 4: Camera Vision */}
              <button
                type="button"
                onClick={() => setActiveFeatureTab('camera')}
                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                  activeFeatureTab === 'camera'
                    ? 'bg-white shadow-md border-emerald-400'
                    : 'bg-white/40 hover:bg-white/70 border-white/60'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shrink-0">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-stone-900 tracking-tight">Computer vision inspection</h2>
                  <p className="text-xs text-stone-600 font-medium">Automatic multi-leaf and touch guard tracking</p>
                </div>
              </button>
            </div>

            {/* Interactive Live Preview Box Based on Selected Tab */}
            <div className="w-full p-4 rounded-2xl bg-emerald-900/10 border border-emerald-700/20 backdrop-blur-md text-emerald-950 text-xs">
              {activeFeatureTab === 'ai' && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Live Botanical Diagnostic Simulation
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px]">Optimal</span>
                  </div>
                  <p className="text-stone-700 text-[11px] leading-relaxed">
                    &ldquo;Chlorophyll density is vibrant. Photosynthesis rate estimated at 92%. Soil moisture and daylight balance are currently exemplary.&rdquo;
                  </p>
                </div>
              )}

              {activeFeatureTab === 'voice' && (
                <div className="flex items-center justify-between gap-3 animate-in fade-in duration-200">
                  <div>
                    <span className="font-bold block text-emerald-900">Spoken Voice Engine</span>
                    <span className="text-[11px] text-stone-700">Hear what your plant friend sounds like:</span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePlayVoicePreview}
                    disabled={isPlayingVoice}
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isPlayingVoice ? 'Speaking...' : 'Play Voice'}</span>
                  </button>
                </div>
              )}

              {activeFeatureTab === 'sensors' && (
                <div className="grid grid-cols-3 gap-2 text-center animate-in fade-in duration-200">
                  <div className="p-2 rounded-xl bg-white/70 border border-emerald-200">
                    <Droplets className="w-4 h-4 text-sky-600 mx-auto mb-1" />
                    <span className="block text-[10px] text-stone-600">Moisture</span>
                    <span className="font-bold text-emerald-900 text-xs">68% Good</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/70 border border-emerald-200">
                    <Sun className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                    <span className="block text-[10px] text-stone-600">Light</span>
                    <span className="font-bold text-emerald-900 text-xs">82% Bright</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/70 border border-emerald-200">
                    <Thermometer className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                    <span className="block text-[10px] text-stone-600">Temp</span>
                    <span className="font-bold text-emerald-900 text-xs">22.4°C</span>
                  </div>
                </div>
              )}

              {activeFeatureTab === 'camera' && (
                <div className="flex items-center gap-3 animate-in fade-in duration-200">
                  <div className="w-12 h-10 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-center text-emerald-700">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-900 block">Edge Machine Learning</span>
                    <span className="text-[11px] text-stone-700">Hand-pose tracking & plant touch detection ready</span>
                  </div>
                </div>
              )}
            </div>

            {/* Slogan */}
            <div className="mt-4 transform -rotate-2 select-none">
              <span className="font-['Caveat',cursive] text-2xl text-emerald-900 font-bold tracking-wide">
                Better Care — Bigger Growth 🍃
              </span>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              RIGHT COLUMN: FROSTED GLASS AI CONFIGURATION CARD
              ───────────────────────────────────────────────────────── */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-[36px] p-6 sm:p-8 md:p-9 shadow-2xl border border-white/90 text-stone-900 transition-all">
              
              {/* Card Header */}
              <div className="flex items-start gap-3.5 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300/70 flex items-center justify-center text-emerald-800 shrink-0 shadow-xs">
                  <Sprout className="w-6 h-6" />
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

              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* AI Provider Selector */}
                <div>
                  <label className="block text-xs font-bold text-stone-800 tracking-wider uppercase mb-1.5">
                    AI Provider
                  </label>
                  <div className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-stone-300/90 bg-stone-50/90 shadow-xs text-sm font-semibold text-stone-800">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <span>Google Gemini (gemini-2.5-flash)</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-stone-400" />
                  </div>
                  <p className="text-[11px] text-stone-500 font-medium mt-1">
                    Powered by Google&apos;s latest multimodal Gemini AI models
                  </p>
                </div>

                {/* Gemini API Key Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-stone-800 tracking-wider uppercase">
                      Gemini API Key
                    </label>

                    {/* Quick Paste Button */}
                    <button
                      type="button"
                      onClick={handlePasteKey}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>Paste Key</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={inputKey}
                      onChange={(e) => {
                        setInputKey(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="AIzaSy..."
                      disabled={isValidating}
                      autoComplete="off"
                      spellCheck="false"
                      className={`w-full px-3.5 py-2.5 pr-20 rounded-xl border ${
                        isKeyFormatValid
                          ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                          : 'border-stone-300 focus:border-emerald-600'
                      } bg-white text-stone-900 text-sm placeholder:text-stone-400 font-mono tracking-wider transition-all disabled:bg-stone-100 disabled:cursor-not-allowed`}
                    />
                    
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {isKeyFormatValid && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" title="Valid Gemini API key format" />
                      )}
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        tabIndex={-1}
                        className="text-stone-400 hover:text-stone-600 p-1.5 transition-colors cursor-pointer"
                        title={showKey ? 'Hide key' : 'Show key'}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Free API key helper link */}
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Info className="w-3 h-3" />
                      <span>{showGuide ? 'Hide API key instructions' : 'Where to get a free Gemini API key?'}</span>
                    </button>
                  </div>
                </div>

                {/* Expandable Free API Key Guide */}
                {showGuide && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-2 animate-in slide-in-from-top-1">
                    <p className="font-bold flex items-center justify-between">
                      <span>How to obtain a free key:</span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-800 underline font-bold"
                      >
                        <span>Open Google AI Studio</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-emerald-900/90 text-[11px]">
                      <li>Sign in to Google AI Studio with your Google account.</li>
                      <li>Click &ldquo;Create API Key&rdquo; and select or create a project.</li>
                      <li>Copy the generated key (starts with <code>AIzaSy...</code>) and paste it above!</li>
                    </ol>
                  </div>
                )}

                {/* Security Guarantee Box */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50/70 border border-teal-200/70 text-teal-900 text-xs leading-relaxed">
                  <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Your API key is stored securely in your browser session.</span>
                    <span className="block text-[11px] text-teal-800/90 mt-0.5">
                      It is never logged or shared with external parties.
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
                      <span>{validationStage || 'Connecting to Plant Talk AI...'}</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      <span>Connect & Continue →</span>
                    </>
                  )}
                </button>

                {/* Demo Key / Quick Test Button */}
                <div className="pt-1 flex items-center justify-between border-t border-stone-200/60">
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Want to test first?</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDemoMode}
                    disabled={isValidating}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 text-stone-700 hover:text-emerald-800 text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                  >
                    <Zap className="w-3 h-3 text-amber-500" />
                    <span>Quick Interactive Preview</span>
                  </button>
                </div>

              </form>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 py-4 text-center text-xs text-stone-700 font-medium select-none">
        <span>🌱 Plant Talk | AI + IoT + Better Plants</span>
      </footer>

    </div>
  );
};
