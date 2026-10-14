import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  Brain,
  Mic,
  Radio,
  Camera,
  Leaf,
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
  Key,
  Shield,
  Zap,
  Cpu,
  X,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useAuthStore } from '../../stores/auth-store';
import { defaultAIProvider } from '../../services/ai/gemini-provider';
import { detectGeminiModels, DetectedGeminiInfo } from '../../services/ai/gemini-detector';
import { setFirebaseVariables } from '../../services/firebase-variables';

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

  // Dynamic Gemini version auto-detection states
  const [detectedVersion, setDetectedVersion] = useState<string>('gemini-2.5-flash');
  const [availableModels, setAvailableModels] = useState<string[]>([
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ]);
  const [isDetectingVersion, setIsDetectingVersion] = useState<boolean>(false);
  const [isVersionAutoDetected, setIsVersionAutoDetected] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  // Interactive feature drawer / modal
  const [interactiveFeature, setInteractiveFeature] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState<boolean>(false);

  // ───────────────────────────────────────────────────────────────────────────
  // AUTO-DETECT GEMINI VERSION WHEN USER ENTERS KEY
  // ───────────────────────────────────────────────────────────────────────────
  const runAutoDetect = useCallback(async (keyToTest: string) => {
    const trimmed = keyToTest.trim();
    if (!trimmed || trimmed.length < 20) {
      setIsVersionAutoDetected(false);
      return;
    }

    setIsDetectingVersion(true);
    try {
      const info: DetectedGeminiInfo = await detectGeminiModels(trimmed);
      if (info.valid) {
        setDetectedVersion(info.selectedModel);
        setAvailableModels(info.allModels);
        setIsVersionAutoDetected(true);
        setErrorMessage(null);
      }
    } catch {
      // Ignored during passive keystroke detection
    } finally {
      setIsDetectingVersion(false);
    }
  }, []);

  // Debounced keystroke detection
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputKey && inputKey.trim().length >= 25) {
        runAutoDetect(inputKey);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [inputKey, runAutoDetect]);

  // Paste from clipboard handler
  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const clean = text.trim();
        setInputKey(clean);
        setErrorMessage(null);
        runAutoDetect(clean);
      }
    } catch {
      // Browser clipboard permission may be blocked
    }
  };

  // Voice preview simulation
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

  // Form submission: Validate, auto-detect, set Firebase variables, and launch
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
    setValidationStage('Auto-detecting Gemini model version...');

    try {
      // Step 1: Detect available Gemini models for this key
      const detectionResult = await detectGeminiModels(trimmed);
      let activeModel = detectedVersion;

      if (detectionResult.valid) {
        activeModel = detectionResult.selectedModel;
        setDetectedVersion(detectionResult.selectedModel);
        setAvailableModels(detectionResult.allModels);
        setIsVersionAutoDetected(true);
      }

      setValidationStage(`Verifying ${activeModel} model access...`);

      // Step 2: Validate with AI service
      const validation = await defaultAIProvider.validateKey(trimmed);

      if (validation.valid) {
        // Step 3: Set variables in Firebase
        setValidationStage('Setting variables in Firebase...');
        await setFirebaseVariables({
          geminiVersion: activeModel,
          availableModels: detectionResult.allModels.length ? detectionResult.allModels : availableModels,
          userId: user?.uid,
          userEmail: user?.email || undefined,
          apiKeyConfigured: true,
        });

        // Step 4: Finalize local store connection
        setValidationStage('Starting Plant Companion...');
        setSuccessMessage(`✓ Connected with ${activeModel}! Launching Plant Talk...`);
        await validateAndConnectKey(trimmed);

        setTimeout(() => {
          if (onSuccess) {
            onSuccess();
          }
        }, 750);
      } else {
        setErrorMessage(validation.message || 'The API key could not be validated. Please check the key.');
      }
    } catch {
      setErrorMessage('Unable to connect to the AI service. Please check your internet connection.');
    } finally {
      setIsValidating(false);
      setValidationStage('');
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden overflow-y-auto select-none flex flex-col justify-between font-sans bg-[#f3f7f4]">
      
      {/* ─────────────────────────────────────────────────────────────
          SUNLIT BOTANICAL LEAF BACKGROUND
          ───────────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/setup-bg.jpg"
          alt="Lush Sunlit Foliage"
          className="w-full h-full object-cover object-center filter brightness-[1.04] contrast-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/25 via-white/10 to-emerald-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.4)_0%,transparent_70%)]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP BAR: USER PROFILE & SIGN OUT ONLY
          ───────────────────────────────────────────────────────────── */}
      <nav className="relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 flex items-center justify-end">
        {user && (
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-white/90 shadow-sm text-xs font-bold text-stone-700">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="w-5 h-5 rounded-full object-cover border border-emerald-400" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">
                {user.displayName?.[0] || 'U'}
              </div>
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

      {/* ─────────────────────────────────────────────────────────────
          MAIN DUAL CARD GRID (MATCHING 2ND REFERENCE DESIGN IMAGE)
          ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          
          {/* ─────────────────────────────────────────────────────────
              LEFT CARD: LIQUID GLASS WITH BRAND & 4 INTERACTIVE PILLS
              ───────────────────────────────────────────────────────── */}
          <div className="lg:col-span-6 flex flex-col justify-between bg-white/70 backdrop-blur-2xl p-5 sm:p-6 lg:p-7 rounded-[28px] border border-white/80 shadow-2xl shadow-emerald-950/10">
            <div>
              {/* Brand Header */}
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-md shrink-0">
                  <img
                    src="/plant-sprout-icon.png"
                    alt="Plant Talk Sprout Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-950 font-['Outfit']">
                      Plant Talk
                    </h1>
                    <span className="text-emerald-600 text-xl sm:text-2xl">🍃</span>
                  </div>
                  <p className="text-emerald-700 font-bold text-xs sm:text-sm tracking-tight mt-0.5">
                    Your Plant&apos;s AI Companion
                  </p>
                </div>
              </div>

              {/* Explanatory description */}
              <p className="text-stone-700 text-xs sm:text-sm leading-relaxed mt-2.5 mb-3.5 font-medium">
                Connect your Google Gemini AI API key to unlock real-time botanical intelligence, voice dialogue, and continuous telemetry monitoring.
              </p>

              {/* Key Features Header with Cursive Calligraphy */}
              <div className="flex items-center justify-between mb-2.5 select-none">
                <div className="flex items-center gap-1.5 text-stone-900 font-extrabold text-sm sm:text-base tracking-tight">
                  <Leaf className="w-4 h-4 text-emerald-700" />
                  <span>Key Features</span>
                </div>
                <span className="font-['Caveat',cursive] text-emerald-800 font-bold text-base sm:text-lg tracking-wide">
                  Smarter Plants, Healthier Tomorrow 🍃
                </span>
              </div>

              {/* 4 Interactive Feature Cards */}
              <div className="space-y-2.5">
                {/* 1. AI Analysis */}
                <button
                  type="button"
                  onClick={() => setInteractiveFeature(interactiveFeature === 'ai' ? null : 'ai')}
                  className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white hover:bg-emerald-50/50 border border-stone-200/60 hover:border-emerald-300 shadow-xs hover:shadow-sm transition-all text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#16a34a] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Leaf className="w-4 h-4 sm:w-5 sm:h-5 fill-white/20" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">
                        AI-Powered Plant Analysis
                      </h2>
                      <p className="text-[11px] sm:text-xs text-stone-600 font-medium truncate">
                        Get smart biological insights about your plant
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-700 transition-colors shrink-0 ml-2" />
                </button>

                {/* 2. Voice Assistant */}
                <button
                  type="button"
                  onClick={() => setInteractiveFeature(interactiveFeature === 'voice' ? null : 'voice')}
                  className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white hover:bg-emerald-50/50 border border-stone-200/60 hover:border-emerald-300 shadow-xs hover:shadow-sm transition-all text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0284c7] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">
                        Voice Plant Assistant
                      </h2>
                      <p className="text-[11px] sm:text-xs text-stone-600 font-medium truncate">
                        Talk to your plant, hear instant spoken replies
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-700 transition-colors shrink-0 ml-2" />
                </button>

                {/* 3. Sensor Telemetry */}
                <button
                  type="button"
                  onClick={() => setInteractiveFeature(interactiveFeature === 'sensors' ? null : 'sensors')}
                  className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white hover:bg-emerald-50/50 border border-stone-200/60 hover:border-emerald-300 shadow-xs hover:shadow-sm transition-all text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#9333ea] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">
                        Sensor-aware Telemetry
                      </h2>
                      <p className="text-[11px] sm:text-xs text-stone-600 font-medium truncate">
                        Real environmental data (Moisture, Light, Temp)
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-700 transition-colors shrink-0 ml-2" />
                </button>

                {/* 4. Computer Vision */}
                <button
                  type="button"
                  onClick={() => setInteractiveFeature(interactiveFeature === 'camera' ? null : 'camera')}
                  className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white hover:bg-emerald-50/50 border border-stone-200/60 hover:border-emerald-300 shadow-xs hover:shadow-sm transition-all text-left cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#f59e0b] text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold text-stone-900 tracking-tight">
                        Computer Vision Inspection
                      </h2>
                      <p className="text-[11px] sm:text-xs text-stone-600 font-medium truncate">
                        Automatic multi-leaf and touch guard tracking
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-700 transition-colors shrink-0 ml-2" />
                </button>
              </div>

              {/* Interactive Demo Expansion Drawer */}
              {interactiveFeature && (
                <div className="mt-4 p-4 rounded-2xl bg-white border border-emerald-300 shadow-lg text-xs animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Interactive Live Preview
                    </span>
                    <button
                      type="button"
                      onClick={() => setInteractiveFeature(null)}
                      className="p-1 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {interactiveFeature === 'ai' && (
                    <div className="space-y-1 text-stone-700">
                      <p className="font-semibold text-emerald-800">Sample Botanical Diagnosis:</p>
                      <p className="italic bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                        &ldquo;Photosynthesis efficiency rated at 94%. Leaf pigmentation indicates healthy nitrogen absorption. No structural stress detected.&rdquo;
                      </p>
                    </div>
                  )}

                  {interactiveFeature === 'voice' && (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-emerald-900">Spoken Voice Preview</p>
                        <p className="text-stone-600 text-[11px]">Click to hear your plant companion speak:</p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePlayVoicePreview}
                        disabled={isPlayingVoice}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-60"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{isPlayingVoice ? 'Speaking...' : 'Play Voice'}</span>
                      </button>
                    </div>
                  )}

                  {interactiveFeature === 'sensors' && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-sky-50 border border-sky-200">
                        <Droplets className="w-4 h-4 text-sky-600 mx-auto mb-1" />
                        <span className="block text-[10px] text-stone-600">Moisture</span>
                        <span className="font-bold text-sky-900 text-xs">68% Good</span>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                        <Sun className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                        <span className="block text-[10px] text-stone-600">Light</span>
                        <span className="font-bold text-amber-900 text-xs">84% Bright</span>
                      </div>
                      <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                        <Thermometer className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                        <span className="block text-[10px] text-stone-600">Temp</span>
                        <span className="font-bold text-rose-900 text-xs">22.5°C</span>
                      </div>
                    </div>
                  )}

                  {interactiveFeature === 'camera' && (
                    <div className="flex items-center gap-2.5 text-stone-700">
                      <Camera className="w-6 h-6 text-emerald-700 shrink-0" />
                      <p>
                        Real-time edge neural network active. Evaluates leaf morphology, pest infestation, and triggers vocal warnings if plant is disturbed.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-4 text-xs text-stone-500 font-medium">
              <span>🌱 Powered by Google Gemini AI & VCOT Smart Agriculture Project</span>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              RIGHT CARD: GREEN ROBOT HEADER BANNER & AI CONFIG FORM
              ───────────────────────────────────────────────────────── */}
          <div className="lg:col-span-6 flex flex-col justify-between bg-white/95 backdrop-blur-2xl rounded-[28px] p-5 sm:p-6 shadow-2xl border border-white/90 text-stone-900">
            <div>
              {/* Green Header Banner Matching Reference Design Image */}
              <div className="relative rounded-2xl overflow-hidden mb-3.5 shadow-md bg-gradient-to-r from-[#16a34a] via-[#15803d] to-[#047857] text-white p-4 sm:p-4.5 flex items-center justify-between gap-3">
                <div className="relative z-10 flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white font-['Outfit'] truncate">
                      Configure Your AI Connection
                    </h3>
                  </div>
                  <p className="text-emerald-100 text-[11px] sm:text-xs leading-relaxed font-normal">
                    Enter your Gemini API key to enable AI-powered features and start your plant journey.
                  </p>
                </div>

                {/* Cute Smiling Plant Robot with Speech Bubble */}
                <div className="relative shrink-0 w-22 sm:w-26 h-auto flex items-center justify-center">
                  <img
                    src="/plant-bot-companion.png"
                    alt="Plant Friend Companion Robot"
                    className="w-full h-auto object-contain filter drop-shadow-md"
                  />
                </div>
              </div>

              {/* Form Controls */}
              <form onSubmit={handleSubmit} className="space-y-3">
                
                {/* 1. AI Provider Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-stone-800 tracking-wider uppercase">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                      <span>AI Provider</span>
                    </label>

                    {isVersionAutoDetected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Auto-detected from Key
                      </span>
                    )}
                  </div>

                  {/* Dropdown Container */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-stone-300/90 bg-white shadow-xs text-xs sm:text-sm font-semibold text-stone-800 hover:border-emerald-500 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Google Logo Icon */}
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                        <span className="truncate">Google Gemini ({detectedVersion})</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                    </button>

                    {/* Dropdown Options - Scrollable Model List */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white rounded-xl shadow-xl border border-stone-200 py-1 text-xs animate-in fade-in duration-150 max-h-48 sm:max-h-52 overflow-y-auto divide-y divide-stone-100 overscroll-contain">
                        <div className="sticky top-0 bg-white/95 backdrop-blur-xs px-3 py-1.5 font-bold text-stone-400 uppercase text-[10px] z-10 border-b border-stone-100 flex items-center justify-between">
                          <span>Available Multimodal Models</span>
                          <span className="text-[9px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-full font-semibold">{availableModels.length} models</span>
                        </div>
                        {availableModels.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setDetectedVersion(m);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-emerald-50 transition-colors cursor-pointer ${
                              detectedVersion === m ? 'font-bold text-emerald-800 bg-emerald-50/70' : 'text-stone-700'
                            }`}
                          >
                            <span className="truncate pr-2">Google Gemini ({m})</span>
                            {detectedVersion === m && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 font-medium mt-1">
                    Powered by Google&apos;s latest multimodal Gemini AI models
                  </p>
                </div>

                {/* 2. Gemini API Key Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-stone-800 tracking-wider uppercase">
                      <Key className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Gemini API Key</span>
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
                      placeholder="Enter your Gemini API key"
                      disabled={isValidating}
                      autoComplete="off"
                      spellCheck="false"
                      className="w-full px-4 py-3 pr-24 rounded-xl border border-stone-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 bg-white text-stone-900 text-sm font-mono tracking-wider transition-all disabled:bg-stone-100 disabled:cursor-not-allowed"
                    />

                    {/* Inline Auto-detection Indicator & Eye Toggle */}
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {isDetectingVersion && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Detecting...</span>
                        </div>
                      )}
                      {isVersionAutoDetected && !isDetectingVersion && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" title={`Auto-detected: ${detectedVersion}`} />
                      )}
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        tabIndex={-1}
                        className="text-stone-400 hover:text-stone-600 p-1 transition-colors cursor-pointer"
                        title={showKey ? 'Hide key' : 'Show key'}
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Free API key helper link */}
                  <div className="mt-1.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Info className="w-3 h-3" />
                      <span>{showGuide ? 'Hide instructions' : 'Where to get a free Gemini API key?'}</span>
                    </button>
                  </div>
                </div>

                {/* Expandable Free API Key Guide */}
                {showGuide && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-2 animate-in slide-in-from-top-1">
                    <p className="font-bold flex items-center justify-between">
                      <span>How to obtain a free Gemini key:</span>
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
                      <li>Paste the key above — Talking Plant will automatically identify your model version!</li>
                    </ol>
                  </div>
                )}

                {/* 3. Security Box */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50/70 border border-teal-200/70 text-teal-900 text-xs leading-relaxed">
                  <Lock className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Your API key is stored securely in your browser session.</span>
                    <span className="block text-[11px] text-teal-800/90 mt-0.5">
                      It is never logged or shared with external parties.
                    </span>
                  </div>
                </div>

                {/* Dynamic Error & Success States */}
                {errorMessage && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* 4. Connect & Continue Button */}
                <button
                  type="submit"
                  disabled={isValidating}
                  className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#16a34a] to-[#059669] hover:from-[#15803d] hover:to-[#047857] text-white font-bold text-sm tracking-wide shadow-md shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98 disabled:opacity-70 disabled:cursor-not-allowed"
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

              </form>
            </div>

            {/* ─────────────────────────────────────────────────────────
                BOTTOM 3 GUARANTEE BADGES (MATCHING 2ND REFERENCE IMAGE)
                ───────────────────────────────────────────────────────── */}
            <div className="pt-3.5 mt-3 border-t border-stone-200/60 grid grid-cols-3 gap-2 text-left">
              
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-stone-900 leading-tight">Secure & Private</h4>
                  <p className="text-[10px] text-stone-500">Your data stays yours</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-stone-900 leading-tight">Real-time AI</h4>
                  <p className="text-[10px] text-stone-500">Powered by Gemini</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Leaf className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-stone-900 leading-tight">Better Plant Care</h4>
                  <p className="text-[10px] text-stone-500">For a greener world</p>
                </div>
              </div>

            </div>

          </div>

        </div>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 py-3 text-center text-xs text-stone-700 font-medium select-none">
        <span>🌱 Plant Talk | AI + IoT + Better Plants</span>
      </footer>

    </div>
  );
};
