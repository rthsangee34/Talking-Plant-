import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Sprout,
  ArrowRight,
  Info,
  Brain,
  Droplets,
  Thermometer,
  Radio,
  Wifi,
  Battery,
  Grid,
  Sun,
} from 'lucide-react';
import { AuthModal } from './AuthModal';
import { User, onAuthStateChanged, auth } from '../../services/firebase/firebase';
import { useExperienceStore } from '../../stores/plant/experience-store';

interface LandingPageProps {
  onSuccess: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSuccess }) => {
  const shouldReduceMotion = useReducedMotion();

  // Authentication & PWA state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  // Subtle Mouse Parallax state (Desktop only)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Listen to Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Capture PWA beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Track window scroll for header transformation
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle subtle mouse parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || window.innerWidth < 1024) return;
    const { clientX, clientY, currentTarget } = e;
    const { width, height } = currentTarget.getBoundingClientRect();
    const x = (clientX / width - 0.5) * 2; // -1 to 1
    const y = (clientY / height - 0.5) * 2; // -1 to 1
    setMousePos({ x, y });
  };

  // Connect existing Install App button to native PWA installation mechanism
  const handleInstallAppClick = async () => {
    // 1. Check if already running as installed standalone PWA
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://'));

    if (isStandalone) {
      useExperienceStore.getState().showToast('Plant Talk is already installed on your device!', 'info');
      if (currentUser) {
        onSuccess();
      } else {
        setIsAuthModalOpen(true);
      }
      return;
    }

    // 2. If browser triggered beforeinstallprompt, trigger native prompt
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          useExperienceStore.getState().showToast('Plant Talk installed successfully! Welcome 🌱', 'success');
          setDeferredPrompt(null);
        } else {
          useExperienceStore.getState().showToast('Installation dismissed. You can install anytime!', 'info');
        }
      } catch (err) {
        console.warn('[PWA] Install prompt error:', err);
      }
      return;
    }

    // 3. iOS Safari limitations guidance
    const isIOS =
      typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;
    if (isIOS) {
      useExperienceStore.getState().showToast(
        "To install on iOS: Tap Share (square with arrow) and select 'Add to Home Screen' 📲",
        'info'
      );
      return;
    }

    // 4. Fallback for unsupported browsers
    useExperienceStore.getState().showToast(
      'To install: click the install icon in your address bar or browser menu 🖥️',
      'info'
    );

    if (!currentUser) {
      setIsAuthModalOpen(true);
    }
  };

  const handleAuthenticated = (_user?: any) => {
    setIsAuthModalOpen(false);
    onSuccess();
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative min-h-[100dvh] lg:h-screen lg:max-h-screen w-full max-w-full overflow-x-hidden overflow-y-auto lg:overflow-hidden select-none flex flex-col justify-between font-sans bg-[#0c2417] text-stone-900 scroll-smooth"
    >
      {/* ─────────────────────────────────────────────────────────────
          13. BACKGROUND MOTION & CINEMATIC BOTANICAL BACKDROP
          ───────────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Real photographic botanical garden background */}
        <motion.div
          animate={
            shouldReduceMotion
              ? {}
              : {
                  x: mousePos.x * -8,
                  y: mousePos.y * -6,
                  scale: [1, 1.02, 1],
                }
          }
          transition={{
            x: { duration: 0.5, ease: 'easeOut' },
            y: { duration: 0.5, ease: 'easeOut' },
            scale: { duration: 25, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)]"
        >
          <img
            src="/landing-bg.jpg"
            alt="Lush Botanical Garden Background"
            className="w-full h-full object-cover object-center filter brightness-[1.04] contrast-[1.03]"
          />
        </motion.div>

        {/* Cinematic sunbeam & ambient lighting overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/30 pointer-events-none" />
        <motion.div
          animate={
            shouldReduceMotion
              ? {}
              : {
                  opacity: [0.35, 0.55, 0.35],
                  scale: [1, 1.08, 1],
                }
          }
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-[radial-gradient(ellipse_at_top,rgba(255,250,220,0.6)_0%,transparent_70%)] pointer-events-none"
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. HEADER ANIMATION (Fixed, contained logo, blur on scroll)
          ───────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`sticky top-0 z-40 w-full transition-all duration-300 ${
          isScrolled
            ? 'bg-emerald-950/70 backdrop-blur-xl border-b border-white/10 shadow-lg py-2.5 px-4 sm:px-8'
            : 'bg-transparent py-3 sm:py-4 px-4 sm:px-8'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Official Talking Plant Logo (Small & perfectly contained inside header) */}
          <div className="flex items-center gap-2 sm:gap-2.5 max-h-10 sm:max-h-11 overflow-hidden">
            <img
              src="/plant-talk.png"
              alt="Talking Plant Official Logo"
              className="h-8 sm:h-9 w-auto object-contain filter drop-shadow hover:scale-103 transition-transform"
            />
            <div className="hidden xs:flex flex-col">
              <span className="text-xs sm:text-sm font-black tracking-wide text-white uppercase drop-shadow font-['Outfit']">
                Talking Plant
              </span>
              <span className="text-[10px] text-emerald-300 font-medium tracking-tight -mt-0.5">
                Smart Agriculture AI
              </span>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* (i) About Button */}
            <button
              type="button"
              onClick={() => setAboutModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95 shadow-xs"
            >
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
              <span>About</span>
            </button>

            {/* Header Install App Pill */}
            <button
              type="button"
              onClick={handleInstallAppClick}
              className="group relative inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-950/30 border border-emerald-400/40 transition-all cursor-pointer active:scale-95 overflow-hidden"
            >
              <Sprout className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200 group-hover:rotate-12 transition-transform" />
              <span>Install App</span>
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-0.5 transition-transform" />

              {/* Subtle periodic shine across header button */}
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_7s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
            </button>
          </div>
        </div>
      </motion.header>

      {/* ─────────────────────────────────────────────────────────────
          HERO MAIN CONTENT AREA (Staggered reveal & Motion Graphics)
          ───────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-4 items-center">
          
          {/* ─────────────────────────────────────────────────────────
              LEFT COLUMN: HERO TEXT & ACTIONS (Staggered lines)
              ───────────────────────────────────────────────────────── */}
          <div className="lg:col-span-5 flex flex-col items-start text-left z-20">
            {/* 3.1 AI-Powered Plant Conversation Badge */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
              className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-white/80 text-emerald-900 text-xs sm:text-sm font-bold shadow-sm mb-3 sm:mb-4"
            >
              <div className="w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                <Sprout className="w-2.5 h-2.5" />
              </div>
              <span className="tracking-tight">AI-Powered Plant Conversation</span>
            </motion.div>

            {/* 8. HEADLINE ANIMATION: Line-by-line reveal */}
            <div className="space-y-0.5 sm:space-y-1">
              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="text-3xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] leading-[1.08] font-['Outfit']"
              >
                Your Plants
              </motion.h1>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
                className="text-3xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] leading-[1.08] font-['Outfit']"
              >
                Have a Voice.
              </motion.h1>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.58, ease: [0.16, 1, 0.3, 1] }}
                className="text-3xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.5)] leading-[1.08] font-['Outfit']"
              >
                Now You Can Hear It.
              </motion.h1>
            </div>

            {/* 3.3 Description */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
              className="text-emerald-50 text-xs sm:text-sm lg:text-base leading-relaxed mt-3 sm:mt-4 mb-4 sm:mb-5 max-w-md font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            >
              Talking Plant uses AI and real-time sensors to understand your plants, monitor their health, and give you smart care advice — just like a conversation.
            </motion.p>

            {/* 3.4 & 9. INSTALL APP BUTTON & GOOGLE AUTH */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.85, ease: 'easeOut' }}
              className="flex flex-col gap-2.5 sm:gap-3 w-full sm:w-auto"
            >
              {/* Row: Install App + Playful handwritten note */}
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                {/* 9. Install App Button with shine pass */}
                <button
                  type="button"
                  onClick={handleInstallAppClick}
                  className="group relative px-6 sm:px-7 py-3 sm:py-3.5 rounded-full bg-gradient-to-r from-emerald-800 to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 hover:-translate-y-0.5 active:scale-97 text-white font-bold text-sm sm:text-base tracking-wide shadow-xl shadow-emerald-950/40 border border-emerald-500/40 flex items-center justify-center gap-2.5 transition-all cursor-pointer overflow-hidden"
                >
                  <Sprout className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300 group-hover:rotate-12 transition-transform" />
                  <span>Install App</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />

                  {/* Periodic animated light-sweep shine */}
                  <span className="absolute inset-0 -translate-x-full animate-[shimmer_6s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
                </button>

                {/* Playful cursive handwriting note: 'Let's grow together 🍃' */}
                <span className="font-['Caveat',cursive] text-2xl sm:text-3xl text-emerald-300 font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] select-none">
                  Let&apos;s grow together 🍃
                </span>
              </div>

              {/* 10. Secondary Sign in with Google Button */}
              <button
                type="button"
                onClick={() => (currentUser ? onSuccess() : setIsAuthModalOpen(true))}
                className="w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-full bg-white/95 hover:bg-white text-stone-800 hover:text-stone-950 font-bold text-xs sm:text-sm tracking-tight shadow-md hover:shadow-lg border border-white transition-all cursor-pointer active:scale-97 flex items-center justify-center gap-2.5 max-w-[240px]"
              >
                <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5" viewBox="0 0 24 24">
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
              </button>
            </motion.div>
          </div>

          {/* ─────────────────────────────────────────────────────────
              CENTER & RIGHT: HERO PLANT + PHONE MOCKUP + SENSORS
              ───────────────────────────────────────────────────────── */}
          <div className="lg:col-span-7 flex flex-col lg:flex-row items-center justify-center lg:justify-end gap-3 sm:gap-6 relative">
            
            {/* 4. HERO PLANT MOTION & 6. AI / VOICE EFFECT */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 1, scale: 1 }
                  : {
                      opacity: 1,
                      scale: 1,
                      y: [0, -8, 0],
                      x: mousePos.x * 6,
                    }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0.7, delay: 0.5 }
                  : {
                      opacity: { duration: 0.7, delay: 0.5 },
                      scale: { duration: 0.7, delay: 0.5 },
                      y: {
                        duration: 5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                      x: { duration: 0.4, ease: 'easeOut' },
                    }
              }
              className="relative flex items-center justify-center shrink-0 z-10"
            >
              {/* Plant Visual */}
              <div className="relative w-48 sm:w-56 lg:w-64 h-auto select-none pointer-events-none">
                <img
                  src="/hero-plant-feathered.png"
                  alt="Living Talking Plant Hero"
                  className="w-full h-auto object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.5)]"
                />

                {/* 6. AI / VOICE EFFECT: Soft concentric waves radiating from microphone on the pot */}
                {/* Microphone is located at the center-bottom of the pot: ~72% from top, ~50% from left */}
                <div className="absolute top-[72%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-14 h-14 pointer-events-none">
                  {/* Wave Ring 1 */}
                  <motion.div
                    animate={
                      shouldReduceMotion
                        ? {}
                        : {
                            scale: [1, 1.45, 1.8],
                            opacity: [0.65, 0.25, 0],
                          }
                    }
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                    className="absolute inset-0 rounded-full border-2 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]"
                  />

                  {/* Wave Ring 2 (delayed 0.8s) */}
                  <motion.div
                    animate={
                      shouldReduceMotion
                        ? {}
                        : {
                            scale: [1, 1.45, 1.8],
                            opacity: [0.55, 0.2, 0],
                          }
                    }
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      delay: 0.8,
                      ease: 'easeOut',
                    }}
                    className="absolute inset-0 rounded-full border-2 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]"
                  />

                  {/* Wave Ring 3 (delayed 1.6s) */}
                  <motion.div
                    animate={
                      shouldReduceMotion
                        ? {}
                        : {
                            scale: [1, 1.45, 1.8],
                            opacity: [0.45, 0.15, 0],
                          }
                    }
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      delay: 1.6,
                      ease: 'easeOut',
                    }}
                    className="absolute inset-0 rounded-full border-2 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  />
                </div>
              </div>
            </motion.div>

            {/* 3.6 PHONE / APP VISUAL (CSS Smartphone Mockup with Real Plant Talk UI) */}
            <motion.div
              initial={{ opacity: 0, x: 25 }}
              animate={
                shouldReduceMotion
                  ? { opacity: 1, x: 0 }
                  : {
                      opacity: 1,
                      x: 0,
                      y: mousePos.y * 6,
                    }
              }
              transition={{
                duration: 0.8,
                delay: 0.65,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative shrink-0 z-20 -mt-4 lg:mt-0"
            >
              {/* Phone Frame */}
              <div className="w-[185px] sm:w-[205px] lg:w-[220px] rounded-[38px] p-2 bg-stone-900 border-[3.5px] border-stone-800 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/20 relative">
                {/* Dynamic Island / Notch */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-30 flex items-center justify-end px-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
                </div>

                {/* Inner Screen */}
                <div className="w-full bg-[#f8faf8] rounded-[30px] p-2.5 pt-5 pb-3 text-stone-900 flex flex-col justify-between overflow-hidden relative shadow-inner">
                  {/* Top Status Bar: 9:41, wifi, battery */}
                  <div className="flex items-center justify-between text-[9px] font-semibold text-stone-500 px-1 mb-2">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <Wifi className="w-2.5 h-2.5" />
                      <Battery className="w-3 h-3 text-stone-700" />
                    </div>
                  </div>

                  {/* App Header */}
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div className="flex items-center gap-1">
                      <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[11px] font-bold text-emerald-950 font-['Outfit']">
                        Plant Talk
                      </span>
                    </div>
                    <Grid className="w-3 h-3 text-stone-400" />
                  </div>

                  {/* Card Title */}
                  <div className="px-1 mb-1.5">
                    <h4 className="text-[10px] font-bold text-stone-800">
                      Plant Health Overview
                    </h4>
                  </div>

                  {/* 2x2 Sensor Metric Cards */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                    {/* Soil Moisture */}
                    <div className="p-1.5 rounded-xl bg-sky-50/90 border border-sky-200/60 flex flex-col">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Droplets className="w-2.5 h-2.5 text-sky-600" />
                        <span className="text-[7.5px] font-medium text-stone-600">Soil Moisture</span>
                      </div>
                      <span className="text-[11px] font-bold text-sky-950">50%</span>
                      <span className="text-[7.5px] font-semibold text-emerald-600">Good</span>
                    </div>

                    {/* Light Intensity */}
                    <div className="p-1.5 rounded-xl bg-amber-50/90 border border-amber-200/60 flex flex-col">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Sun className="w-2.5 h-2.5 text-amber-500" />
                        <span className="text-[7.5px] font-medium text-stone-600">Light Intensity</span>
                      </div>
                      <span className="text-[11px] font-bold text-amber-950">65%</span>
                      <span className="text-[7.5px] font-semibold text-emerald-600">Good</span>
                    </div>

                    {/* Temperature */}
                    <div className="p-1.5 rounded-xl bg-rose-50/90 border border-rose-200/60 flex flex-col">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Thermometer className="w-2.5 h-2.5 text-rose-500" />
                        <span className="text-[7.5px] font-medium text-stone-600">Temperature</span>
                      </div>
                      <span className="text-[11px] font-bold text-rose-950">26°C</span>
                      <span className="text-[7.5px] font-semibold text-emerald-600">Perfect</span>
                    </div>

                    {/* Humidity */}
                    <div className="p-1.5 rounded-xl bg-purple-50/90 border border-purple-200/60 flex flex-col">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Radio className="w-2.5 h-2.5 text-purple-500" />
                        <span className="text-[7.5px] font-medium text-stone-600">Humidity</span>
                      </div>
                      <span className="text-[11px] font-bold text-purple-950">62%</span>
                      <span className="text-[7.5px] font-semibold text-emerald-600">Good</span>
                    </div>
                  </div>

                  {/* Start Speak Button */}
                  <button
                    type="button"
                    onClick={handleInstallAppClick}
                    className="w-full py-2 px-2.5 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white text-[9.5px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
                  >
                    <Sprout className="w-3 h-3 text-emerald-300" />
                    <span>Start Speak</span>
                  </button>
                </div>
              </div>
            </motion.div>

            {/* 7. SENSOR INDICATORS: 4 Floating Frosted Indicators with Glowing Pulses */}
            <div className="flex flex-row lg:flex-col gap-2 sm:gap-3 z-20 flex-wrap justify-center mt-2 lg:mt-0">
              {[
                { title: 'Plant Health Monitoring', icon: Sprout, delay: 0.7 },
                { title: 'Soil Moisture Analysis', icon: Droplets, delay: 0.8 },
                { title: 'Temperature Tracking', icon: Thermometer, delay: 0.9 },
                { title: 'AI Suggestions', icon: Brain, delay: 1.0 },
              ].map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: item.delay,
                      ease: 'easeOut',
                    }}
                    className="flex items-center gap-2 group"
                  >
                    {/* Frosted Circular Glass Icon */}
                    <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-950/65 backdrop-blur-md border border-emerald-400/50 flex items-center justify-center text-emerald-300 shadow-md group-hover:scale-108 transition-all shrink-0">
                      <IconComp className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                      {/* Gentle glowing pulse ring */}
                      <div className="absolute inset-0 rounded-full border border-emerald-400/30 animate-ping pointer-events-none opacity-40" />
                    </div>

                    {/* Indicator Label */}
                    <span className="text-white text-xs sm:text-[13px] font-bold tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] whitespace-nowrap">
                      {item.title}
                    </span>
                  </motion.div>
                );
              })}
            </div>

          </div>

        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          10. GOOGLE AUTHENTICATION MODAL
          ───────────────────────────────────────────────────────────── */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
        deferredPrompt={deferredPrompt}
      />

      {/* ─────────────────────────────────────────────────────────────
          ABOUT MODAL
          ───────────────────────────────────────────────────────────── */}
      {aboutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setAboutModalOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl z-10 text-stone-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800">
                <Sprout className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-emerald-950 font-['Outfit']">
                  About Talking Plant
                </h3>
                <p className="text-xs text-stone-500">
                  Smart Agriculture & IoT Companion Project
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed mb-4">
              Talking Plant bridges IoT sensors, computer vision, and generative AI
              into a living companion. Your plant senses soil moisture, temperature,
              humidity, and sunlight in real time, and talks back to you naturally
              via Google Gemini Live voice and WhatsApp alerts.
            </p>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium space-y-1 mb-6">
              <div className="font-bold">Vivekananda College of Technology (VCOT)</div>
              <div>Smart Agriculture Project • Innovation Showcase</div>
            </div>

            <button
              type="button"
              onClick={() => setAboutModalOpen(false)}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs sm:text-sm cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
