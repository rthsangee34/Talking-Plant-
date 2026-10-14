import React, { useEffect, useState } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Minus,
  AlertOctagon,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  Droplets,
} from 'lucide-react';
import { useMonitoringStore } from '../../stores/plant/monitoring-store';
import { mockSensorService, MOCK_SCENARIOS, MockScenario } from '../../services/mockSensorService';
import { sensorService } from '../../services/sensorService';

export const HealthTrendsPanel: React.FC = () => {
  const {
    activeAlerts,
    trends,
    timeline,
    historicalPoints,
    historyRange,
    isVoiceAlertEnabled,
    activeMockScenario,
    isMockMode,
    setHistoryRange,
    setVoiceAlertEnabled,
    dismissAlert,
    fetchHistory,
  } = useMonitoringStore();

  const [activeSubTab, setActiveSubTab] = useState<'trends' | 'timeline' | 'simulator'>('trends');

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const renderTrendIcon = (direction: string) => {
    switch (direction) {
      case 'rapid_drop':
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-rose-400" />;
      case 'rapid_rise':
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      default:
        return <Minus className="w-4 h-4 text-blue-400" />;
    }
  };

  // Helper to generate SVG polyline path for historical data points
  const renderSvgChart = () => {
    if (historicalPoints.length < 2) {
      return (
        <div className="h-28 flex items-center justify-center text-slate-500 text-xs italic bg-slate-950/40 rounded border border-slate-800">
          Gathering 24/7 telemetry points for {historyRange} chart...
        </div>
      );
    }

    const width = 360;
    const height = 90;
    const padding = 10;

    const points = historicalPoints.slice(-30);
    const minMoisture = 0;
    const maxMoisture = 100;

    const coords = points.map((p, i) => {
      const x = padding + (i / (points.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((p.soilMoisture - minMoisture) / (maxMoisture - minMoisture)) * (height - 2 * padding);
      return `${x},${y}`;
    });

    const polylineStr = coords.join(' ');
    const firstCoord = coords[0].split(',');
    const lastCoord = coords[coords.length - 1].split(',');
    const areaStr = `${polylineStr} ${lastCoord[0]},${height} ${firstCoord[0]},${height}`;

    const latest = points[points.length - 1];

    return (
      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-300">
          <span className="font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            Soil Moisture History
          </span>
          <span className="font-mono text-blue-400 font-bold">{latest.soilMoisture}%</span>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
          {/* Target Zone Shading (35% to 70%) */}
          <rect
            x="0"
            y={height - padding - (0.7 * (height - 2 * padding))}
            width={width}
            height={0.35 * (height - 2 * padding)}
            fill="rgba(16, 185, 129, 0.08)"
          />

          {/* Area Fill */}
          <polygon points={areaStr} fill="rgba(59, 130, 246, 0.15)" />

          {/* Sparkline */}
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylineStr}
          />

          {/* Current reading dot */}
          <circle
            cx={lastCoord[0]}
            cy={lastCoord[1]}
            r="4"
            fill="#38bdf8"
            className="animate-pulse"
          />
        </svg>

        <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
          <span>{new Date(points[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="text-emerald-500/80">Optimal Range (35-70%)</span>
          <span>{new Date(latest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5 text-slate-100 shadow-md h-full min-h-0 overflow-y-auto pr-1 scrollbar-thin">
      {/* Sub-tab switcher */}
      <div className="flex items-center justify-between gap-1 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-bold">
          <button
            onClick={() => setActiveSubTab('trends')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              activeSubTab === 'trends' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Trends & Alerts
          </button>
          <button
            onClick={() => setActiveSubTab('timeline')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              activeSubTab === 'timeline' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Timeline Log
          </button>
          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              activeSubTab === 'simulator' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🧪 Simulator
          </button>
        </div>

        {/* Voice Toggle */}
        <button
          onClick={() => setVoiceAlertEnabled(!isVoiceAlertEnabled)}
          className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
            isVoiceAlertEnabled
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
              : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
          }`}
          title={isVoiceAlertEnabled ? 'Voice alerts enabled' : 'Voice alerts muted'}
        >
          {isVoiceAlertEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* TAB 1: TRENDS & ALERTS */}
      {activeSubTab === 'trends' && (
        <div className="flex flex-col gap-2.5">
          {/* Active Alerts List */}
          {activeAlerts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Active Alerts ({activeAlerts.length})
              </span>
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-2.5 rounded-lg border flex flex-col gap-1.5 text-xs ${
                    alert.level === 'CRITICAL'
                      ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                      : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold">
                      {alert.level === 'CRITICAL' ? (
                        <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span>{alert.title}</span>
                    </div>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-[11px] leading-snug">{alert.message}</p>
                  <p className="text-[10px] text-slate-300 font-medium italic">{alert.tamilMessage}</p>

                  <div className="mt-1 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Target: {alert.configuredRange}</span>
                    <span className="text-emerald-300 font-medium">{alert.recommendedAction}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Time Range Selector */}
          <div className="flex items-center justify-between gap-1 pt-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">Telemetry History</span>
            <div className="flex items-center gap-1">
              {(['1h', '6h', '24h', '7d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setHistoryRange(r)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    historyRange === r
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Chart */}
          {renderSvgChart()}

          {/* Trend Analysis Readout */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Rate-Of-Change Analysis
            </span>
            {trends.map((t, idx) => (
              <div
                key={idx}
                className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  {renderTrendIcon(t.direction)}
                  <div>
                    <div className="font-semibold text-slate-200 text-[11px]">{t.description}</div>
                    <div className="text-slate-400 text-[10px] italic">{t.tamilDescription}</div>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-bold text-slate-400">
                  {t.ratePerHour > 0 ? `+${t.ratePerHour}` : t.ratePerHour}%/hr
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: BOTANICAL TIMELINE LOG */}
      {activeSubTab === 'timeline' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              24/7 Event History
            </span>
            <button
              onClick={() => {
                sensorService.recordTimelineEvent('User Checked Plant', 'Routine manual health check completed', 'HEALTHY', 'observation');
              }}
              className="text-[10px] px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-semibold cursor-pointer border border-slate-700"
            >
              + Log Check
            </button>
          </div>

          {timeline.length === 0 ? (
            <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-6 text-center text-slate-500 text-xs">
              No timeline events recorded yet. Normal 24/7 monitoring is running in the background.
            </div>
          ) : (
            <div className="space-y-2">
              {timeline.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col gap-1 text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/80 pb-1">
                    <span className="flex items-center gap-1 text-slate-300 font-mono">
                      <Clock className="w-3 h-3 text-emerald-400" /> {ev.timeFormatted}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                        ev.status === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : ev.status === 'ATTENTION'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>
                  <div className="font-bold text-slate-200 text-[11px]">{ev.title}</div>
                  {ev.description && <div className="text-slate-400 text-[10px]">{ev.description}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REAL-TIME TEST & SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="flex flex-col gap-2.5">
          <div className="p-2.5 bg-amber-950/20 border border-amber-800/40 rounded-lg text-xs text-amber-200">
            <span className="font-bold block mb-0.5">🧪 Mock & Test Simulator</span>
            Inject simulated sensor conditions to test alert thresholds, recovery flows, and speech without waiting for real environment changes.
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {MOCK_SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => mockSensorService.setScenario(scenario.id)}
                className={`p-2 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  activeMockScenario === scenario.id
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                    : 'bg-slate-950 hover:bg-slate-800/60 border-slate-800 text-slate-300'
                }`}
              >
                <div className="font-bold text-[11px] flex items-center justify-between">
                  <span>{scenario.label}</span>
                  {activeMockScenario === scenario.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  )}
                </div>
                <span className="text-[10px] text-slate-400 leading-tight">{scenario.description}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => mockSensorService.runAutomatedDemo()}
            className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md mt-1"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>🎬 Run Automated 5-Step Demo Flow</span>
          </button>

          {isMockMode && (
            <button
              onClick={() => mockSensorService.stopMockStream()}
              className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-700"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset & Switch to Real Hardware Mode</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
