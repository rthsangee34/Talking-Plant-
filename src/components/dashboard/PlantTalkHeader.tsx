import React, { useState } from 'react';
import { Camera, Cpu, Settings, Minus, X, Sprout } from 'lucide-react';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { connectESP32 } from '../../lib/plant/esp32-serial';
import { CameraSelectionModal } from './CameraSelectionModal';

export const PlantTalkHeader: React.FC = () => {
  const { isActive: isCameraActive, isConnecting: isCameraConnecting } = useCameraStore();
  const { isEspConnected, connectionStatus } = useSensorsStore();
  const { openSettingsModal } = useSettingsStore();
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);

  const handleArduinoClick = () => {
    if (!isEspConnected) {
      connectESP32().catch(() => {});
    } else {
      openSettingsModal();
    }
  };

  return (
    <>
      <header className="w-full shrink-0 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 bg-white/85 backdrop-blur-md rounded-2xl border border-stone-200/80 shadow-xs z-30">
        {/* ─────────────────────────────────────────────────────────────
            LEFT: BRAND IDENTITY
            ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-xs">
              <Sprout className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-800 tracking-tight font-['Outfit']">
                Plant Talk
              </span>
              <span className="text-stone-500 font-medium text-xs sm:text-sm hidden md:inline">
                Your Plant&apos;s AI Companion
              </span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            RIGHT: CONNECTION PILLS & SYSTEM CONTROLS
            ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Camera Connection Button */}
          <button
            type="button"
            onClick={() => setIsCameraModalOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95 ${
              isCameraActive
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-800 hover:bg-emerald-100/70'
                : isCameraConnecting
                ? 'bg-teal-50 border-teal-300 text-teal-800 animate-pulse'
                : 'bg-stone-100/90 border-stone-300 text-stone-600 hover:bg-stone-200/70'
            }`}
            title={
              isCameraActive
                ? 'Camera Connected — Click to change or switch camera'
                : isCameraConnecting
                ? 'Connecting Camera...'
                : 'Camera Disconnected — Click to connect camera'
            }
            aria-label={
              isCameraActive
                ? 'Camera Connected'
                : isCameraConnecting
                ? 'Connecting Camera...'
                : 'Camera Disconnected'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isCameraActive
                  ? 'bg-emerald-500 animate-pulse'
                  : isCameraConnecting
                  ? 'bg-teal-400 animate-pulse'
                  : 'bg-stone-400'
              }`}
            />
            <Camera className="w-3.5 h-3.5 text-current opacity-80" />
            <span className="hidden sm:inline">
              {isCameraConnecting
                ? 'Connecting Camera...'
                : isCameraActive
                ? 'Camera Connected'
                : 'Camera Disconnected'}
            </span>
          </button>

        {/* Arduino Connected Status Pill */}
        <button
          type="button"
          onClick={handleArduinoClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95 ${
            isEspConnected
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-800 hover:bg-emerald-100/70'
              : connectionStatus === 'connecting'
              ? 'bg-teal-50 border-teal-300 text-teal-800 animate-pulse'
              : 'bg-stone-100/90 border-stone-300 text-stone-600 hover:bg-stone-200/70'
          }`}
          title={isEspConnected ? 'Arduino / ESP32 Connected' : 'Click to connect Arduino via USB'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isEspConnected
                ? 'bg-emerald-500 animate-pulse'
                : connectionStatus === 'connecting'
                ? 'bg-teal-400'
                : 'bg-stone-400'
            }`}
          />
          <Cpu className="w-3.5 h-3.5 text-current opacity-80" />
          <span className="hidden sm:inline">
            {isEspConnected
              ? 'Arduino Connected'
              : connectionStatus === 'connecting'
              ? 'Connecting...'
              : 'Arduino Disconnected'}
          </span>
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={openSettingsModal}
          className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 border border-stone-300 flex items-center justify-center text-stone-700 transition-all cursor-pointer active:scale-90"
          title="Open Settings & API Configuration"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Window controls (minimize & close - desktop only) */}
        <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-stone-200">
          <button
            type="button"
            className="w-7 h-7 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="w-7 h-7 rounded-lg hover:bg-rose-50 text-stone-500 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>

    <CameraSelectionModal
      isOpen={isCameraModalOpen}
      onClose={() => setIsCameraModalOpen(false)}
    />
  </>
  );
};
