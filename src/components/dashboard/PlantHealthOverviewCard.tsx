import React, { useState } from 'react';
import {
  Sprout,
  Droplets,
  Sun,
  Thermometer,
  Waves,
  Clock,
  RefreshCw,
  Maximize2,
  Mic,
  MicOff,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useLiveVoiceSession } from '../../lib/plant/live-voice-manager';

export const PlantHealthOverviewCard: React.FC = () => {
  const { readings, isEspConnected } = useSensorsStore();
  const { setIsFullscreenVisionOpen } = useSettingsStore();
  const { liveStatus, isLiveActive, activeError, toggleLiveSpeaking } = useLiveVoiceSession();

  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('10:26 AM');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Normalize sensor values
  const moisture = Math.round(readings.moisture || 58);
  const light = Math.round(readings.light || 65);
  const temp = Math.round(readings.temperature || 26);
  const humidity = Math.round(readings.humidity || 62);

  const getMoistureStatus = (val: number) => {
    if (val < 35) return { label: 'Dry', color: 'bg-amber-100 text-amber-800' };
    if (val > 75) return { label: 'Moist', color: 'bg-teal-100 text-teal-800' };
    return { label: 'Good', color: 'bg-emerald-100 text-emerald-800' };
  };

  const getLightStatus = (val: number) => {
    if (val < 30) return { label: 'Low', color: 'bg-amber-100 text-amber-800' };
    if (val > 80) return { label: 'High', color: 'bg-teal-100 text-teal-800' };
    return { label: 'Good', color: 'bg-emerald-100 text-emerald-800' };
  };

  const getTempStatus = (val: number) => {
    if (val < 18) return { label: 'Cool', color: 'bg-blue-100 text-blue-800' };
    if (val > 30) return { label: 'Warm', color: 'bg-rose-100 text-rose-800' };
    return { label: 'Perfect', color: 'bg-emerald-100 text-emerald-800' };
  };

  const getHumidityStatus = (val: number) => {
    if (val < 40) return { label: 'Dry', color: 'bg-amber-100 text-amber-800' };
    if (val > 80) return { label: 'Humid', color: 'bg-teal-100 text-teal-800' };
    return { label: 'Good', color: 'bg-emerald-100 text-emerald-800' };
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setLastUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setTimeout(() => setIsRefreshing(false), 500);
  };



  return (
    <div className="w-full shrink-0 bg-white rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 border border-stone-200/80 shadow-xs flex flex-col justify-between gap-2">
      {/* ─────────────────────────────────────────────────────────────
          HEADER ROW: TITLE & LAST UPDATED
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sprout className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700" />
          <h2 className="text-xs sm:text-sm md:text-base font-bold text-stone-900 tracking-tight font-['Outfit']">
            Plant Health Overview
          </h2>
        </div>

        <div className="flex items-center gap-1.5 text-stone-500 text-[11px] sm:text-xs font-medium">
          <Clock className="w-3.5 h-3.5 text-stone-400" />
          <span>Last Updated • {lastUpdatedTime}</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1 hover:bg-stone-100 rounded-md text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
            title="Refresh Sensor Readings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4 HEALTH METRIC CARDS IN A ROW
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Soil Moisture */}
        <div className="bg-sky-50/40 border border-sky-100/90 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 flex flex-col items-center text-center justify-between shadow-2xs hover:bg-sky-50/70 transition-colors">
          <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 mb-0.5">
            <Droplets className="w-3.5 h-3.5" />
          </div>
          <span className="text-[11px] text-stone-500 font-medium">Soil Moisture</span>
          <span className="text-lg sm:text-xl font-bold text-stone-900 font-['Outfit'] my-0.5">
            {moisture}%
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold ${
              getMoistureStatus(moisture).color
            }`}
          >
            {getMoistureStatus(moisture).label}
          </span>
        </div>

        {/* Light Intensity */}
        <div className="bg-amber-50/40 border border-amber-100/90 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center text-center justify-between shadow-2xs hover:bg-amber-50/70 transition-colors">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-1">
            <Sun className="w-4 h-4" />
          </div>
          <span className="text-xs text-stone-500 font-medium">Light Intensity</span>
          <span className="text-xl sm:text-2xl font-bold text-stone-900 font-['Outfit'] my-0.5">
            {light}%
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
              getLightStatus(light).color
            }`}
          >
            {getLightStatus(light).label}
          </span>
        </div>

        {/* Temperature */}
        <div className="bg-rose-50/40 border border-rose-100/90 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center text-center justify-between shadow-2xs hover:bg-rose-50/70 transition-colors">
          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-1">
            <Thermometer className="w-4 h-4" />
          </div>
          <span className="text-xs text-stone-500 font-medium">Temperature</span>
          <span className="text-xl sm:text-2xl font-bold text-stone-900 font-['Outfit'] my-0.5">
            {temp}°C
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
              getTempStatus(temp).color
            }`}
          >
            {getTempStatus(temp).label}
          </span>
        </div>

        {/* Humidity */}
        <div className="bg-indigo-50/40 border border-indigo-100/90 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center text-center justify-between shadow-2xs hover:bg-indigo-50/70 transition-colors">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-1">
            <Waves className="w-4 h-4" />
          </div>
          <span className="text-xs text-stone-500 font-medium">Humidity</span>
          <span className="text-xl sm:text-2xl font-bold text-stone-900 font-['Outfit'] my-0.5">
            {humidity}%
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
              getHumidityStatus(humidity).color
            }`}
          >
            {getHumidityStatus(humidity).label}
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          BOTTOM ACTION CONTROLS: FULL SCREEN & START SPEAK
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between">
          {/* View Full Screen Button */}
          <button
            type="button"
            onClick={() => setIsFullscreenVisionOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-semibold flex items-center gap-2 shadow-2xs transition-all cursor-pointer active:scale-95"
          >
            <Maximize2 className="w-3.5 h-3.5 text-emerald-700" />
            <span>View Full Screen</span>
          </button>

          {/* Start Speak Large Emerald Button */}
          <button
            type="button"
            onClick={toggleLiveSpeaking}
            className={`px-7 py-2.5 rounded-full font-bold text-xs sm:text-sm tracking-wide shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
              isLiveActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-rose-900/20'
                : 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-emerald-900/20'
            }`}
          >
            {isLiveActive ? (
              <>
                {liveStatus === 'speaking' ? (
                  <>
                    <Volume2 className="w-4 h-4 text-white animate-bounce" />
                    <span>Plant Speaking... Stop</span>
                  </>
                ) : (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>Listening... Stop</span>
                  </>
                )}
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Start Speak</span>
              </>
            )}
          </button>
        </div>

        {activeError && (
          <div className="flex items-center gap-1.5 text-[11px] text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200/80 animate-in fade-in duration-200">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
            <span>{activeError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
