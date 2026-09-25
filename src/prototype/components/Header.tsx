import React, { useState } from 'react';
import { Logo } from './Logo';
import { Wifi, WifiOff, Sparkles, Globe, Settings, Sprout, ChevronDown, Check, Usb } from 'lucide-react';
import { Language } from '../types';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useCameraStore } from '../../stores/plant/camera-store';
import { connectESP32 } from '../../lib/plant/esp32-serial';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  onOpenSettings,
}) => {
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const { isEspConnected, connectionStatus } = useSensorsStore();
  const { apiStatus, apiKeyConfigured } = useSettingsStore();

  const handleLanguageSelect = (lang: Language) => {
    onLanguageChange(lang);
    setLangDropdownOpen(false);
    useCameraStore.getState().setTouchLanguage(lang);
    useSettingsStore.getState().setPreferredLanguage(lang);
  };

  const isAiReady = apiStatus === 'AI_READY' || apiKeyConfigured;

  return (
    <header className="w-full shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-4 liquid-glass rounded-3xl border border-white/70 shadow-sm z-30 relative">
      {/* Left: Brand Identity */}
      <Logo />

      {/* Right: Status Pills & Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Plant / ESP32 Connected Pill */}
        <button
          type="button"
          onClick={() => {
            if (!isEspConnected) {
              connectESP32();
            } else {
              onOpenSettings();
            }
          }}
          className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-xs transition-all cursor-pointer active:scale-95 ${
            isEspConnected
              ? 'bg-white/70 border-emerald-500/30 text-emerald-900'
              : connectionStatus === 'connecting' || connectionStatus === 'selecting'
              ? 'bg-teal-500/10 border-teal-500/30 text-teal-900'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-900 hover:bg-amber-500/20'
          }`}
          title={isEspConnected ? 'ESP32 Connected — Click to manage in Settings' : 'Click to connect ESP32 USB'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isEspConnected
                ? 'bg-emerald-500 animate-pulse'
                : connectionStatus === 'connecting' || connectionStatus === 'selecting'
                ? 'bg-teal-400 animate-ping'
                : 'bg-amber-500'
            }`}
          />
          <span className="text-xs font-semibold tracking-tight text-emerald-950">
            {isEspConnected
              ? 'Plant Connected'
              : connectionStatus === 'connecting'
              ? 'Connecting ESP32…'
              : connectionStatus === 'selecting'
              ? 'Select USB Port…'
              : 'Connect ESP32'}
          </span>
          {isEspConnected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />
          ) : (
            <Usb className="w-3.5 h-3.5 text-amber-700 ml-0.5" />
          )}
        </button>

        {/* Gemini AI Ready Pill */}
        <button
          type="button"
          onClick={onOpenSettings}
          className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-xs transition-all cursor-pointer active:scale-95 ${
            isAiReady
              ? 'bg-white/70 border-indigo-500/25 text-indigo-950'
              : apiStatus === 'CONNECTING'
              ? 'bg-teal-500/10 border-teal-500/30 text-teal-950'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-950 hover:bg-amber-500/20'
          }`}
          title="Gemini AI Status — Click to configure"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isAiReady ? 'text-indigo-500' : 'text-amber-500'}`} />
          <span className="text-xs font-semibold tracking-tight text-indigo-950">
            {isAiReady
              ? 'Gemini AI Ready'
              : apiStatus === 'CONNECTING'
              ? 'Checking AI…'
              : 'Setup AI Key'}
          </span>
        </button>

        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangDropdownOpen(!langDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/75 hover:bg-white/90 backdrop-blur-md border border-white/90 text-emerald-950 text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
            aria-expanded={langDropdownOpen}
            aria-label="Language selection"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">
              {language === 'mixed' ? 'தமிழ் & English' : language === 'ta' ? 'தமிழ் (Tamil)' : 'English (EN)'}
            </span>
            <span className="sm:hidden">{language === 'mixed' ? 'TA+EN' : language.toUpperCase()}</span>
            <ChevronDown className="w-3 h-3 text-emerald-700/80" />
          </button>

          {/* Dropdown Menu */}
          {langDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl liquid-glass border border-white/80 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => handleLanguageSelect('mixed')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  language === 'mixed'
                    ? 'bg-emerald-500/15 text-emerald-900'
                    : 'text-slate-700 hover:bg-white/60'
                }`}
              >
                <span>தமிழ் & English (Bilingual)</span>
                {language === 'mixed' && <Check className="w-3.5 h-3.5 text-emerald-700" />}
              </button>
              <button
                onClick={() => handleLanguageSelect('ta')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  language === 'ta'
                    ? 'bg-emerald-500/15 text-emerald-900'
                    : 'text-slate-700 hover:bg-white/60'
                }`}
              >
                <span>தமிழ் (Tamil)</span>
                {language === 'ta' && <Check className="w-3.5 h-3.5 text-emerald-700" />}
              </button>
              <button
                onClick={() => handleLanguageSelect('en')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                  language === 'en'
                    ? 'bg-emerald-500/15 text-emerald-900'
                    : 'text-slate-700 hover:bg-white/60'
                }`}
              >
                <span>English (EN)</span>
                {language === 'en' && <Check className="w-3.5 h-3.5 text-emerald-700" />}
              </button>
            </div>
          )}
        </div>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/75 hover:bg-white/90 backdrop-blur-md border border-white/90 text-emerald-950 shadow-xs transition-all cursor-pointer active:scale-95"
          title="Open Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-emerald-800" />
        </button>

        {/* Botanical Plant Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-950 via-emerald-900 to-emerald-800 p-0.5 shadow-sm flex items-center justify-center border border-white/70">
          <div className="w-full h-full rounded-full bg-emerald-950 flex items-center justify-center">
            <Sprout className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </div>
    </header>
  );
};
