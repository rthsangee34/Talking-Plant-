import React, { useState, useEffect } from 'react';
import {
  Droplet,
  Sun,
  Thermometer,
  Wind,
  Gauge,
  Cpu,
  Usb,
  RefreshCw,
  AlertTriangle,
  Terminal,
  Activity,
  Clock,
  ChevronDown,
  ChevronUp,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { connectESP32, disconnectESP32, reconnectESP32 } from '../../lib/plant/esp32-serial';

export const SensorsPanel: React.FC = () => {
  const {
    readings,
    isManualOverride,
    isEspConnected,
    connectionStatus,
    baudRate,
    lastPacketTime,
    validPacketCount,
    lastRawLine,
    connectionError,
    technicalError,
    isEmbeddedPreview,
    setSensorValue,
  } = useSensorsStore();

  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          label: 'ESP32 Connected',
          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          dot: 'bg-emerald-400 animate-pulse',
        };
      case 'waiting_data':
        return {
          label: 'Connected – Waiting for Sensor Data',
          color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          dot: 'bg-blue-400 animate-ping',
        };
      case 'stale':
        return {
          label: 'Sensor Data Stale',
          color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          dot: 'bg-amber-400',
        };
      case 'selecting':
        return {
          label: 'Select a Serial Port…',
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          dot: 'bg-indigo-400 animate-bounce',
        };
      case 'connecting':
        return {
          label: 'Connecting…',
          color: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
          dot: 'bg-teal-400 animate-pulse',
        };
      case 'unsupported':
        return {
          label: 'Serial Not Supported',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-400',
        };
      case 'error':
        return {
          label: 'Connection Error',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-400',
        };
      case 'disconnected':
      default:
        return {
          label: 'ESP32 Disconnected',
          color: 'bg-slate-800 text-slate-400 border-slate-700',
          dot: 'bg-slate-500',
        };
    }
  };

  const badge = getStatusBadge();
  const isBusy = connectionStatus === 'selecting' || connectionStatus === 'connecting';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm shadow-md flex flex-col gap-2.5">
      {/* Header & Main Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-emerald-100">Telemetry Sensors</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Connection Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${badge.color}`}
          >
            <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        </div>
      </div>

      {/* Embedded Preview Limitation Banner */}
      {isEmbeddedPreview && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-2 text-amber-200 text-xs">
          <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            Direct ESP32 USB access is unavailable inside this embedded preview iframe
          </div>
          <p>
            Download the project and run it locally using desktop <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> to connect to your physical ESP32 COM port.
          </p>
          <div className="bg-slate-900/90 border border-amber-900/40 rounded-lg p-2.5 font-mono text-emerald-400 text-[11px] flex items-center justify-between">
            <span>npm install && npm run dev</span>
            <span className="text-slate-500 text-[10px] font-sans">Open http://localhost:3000</span>
          </div>
        </div>
      )}

      {/* Serial Action Bar */}
      <div className="bg-slate-900/60 border border-emerald-900/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isEspConnected ? (
            <button
              onClick={() => connectESP32()}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Usb className="w-3.5 h-3.5" />}
              Connect ESP32
            </button>
          ) : (
            <>
              <button
                onClick={() => disconnectESP32()}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white font-medium text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Disconnect
              </button>
              <button
                onClick={() => reconnectESP32()}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Reconnect
              </button>
            </>
          )}

          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            Diagnostics
            {showDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Telemetry quick stats */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-400" />
            <strong className="text-slate-200">{baudRate}</strong> baud
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-teal-400" />
            Packets: <strong className="text-slate-200">{validPacketCount}</strong>
          </span>
          {lastPacketTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              Last: <strong className="text-slate-200">{lastPacketTime}</strong>
            </span>
          )}
        </div>
      </div>

      {/* User Connection Error Display */}
      {connectionError && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 flex items-start gap-3 text-rose-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-rose-300">{connectionError}</span>
            {technicalError && (
              <span className="font-mono text-[11px] text-rose-400/80 break-all">{technicalError}</span>
            )}
          </div>
        </div>
      )}

      {/* Diagnostics Foldout Section */}
      {showDiagnostics && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2 font-mono text-xs text-slate-300">
          <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
            <span>ESP32 Serial Diagnostics</span>
            <span>Web Serial API</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div>Web Serial Supported: <strong className="text-slate-200">{typeof navigator !== 'undefined' && 'serial' in navigator ? 'YES' : 'NO'}</strong></div>
            <div>Secure Context: <strong className="text-slate-200">{typeof window !== 'undefined' && window.isSecureContext ? 'YES' : 'NO'}</strong></div>
            <div>Embedded iframe: <strong className="text-slate-200">{typeof window !== 'undefined' && window.self !== window.top ? 'YES' : 'NO'}</strong></div>
            <div>Baud Rate: <strong className="text-slate-200">115200</strong></div>
          </div>

          <div className="flex flex-col gap-1 mt-1">
            <span className="text-[10px] text-slate-500 uppercase">Last Received Serial Packet:</span>
            <div className="bg-black/80 border border-slate-800 p-2 rounded text-emerald-400 text-[11px] break-all min-h-[32px] font-mono">
              {lastRawLine || '// Waiting for ESP32 serial data line...'}
            </div>
          </div>
        </div>
      )}

      {/* Sensor Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* Soil Moisture */}
        <div className="bg-slate-900/80 border border-emerald-800/30 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span className="font-semibold flex items-center gap-1">
              <Droplet className="w-3.5 h-3.5 text-blue-400" /> Soil Moisture
            </span>
            <span className="font-bold text-sm text-emerald-100">{readings.moisture}%</span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                readings.moisture < 30 ? 'bg-amber-500' : readings.moisture > 75 ? 'bg-blue-500' : 'bg-emerald-400'
              }`}
              style={{ width: `${readings.moisture}%` }}
            />
          </div>

          {isManualOverride && (
            <input
              type="range"
              min="0"
              max="100"
              value={readings.moisture}
              onChange={(e) => setSensorValue('moisture', Number(e.target.value))}
              className="accent-emerald-400 w-full cursor-pointer h-1 bg-slate-700 rounded-lg"
            />
          )}
        </div>

        {/* Light Level */}
        <div className="bg-slate-900/80 border border-emerald-800/30 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span className="font-semibold flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-400" /> Light Intensity
            </span>
            <span className="font-bold text-sm text-emerald-100">{readings.light}%</span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${readings.light}%` }}
            />
          </div>

          {isManualOverride && (
            <input
              type="range"
              min="0"
              max="100"
              value={readings.light}
              onChange={(e) => setSensorValue('light', Number(e.target.value))}
              className="accent-amber-400 w-full cursor-pointer h-1 bg-slate-700 rounded-lg"
            />
          )}
        </div>

        {/* Temperature */}
        <div className="bg-slate-900/80 border border-emerald-800/30 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span className="font-semibold flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" /> Temperature
            </span>
            <span className="font-bold text-sm text-emerald-100">
              {readings.temperature !== null && readings.temperature !== undefined ? `${readings.temperature}°C` : 'N/A'}
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-400 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, ((readings.temperature || 20) / 40) * 100))}%` }}
            />
          </div>

          {isManualOverride && (
            <input
              type="range"
              min="10"
              max="40"
              step="0.5"
              value={readings.temperature || 24}
              onChange={(e) => setSensorValue('temperature', Number(e.target.value))}
              className="accent-rose-400 w-full cursor-pointer h-1 bg-slate-700 rounded-lg"
            />
          )}
        </div>

        {/* Humidity */}
        <div className="bg-slate-900/80 border border-emerald-800/30 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span className="font-semibold flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-teal-400" /> Humidity
            </span>
            <span className="font-bold text-sm text-emerald-100">
              {readings.humidity !== null && readings.humidity !== undefined ? `${readings.humidity}%` : 'N/A'}
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-400 transition-all duration-300"
              style={{ width: `${readings.humidity || 50}%` }}
            />
          </div>

          {isManualOverride && (
            <input
              type="range"
              min="0"
              max="100"
              value={readings.humidity || 50}
              onChange={(e) => setSensorValue('humidity', Number(e.target.value))}
              className="accent-teal-400 w-full cursor-pointer h-1 bg-slate-700 rounded-lg"
            />
          )}
        </div>

        {/* CO2 */}
        <div className="bg-slate-900/80 border border-emerald-800/30 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-emerald-400">
            <span className="font-semibold flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-purple-400" /> CO2 Air Level
            </span>
            <span className="font-bold text-sm text-emerald-100">
              {readings.co2 !== null && readings.co2 !== undefined ? `${readings.co2} ppm` : 'N/A'}
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-400 transition-all duration-300"
              style={{ width: `${Math.min(100, ((readings.co2 || 400) / 1200) * 100)}%` }}
            />
          </div>

          {isManualOverride && (
            <input
              type="range"
              min="300"
              max="1200"
              step="10"
              value={readings.co2 || 580}
              onChange={(e) => setSensorValue('co2', Number(e.target.value))}
              className="accent-purple-400 w-full cursor-pointer h-1 bg-slate-700 rounded-lg"
            />
          )}
        </div>
      </div>
    </div>
  );
};
