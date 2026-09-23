import React, { useState, useEffect, useCallback } from 'react';
import greenhouseBg from '../assets/greenhouse-bg.jpg';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { PlantHero } from './PlantHero';
import { CameraView } from './CameraView';
import { PlantHealth } from './PlantHealth';
import { QuickActions } from './QuickActions';
import { SystemStatus } from './SystemStatus';
import { BottomNavigation } from './BottomNavigation';
import { ActionModal } from './modals/ActionModal';
import { SettingsModal } from './modals/SettingsModal';
import { NavSection, Language } from '../types';

import { sensorService } from '../../services/sensorService';
import { connectESP32, disconnectESP32 } from '../../lib/plant/esp32-serial';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useExperienceStore } from '../../stores/plant/experience-store';
import { executePlantAnalysis } from '../../lib/plant/run-analysis';

// Existing feature panels for full navigation views
import { PlantAnalysisPanel } from '../../components/dashboard/plant-analysis-panel';
import { SensorsPanel } from '../../components/dashboard/sensors-panel';
import { VoiceConversationPanel } from '../../components/dashboard/voice-conversation-panel';
import { HistoryPanel } from '../../components/dashboard/history-panel';
import { DebugPanel } from '../../components/dashboard/debug-panel';
import { PhotosynthesisStatusCard } from '../../components/dashboard/photosynthesis-status-card';
import { HealthTrendsPanel } from '../../components/plant-monitoring/health-trends-panel';

