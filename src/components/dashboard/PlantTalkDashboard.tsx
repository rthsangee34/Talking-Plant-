import React, { useEffect, useCallback } from 'react';
import { BarChart3, Link as LinkIcon } from 'lucide-react';
import { PlantTalkHeader } from './PlantTalkHeader';
import { PlantVisionCard } from './PlantVisionCard';
import { PlantHealthOverviewCard } from './PlantHealthOverviewCard';
import { ChatWithPlantCard } from './ChatWithPlantCard';
import { AnalysisModal } from './AnalysisModal';
import { SettingsModal } from './SettingsModal';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useExperienceStore } from '../../stores/plant/experience-store';
import { sensorService } from '../../services/sensorService';
import { connectESP32 } from '../../lib/plant/esp32-serial';

interface PlantTalkDashboardProps {
  onDisconnect?: () => void;
}

export const PlantTalkDashboard: React.FC<PlantTalkDashboardProps> = ({ onDisconnect }) => {
  const {
    isSettingsModalOpen,
    closeSettingsModal,
    isAnalysisModalOpen,
    openAnalysisModal,
    closeAnalysisModal,
    isFullscreenVisionOpen,
    setIsFullscreenVisionOpen,
  } = useSettingsStore();

  const { isEspConnected } = useSensorsStore();
  const { isActive: isCameraActive } = useCameraStore();
  const { showToast } = useExperienceStore();

  // 1. Connect background sensor telemetry service (SSE stream / simulated)
  useEffect(() => {
    sensorService.connect();
    return () => {
      sensorService.disconnect();
    };
  }, []);

  // 2. Auto-detect paired WebSerial ESP32 connection on startup
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serial' in navigator && navigator.serial) {
      navigator.serial.getPorts().then((ports) => {
        if (ports.length > 0 && !useSensorsStore.getState().isEspConnected) {
          console.log('[Dashboard] Found previously paired serial port, auto-connecting...');
          connectESP32().catch(() => {});
        }
      });
    }
  }, []);

  // Manual Connect Button Handler
  const handleManualConnect = useCallback(async () => {
    if (!isEspConnected) {
      try {
        await connectESP32();
        showToast('Attempting to connect Arduino/ESP32 via USB...', 'info');
      } catch (err: any) {
        showToast(err?.message || 'Could not connect Arduino.', 'warning');
      }
    } else {
      showToast('Arduino and sensors are already connected and streaming.', 'success');
    }
  }, [isEspConnected, showToast]);

  return (
    <div className="relative h-screen max-h-screen w-full max-w-full overflow-hidden bg-[#f4f7f5] text-stone-900 flex flex-col justify-between p-2 sm:p-3 lg:p-4 font-sans select-none box-border">
      {/* ─────────────────────────────────────────────────────────────
          GLOBAL HEADER (Always fixed at top)
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full shrink-0 z-20">
        <PlantTalkHeader />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MAIN DASHBOARD VIEWPORT:
          - MOBILE (< lg):
            • PlantVisionCard is FIXED at top directly under header (shrink-0)
            • Remaining panels (Health Overview + Chat + Actions) SCROLL below it!
          - DESKTOP (lg:):
            • Two-column side-by-side grid, 100% fixed, NO vertical scrolling!
          ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 w-full flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(350px,40%)] lg:grid-rows-[1fr_auto] gap-2 sm:gap-2.5 lg:gap-3.5 my-1.5 sm:my-2 overflow-hidden">
        
        {/* 1. CAMERA VISION PANEL:
            • Mobile: FIXED in place at top (shrink-0, non-scrolling)
            • Desktop: Left column top cell (row 1, col 1, flex-1) */}
        <div className="w-full shrink-0 lg:shrink lg:col-start-1 lg:row-start-1 lg:h-full lg:min-h-0">
          <PlantVisionCard />
        </div>

        {/* 2. OTHER PANELS (SCROLLABLE ON MOBILE ONLY):
            • Mobile: flex-1 min-h-0 overflow-y-auto (Health Overview + Chat scroll smoothly)
            • Desktop: lg:contents (unwraps cleanly into the 2-column desktop grid) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-2 sm:gap-2.5 lg:gap-3 pr-0.5 scrollbar-thin lg:contents">
          
          {/* Plant Health Overview Card:
              • Mobile: top of scrollable section
              • Desktop: Left column bottom cell (row 2, col 1) */}
          <div className="w-full shrink-0 lg:col-start-1 lg:row-start-2">
            <PlantHealthOverviewCard />
          </div>

          {/* Chat with Your Plant Card:
              • Mobile: second in scrollable section
              • Desktop: Right column (col 2, spans rows 1 & 2) */}
          <div className="w-full min-h-[380px] sm:min-h-[440px] lg:min-h-0 lg:h-full lg:col-start-2 lg:row-start-1 lg:row-span-2 flex flex-col">
            <ChatWithPlantCard />
          </div>

          {/* Mobile-Only Action Footer (Inside scroll area so it doesn't take fixed screen height) */}
          <div className="lg:hidden w-full shrink-0 pt-1 pb-1 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between gap-2 bg-white/70 p-2 rounded-xl border border-stone-200">
              <div className="flex items-center gap-1.5 text-stone-600 font-medium text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>System Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openAnalysisModal}
                  className="px-3 py-1.5 rounded-full bg-emerald-800 text-white font-bold text-xs tracking-wide shadow-xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Analysis</span>
                </button>
                <button
                  type="button"
                  onClick={handleManualConnect}
                  className="px-3 py-1.5 rounded-full bg-white border border-emerald-300 text-emerald-800 font-bold text-xs tracking-wide shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <LinkIcon className="w-3 h-3 text-emerald-700" />
                  <span>Connect</span>
                </button>
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* ─────────────────────────────────────────────────────────────
          DESKTOP FOOTER BAR (Desktop only, fixed at bottom)
          ───────────────────────────────────────────────────────────── */}
      <footer className="hidden lg:flex w-full shrink-0 pt-1 items-center justify-between gap-2 text-xs">
        {/* Left: Connection Status */}
        <div className="flex items-center gap-2 text-stone-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Ready</span>
          <span className="text-stone-300">|</span>
          <span className="text-stone-500">Camera & Arduino connected automatically</span>
        </div>

        {/* Right: Analysis & Manual Connect Buttons */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Analysis Primary Button */}
          <button
            type="button"
            onClick={openAnalysisModal}
            className="px-5 py-2.5 rounded-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs tracking-wide shadow-md shadow-emerald-900/15 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analysis</span>
          </button>

          {/* Manual Connect Secondary Button */}
          <button
            type="button"
            onClick={handleManualConnect}
            className="px-4 py-2.5 rounded-full bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs tracking-wide shadow-2xs flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <LinkIcon className="w-3.5 h-3.5 text-emerald-700" />
            <span>Manual Connect</span>
          </button>
        </div>
      </footer>

      {/* ─────────────────────────────────────────────────────────────
          MODALS
          ───────────────────────────────────────────────────────────── */}
      <AnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={closeAnalysisModal}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={closeSettingsModal}
        onDisconnect={onDisconnect}
      />

      {/* Fullscreen Camera Vision Modal */}
      {isFullscreenVisionOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 sm:p-6 animate-fade-in">
          <div className="flex justify-between items-center text-white pb-3">
            <span className="text-sm font-bold tracking-tight">Plant Vision — Fullscreen</span>
            <button
              type="button"
              onClick={() => setIsFullscreenVisionOpen(false)}
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold"
            >
              Exit Fullscreen
            </button>
          </div>
          <div className="flex-1 relative rounded-2xl overflow-hidden bg-black flex items-center justify-center">
            <img
              src={isCameraActive ? '/fallback-plant.jpg' : '/fallback-plant.jpg'}
              alt="Fullscreen Plant"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
