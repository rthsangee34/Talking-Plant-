import React, { useEffect, useState } from 'react';
import { Terminal, ShieldCheck, CheckCircle2, AlertCircle, Cpu, Camera, Eye, Sparkles } from 'lucide-react';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useObserverStore } from '../../stores/plant/observer-store';

export const DebugPanel: React.FC = () => {
  const [healthInfo, setHealthInfo] = useState<{
    status: string;
    apiKeyConfigured: boolean;
    visionModel: string;
    liveModel: string;
  } | null>(null);



  const { streamInfo, isActive, lastMultiSnapshots } = useCameraStore();
  const { lastAnalysis } = useObserverStore();

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealthInfo(data))
      .catch((err) => console.error('Health check error:', err));
  }, []);

  return (
    <div className="bg-slate-900/90 border border-slate-800 text-white rounded-xl p-3 sm:p-3.5 flex flex-col gap-3 shadow-md h-full min-h-0 overflow-y-auto pr-1 scrollbar-thin">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">System Diagnostics & Vision Telemetry</h2>
        </div>
        <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold rounded-md">
          PROD SECURE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
        {/* Security & Server Status */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
          <div className="text-slate-400 uppercase text-[10px] font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> API Key & Backend
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-300">Server Key:</span>
            {healthInfo?.apiKeyConfigured ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Configured
              </span>
            ) : (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Missing
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            Model: {healthInfo?.visionModel || 'gemini-3.6-flash'}
          </div>
        </div>

        {/* Camera Hardware Telemetry */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
          <div className="text-slate-400 uppercase text-[10px] font-bold flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-amber-400" /> Camera Telemetry
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Stream Status:</span>
            <span className={isActive ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {isActive ? 'Active Stream' : 'Idle'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Native Resolution:</span>
            <span className="text-amber-300 font-bold">
              {streamInfo ? `${streamInfo.width}×${streamInfo.height}` : 'N/A'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {lastMultiSnapshots.length > 0 ? `Buffered Multi-Frames: ${lastMultiSnapshots.length} frames` : 'Ready for single or multi-scan'}
          </div>
        </div>

        {/* Botanical Vision Model Telemetry */}
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
          <div className="text-slate-400 uppercase text-[10px] font-bold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Vision Intelligence
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Identified Species:</span>
            <span className="text-blue-300 font-bold truncate max-w-[120px]">
              {lastAnalysis?.plants?.[0]?.commonName || 'Not Scanned'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Flower Status:</span>
            <span className="text-emerald-300 font-bold">
              {lastAnalysis?.plants?.[0]?.flowers?.status || 'None'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