export const AppShell: React.FC = () => {
  // Navigation & Language state
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [language, setLanguage] = useState<Language>('en');

  // Hero Camera State: false = PlantHero, true = CameraView
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  // Modals state
  const [activeModalAction, setActiveModalAction] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  const { isEspConnected } = useSensorsStore();
  const { setApiKeyConfigured, setApiStatus } = useSettingsStore();
  const { showToast } = useExperienceStore();

  // 1. Mount 24/7 telemetry service
  useEffect(() => {
    sensorService.connect();
    return () => {
      sensorService.disconnect();
    };
  }, []);

  // 2. Auto-detect WebSerial ESP32 connection
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serial' in navigator && navigator.serial) {
      // Check for previously authorized ports and auto-connect
      navigator.serial.getPorts().then((ports) => {
        if (ports.length > 0 && !useSensorsStore.getState().isEspConnected) {
          console.log('[ESP32-AUTOCONNECT] Found previously paired serial port, auto-connecting…');
          connectESP32().catch(() => {});
        }
      });

      const onConnect = () => {
        console.log('[ESP32-USB] 🔌 ESP32 USB cable connected');
        if (!useSensorsStore.getState().isEspConnected) {
          connectESP32().catch(() => {});
        }
      };

      const onDisconnect = () => {
        console.log('[ESP32-USB] 🔌 ESP32 USB cable disconnected');
        disconnectESP32().catch(() => {});
      };

      navigator.serial.addEventListener('connect', onConnect);
      navigator.serial.addEventListener('disconnect', onDisconnect);

      return () => {
        navigator.serial.removeEventListener('connect', onConnect);
        navigator.serial.removeEventListener('disconnect', onDisconnect);
      };
    }
  }, []);

  // 3. Probe backend server health & Gemini API key configuration
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.apiKeyConfigured) {
          setApiKeyConfigured(true);
          setApiStatus('AI_READY', 'Gemini AI Ready');
        }
      })
      .catch(() => {});
  }, [setApiKeyConfigured, setApiStatus]);

  // Handle quick actions routing
  const handleSelectAction = useCallback((actionId: string) => {
    if (actionId === 'scan') {
      setActiveSection('vision');
      setCameraActive(true);
    } else if (actionId === 'voice') {
      setActiveSection('voice');
    } else if (actionId === 'telemetry') {
      setActiveSection('telemetry');
    } else {
      setActiveModalAction(actionId);
    }
  }, []);

  // Handle image upload analysis
  const handleUploadPhoto = useCallback((file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setActiveSection('vision');
      executePlantAnalysis(false, dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  return (
    <div className="relative h-screen w-screen max-h-screen max-w-screen overflow-hidden select-none bg-stone-100 flex flex-col justify-between">
      {/* ─────────────────────────────────────────────────────────────
          BOTANICAL ENVIRONMENT BACKGROUND WITH MULTI-LAYER DEPTH
          ───────────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Greenhouse Photography Background */}
        <img
          src={greenhouseBg}
          alt="Botanical Greenhouse Environment"
          className="w-full h-full object-cover object-center filter blur-[1px] brightness-105 saturate-110 transform scale-102"
        />

        {/* Natural Sunbeams & Atmosphere Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/20 via-white/20 to-amber-100/30 mix-blend-overlay" />
        
        {/* Soft Bokeh Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute top-1/4 -right-24 w-96 h-96 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl" />

        {/* Subtle foreground depth-of-field vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(6,30,18,0.12)_100%)]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MAIN APPLICATION INTERFACE (100vw × 100dvh NO-SCROLL CANVAS)
          ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col h-full w-full p-2 sm:p-3.5 lg:p-4 gap-2 sm:gap-3 overflow-hidden">
        {/* Top Header */}
        <Header
          language={language}
          onLanguageChange={setLanguage}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Main Content Layout: Multi-View Navigation without Reloads */}
        <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
          {/* Column 1: Left Floating Sidebar */}
          <Sidebar
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />

          {/* VIEW: OVERVIEW */}
          {activeSection === 'overview' && (
            <>
              {/* Column 2: Center Hero (Plant View OR Camera View) */}
              <main className="flex-1 min-h-0 h-full overflow-hidden flex flex-col">
                {cameraActive ? (
                  <CameraView
                    key="camera-view"
                    onStopCamera={() => setCameraActive(false)}
                    onCapture={() => handleSelectAction('scan')}
                    onScanPlant={() => {
                      setActiveSection('vision');
                    }}
                    onUpload={handleUploadPhoto}
                  />
                ) : (
                  <PlantHero
                    key="plant-hero"
                    onStartCamera={() => setCameraActive(true)}
                    onCapture={() => setCameraActive(true)}
                    onUpload={handleUploadPhoto}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onSelectAction={handleSelectAction}
                  />
                )}
              </main>

              {/* Column 3: Right Panel (Plant Health, Quick Actions, System Status) */}
              <aside className="w-80 lg:w-88 shrink-0 flex flex-col gap-2.5 h-full overflow-y-auto custom-scrollbar pr-0.5">
                <PlantHealth
                  onOpenTelemetry={() => setActiveSection('telemetry')}
                />
                <QuickActions onSelectAction={handleSelectAction} />
                <SystemStatus />
              </aside>
            </>
          )}

          {/* VIEW: VISION */}
          {activeSection === 'vision' && (
            <>
              <main className="flex-1 min-h-0 h-full overflow-hidden flex flex-col">
                <CameraView
                  key="vision-camera-view"
                  onStopCamera={() => setActiveSection('overview')}
                  onCapture={(dataUrl) => {
                    executePlantAnalysis(dataUrl, 'Analyze species, botanical health, pests, and flower state.');
                  }}
                  onScanPlant={() => {
                    showToast('Analyzing current camera frame with Gemini Vision…', 'info');
                  }}
                  onUpload={handleUploadPhoto}
                />
              </main>

              <aside className="w-80 lg:w-96 shrink-0 flex flex-col gap-2.5 h-full overflow-y-auto custom-scrollbar pr-0.5">
                <div className="liquid-glass rounded-3xl p-3 border border-white/75 shadow-sm h-full overflow-y-auto custom-scrollbar">
                  <PlantAnalysisPanel />
                </div>
              </aside>
            </>
          )}

          {/* VIEW: TELEMETRY */}
          {activeSection === 'telemetry' && (
            <>
              <main className="flex-1 min-h-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-1">
                <div className="liquid-glass rounded-3xl p-3 sm:p-4 border border-white/75 shadow-sm">
                  <SensorsPanel />
                </div>
              </main>

              <aside className="w-80 lg:w-96 shrink-0 flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar pr-0.5">
                <div className="liquid-glass rounded-3xl p-3 border border-white/75 shadow-sm">
                  <PhotosynthesisStatusCard />
                </div>
                <div className="liquid-glass rounded-3xl p-3 border border-white/75 shadow-sm">
                  <HealthTrendsPanel />
                </div>
              </aside>
            </>
          )}

          {/* VIEW: VOICE */}
          {activeSection === 'voice' && (
            <main className="flex-1 min-h-0 h-full flex flex-col lg:flex-row gap-3 overflow-hidden">
              <div className="flex-1 min-h-0 h-full liquid-glass rounded-3xl p-3 sm:p-4 border border-white/75 shadow-sm overflow-y-auto custom-scrollbar">
                <VoiceConversationPanel />
              </div>
              <aside className="w-80 lg:w-88 shrink-0 flex flex-col gap-2.5 h-full overflow-y-auto custom-scrollbar">
                <PlantHealth onOpenTelemetry={() => setActiveSection('telemetry')} />
                <SystemStatus />
              </aside>
            </main>
          )}

          {/* VIEW: HISTORY */}
          {activeSection === 'history' && (
            <main className="flex-1 min-h-0 h-full flex flex-col lg:flex-row gap-3 overflow-hidden">
              <div className="flex-1 min-h-0 h-full liquid-glass rounded-3xl p-3 sm:p-4 border border-white/75 shadow-sm overflow-y-auto custom-scrollbar">
                <HistoryPanel />
              </div>
              <aside className="w-80 lg:w-88 shrink-0 flex flex-col gap-2.5 h-full overflow-y-auto custom-scrollbar">
                <PlantHealth onOpenTelemetry={() => setActiveSection('telemetry')} />
                <SystemStatus />
              </aside>
            </main>
          )}

          {/* VIEW: DIAGNOSTICS */}
          {activeSection === 'diagnostics' && (
            <main className="flex-1 min-h-0 h-full flex flex-col lg:flex-row gap-3 overflow-hidden">
              <div className="flex-1 min-h-0 h-full liquid-glass rounded-3xl p-3 sm:p-4 border border-white/75 shadow-sm overflow-y-auto custom-scrollbar">
                <DebugPanel />
              </div>
              <aside className="w-80 lg:w-88 shrink-0 flex flex-col gap-2.5 h-full overflow-y-auto custom-scrollbar">
                <SystemStatus />
                <QuickActions onSelectAction={handleSelectAction} />
              </aside>
            </main>
          )}
        </div>

        {/* Bottom Floating Navigation & Status */}
        <BottomNavigation
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          language={language}
        />
      </div>

      {/* Action Preview Modal */}
      <ActionModal
        actionId={activeModalAction}
        onClose={() => setActiveModalAction(null)}
        onNavigateToSection={setActiveSection}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        language={language}
        onLanguageChange={setLanguage}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
};
