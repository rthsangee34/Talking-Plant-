import React from 'react';
import {
  HeartPulse,
  Radio,
  Clock,
  Droplet,
  Thermometer,
  CloudRain,
  Sun,
  Activity,
  AlertTriangle,
  CheckCircle,
  FlaskConical,
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/plant/monitoring-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { mockSensorService } from '../../services/mockSensorService';

export const LiveStatusCard: React.FC = () => {
  const { healthScore, deviceStatus, isMockMode } = useMonitoringStore();
  const { readings } = useSensorsStore();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
          badge: 'bg-emerald-500 text-slate-950',
        };
      case 'ATTENTION':
        return {
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400',
          badge: 'bg-amber-500 text-slate-950',
        };
      case 'STRESSED':
        return {
          bg: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
          dot: 'bg-orange-400',
          badge: 'bg-orange-500 text-slate-950',
        };
      case 'CRITICAL':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400',
          badge: 'bg-rose-500 text-white',
        };
      default:
        return {
          bg: 'bg-slate-800/40 border-slate-700 text-slate-400',
          dot: 'bg-slate-400',
          badge: 'bg-slate-700 text-slate-200',
        };
    }
  };

  const statusStyle = getStatusColor(healthScore.status);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 backdrop-blur-sm shadow-md flex flex-col gap-2.5">
      {/* Header with Title & Device Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <HeartPulse className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            24/7 Plant Health
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {/* Mock Mode vs Real Hardware Pill */}
          <button
            onClick={() => {
              if (isMockMode) {
                mockSensorService.stopMockStream();
              } else {
                mockSensorService.startMockStream();
              }
            }}
            className={`px-2 py-0.5 rounded-full font-bold transition-all flex items-center gap-1 cursor-pointer border ${
              isMockMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle between Physical ESP32 Hardware and Simulated Demo Data"
          >
            <FlaskConical className="w-3 h-3" />
            <span>{isMockMode ? '🧪 MOCK DATA' : '🟢 REAL DATA'}</span>
          </button>

          {/* ESP32 Status Pill */}
          <span
            className={`px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 ${
              deviceStatus.isOnline
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                deviceStatus.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span>{deviceStatus.isOnline ? 'ESP32 ONLINE' : 'ESP32 OFFLINE'}</span>
          </span>
        </div>
      </div>

      {/* Main Health Indicator Score Display */}
      <div className={`p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${statusStyle.bg}`}>
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Health Indicator
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black tracking-tight text-white">
                {healthScore.overall}
              </span>
              <span className="text-xs font-semibold text-slate-400">/ 100</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={`px-2.5 py-0.5 rounded font-black text-xs uppercase tracking-wide ${statusStyle.badge}`}>
            {healthScore.status}
          </span>
          <span className="text-[10px] text-slate-300 text-right max-w-[180px] truncate">
            {healthScore.summary}
          </span>
        </div>
      </div>

      {/* 5 Health Factor Bars - Responsive Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 text-center text-[10px]">
        {/* Moisture */}
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800 flex flex-col items-center">
          <Droplet className="w-3.5 h-3.5 text-blue-400 mb-0.5" />
          <span className="text-slate-400 font-medium">Moisture</span>
          <span className="font-bold text-slate-200 mt-0.5">{healthScore.moistureScore}%</span>
        </div>

        {/* Temperature */}
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800 flex flex-col items-center">
          <Thermometer className="w-3.5 h-3.5 text-rose-400 mb-0.5" />
          <span className="text-slate-400 font-medium">Temp</span>
          <span className="font-bold text-slate-200 mt-0.5">{healthScore.tempScore}%</span>
        </div>

        {/* Humidity */}
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800 flex flex-col items-center">
          <CloudRain className="w-3.5 h-3.5 text-cyan-400 mb-0.5" />
          <span className="text-slate-400 font-medium">Humidity</span>
          <span className="font-bold text-slate-200 mt-0.5">{healthScore.humidityScore}%</span>
        </div>

        {/* Light */}
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800 flex flex-col items-center">
          <Sun className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
          <span className="text-slate-400 font-medium">Light</span>
          <span className="font-bold text-slate-200 mt-0.5">{healthScore.lightScore}%</span>
        </div>

        {/* Stability */}
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800 flex flex-col items-center col-span-2 sm:col-span-1">
          <Activity className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
          <span className="text-slate-400 font-medium">Stability</span>
          <span className="font-bold text-slate-200 mt-0.5">{healthScore.stabilityScore}%</span>
        </div>
      </div>
    </div>
  );
};
