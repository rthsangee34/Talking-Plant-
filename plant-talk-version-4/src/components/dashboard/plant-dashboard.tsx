import React, { useState, useEffect } from 'react';
import { CameraPanel } from './camera-panel';
import { SensorsPanel } from './sensors-panel';
import { VoiceConversationPanel } from './voice-conversation-panel';
import { PlantAnalysisPanel } from './plant-analysis-panel';
import { ObservationPanel } from './observation-panel';
import { HistoryPanel } from './history-panel';
import { DebugPanel } from './debug-panel';
import { PhotosynthesisStatusCard } from './photosynthesis-status-card';
import { LiveStatusCard } from '../plant-monitoring/live-status-card';
import { HealthTrendsPanel } from '../plant-monitoring/health-trends-panel';
import { sensorService } from '../../services/sensorService';
import { useUiModeStore } from '../../stores/plant/ui-mode-store';
import { Sparkles, Volume2, Activity, History, Terminal, HeartPulse } from 'lucide-react';

export const PlantDashboard: React.FC = () => {
  const { showDebugPanel } = useUiModeStore();
  const [activeTab, setActiveTab] = useState<'vision' | 'voice' | 'trends' | 'observation' | 'history' | 'debug'>('vision');

  // Connect to 24/7 backend SSE sensor stream on mount
  useEffect(() => {
    sensorService.connect();
    return () => {
      sensorService.disconnect();
    };
  }, []);

  // Sync with header diagnostics toggle
  useEffect(() => {
    if (showDebugPanel) {
      setActiveTab('debug');
    } else if (activeTab === 'debug') {
      setActiveTab('vision');
    }
  }, [showDebugPanel]);

  return (
    <div className="w-full flex flex-col gap-3 lg:grid lg:grid-cols-12 lg:gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
      {/* Column 1: Plant Vision & Space Protection (4 cols on desktop, 1st on mobile) */}
      <div className="w-full lg:col-span-4 lg:h-full lg:min-h-0 flex flex-col">
        <CameraPanel />
      </div>

      {/* Column 2: Telemetry & Photosynthesis Intelligence (4 cols on desktop, 2nd on mobile) */}
      <div className="w-full lg:col-span-4 lg:h-full lg:min-h-0 flex flex-col gap-3 lg:overflow-y-auto lg:pr-1 lg:scrollbar-thin">
        {/* 24/7 Plant Health */}
        <LiveStatusCard />
        {/* Telemetry Sensors */}
        <SensorsPanel />
        {/* Photosynthesis Intelligence */}
        <PhotosynthesisStatusCard />
      </div>

      {/* Column 3: AI Intelligence Workspace with Tabs (4 cols on desktop, 3rd on mobile) */}
      <div className="w-full lg:col-span-4 lg:h-full lg:min-h-0 flex flex-col gap-2">
        {/* Sleek Touch-Friendly Responsive Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-xl shrink-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('vision')}
            className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeTab === 'vision'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            aria-label="Vision AI tab"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Vision AI</span>
          </button>

          <button
            onClick={() => setActiveTab('voice')}
            className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeTab === 'voice'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            aria-label="Voice conversation tab"
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>Voice</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeTab === 'trends'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            aria-label="Plant health trends tab"
          >
            <HeartPulse className="w-3.5 h-3.5 shrink-0" />
            <span>Health</span>
          </button>

          <button
            onClick={() => setActiveTab('observation')}
            className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeTab === 'observation'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            aria-label="Observation loop tab"
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span>Observe</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            aria-label="History logs tab"
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span>History</span>
          </button>

          {showDebugPanel && (
            <button
              onClick={() => setActiveTab('debug')}
              className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                activeTab === 'debug'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              aria-label="Diagnostics tab"
            >
              <Terminal className="w-3.5 h-3.5 shrink-0" />
              <span>Diag</span>
            </button>
          )}
        </div>

        {/* Tab Content Container */}
        <div className="w-full lg:flex-1 lg:min-h-0 lg:overflow-hidden min-h-[360px]">
          {activeTab === 'vision' && <PlantAnalysisPanel />}
          {activeTab === 'voice' && <VoiceConversationPanel />}
          {activeTab === 'trends' && <HealthTrendsPanel />}
          {activeTab === 'observation' && <ObservationPanel />}
          {activeTab === 'history' && <HistoryPanel />}
          {activeTab === 'debug' && <DebugPanel />}
        </div>
      </div>
    </div>
  );
};
