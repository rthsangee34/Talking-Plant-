import React from 'react';
import { Radio } from 'lucide-react';
import { SystemStatusState } from '../types';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useSettingsStore } from '../../stores/plant/settings-store';

interface SystemStatusProps {
  status?: SystemStatusState;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({ status: propStatus }) => {
  const { isActive: cameraActive, devices } = useCameraStore();
  const { isEspConnected, connectionStatus } = useSensorsStore();
  const { apiStatus, apiKeyConfigured } = useSettingsStore();

  const isAiReady = apiStatus === 'AI_READY' || apiKeyConfigured;

  const rows = [
    {
      label: 'Camera',
      value: cameraActive
        ? 'Active (1080p)'
        : devices.length > 0
        ? `${devices.length} Camera${devices.length > 1 ? 's' : ''} Ready`
        : propStatus?.camera.label || 'Ready',
      isGreen: cameraActive || devices.length > 0,
    },
    {
      label: 'ESP32',
      value: isEspConnected
        ? 'Connected @ 115200'
        : connectionStatus === 'connecting' || connectionStatus === 'selecting'
        ? 'Connecting…'
        : 'Disconnected',
      isGreen: isEspConnected,
    },
    {
      label: 'Gemini AI',
      value: isAiReady
        ? 'Ready'
        : apiStatus === 'CONNECTING'
        ? 'Checking…'
        : 'Setup Required',
      isGreen: isAiReady,
    },
    {
      label: 'Voice',
      value: typeof window !== 'undefined' && 'speechSynthesis' in window ? 'Ready (EN/TA)' : 'Unsupported',
      isGreen: typeof window !== 'undefined' && 'speechSynthesis' in window,
    },
  ];

  return (
    <div className="flex flex-col gap-2.5 liquid-glass rounded-3xl p-3.5 sm:p-4 border border-white/75 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-800">
          <Radio className="w-4 h-4" />
        </div>
        <h2 className="text-sm sm:text-base font-bold text-emerald-950 tracking-tight">
          System Status
        </h2>
      </div>

      {/* Status Rows */}
      <div className="flex flex-col gap-2 pt-0.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/50 border border-white/60 text-xs"
          >
            <span className="font-semibold text-emerald-950/75">{row.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-emerald-950">{row.value}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  row.isGreen ? 'bg-emerald-500 shadow-xs' : 'bg-amber-500'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
