import React from 'react';
import { Sprout, CheckCircle2, ChevronRight, Activity, AlertTriangle } from 'lucide-react';
import { HealthRing } from './HealthRing';
import { EnvironmentMetrics } from './EnvironmentMetrics';
import { AIInsight } from './AIInsight';
import { PlantMetrics, AIInsightData } from '../types';
import { useMonitoringStore } from '../../stores/plant/monitoring-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useObserverStore } from '../../stores/plant/observer-store';

interface PlantHealthProps {
  metrics?: PlantMetrics;
  aiInsight?: AIInsightData;
  onOpenTelemetry?: () => void;
}

export const PlantHealth: React.FC<PlantHealthProps> = ({
  metrics: propMetrics,
  aiInsight: propAiInsight,
  onOpenTelemetry,
}) => {
  const { healthScore } = useMonitoringStore();
  const { readings } = useSensorsStore();
  const { lastAnalysis } = useObserverStore();

  // Calculate dynamic health score from real sensor readings if monitoring store is initializing
  const calculateRealHealth = () => {
    let score = 0;
    const m = readings.moisture;
    const t = readings.temperature ?? 24;
    const h = readings.humidity ?? 55;
    const l = readings.light;

    if (m >= 40 && m <= 75) score += 25;
    else if (m >= 25 && m <= 85) score += 15;
    else score += 5;

    if (t >= 18 && t <= 28) score += 25;
    else if (t >= 15 && t <= 33) score += 15;
    else score += 5;

    if (h >= 45 && h <= 75) score += 25;
    else if (h >= 30 && h <= 85) score += 15;
    else score += 5;

    if (l >= 30 && l <= 85) score += 25;
    else if (l >= 15 && l <= 95) score += 15;
    else score += 5;

    return Math.max(10, Math.min(100, score));
  };

  const currentScore = healthScore?.overall ?? calculateRealHealth();
  const maxScore = 100;

  const mainPlant = lastAnalysis?.plants?.find((p) => p.role === 'main') || lastAnalysis?.plants?.[0];
  const analysisSummary = mainPlant?.visibleCondition || lastAnalysis?.sceneSummary;

  const statusLabel = currentScore >= 80 ? 'Healthy' : currentScore >= 60 ? 'Fair' : 'Attention';
  const statusDesc = analysisSummary
    ? analysisSummary
    : currentScore >= 80
    ? 'All botanical parameters within optimal range.'
    : currentScore >= 60
    ? 'Sub-optimal environment. Check moisture or light.'
    : 'Plant requires attention. Review telemetry warnings.';

  const dynamicAiInsight: AIInsightData = propAiInsight ?? {
    summary: analysisSummary || 'Photosynthesis and chlorophyll levels are stable with active respiration.',
    confidence: lastAnalysis ? 95 : 88,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  return (
    <div className="flex flex-col gap-3 liquid-glass rounded-3xl p-3.5 sm:p-4 border border-white/75 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-800">
            <Sprout className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-emerald-950 tracking-tight">
            Plant Health
          </h2>
        </div>

        {/* Healthy Badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${
          currentScore >= 75
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-900'
            : currentScore >= 50
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-900'
            : 'bg-rose-500/15 border-rose-500/30 text-rose-900'
        }`}>
          {currentScore >= 75 ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          )}
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* Health Ring + Status Description */}
      <div className="flex items-center gap-4 py-1">
        <HealthRing score={currentScore} maxScore={maxScore} />

        <div className="flex flex-col justify-center gap-1">
          <h3 className="text-sm sm:text-base font-extrabold text-emerald-950 leading-snug">
            {currentScore >= 80 ? 'Your plant looks healthy!' : currentScore >= 60 ? 'Plant needs mild care' : 'Attention required'}
          </h3>
          <p className="text-xs font-medium text-emerald-900/70 leading-relaxed">
            {statusDesc}
          </p>
        </div>
      </div>

      {/* Environment 4-Metric Grid */}
      <div className="pt-1">
        <EnvironmentMetrics metrics={propMetrics} />
      </div>

      {/* More Telemetry Link */}
      <button
        type="button"
        onClick={onOpenTelemetry}
        className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/40 hover:bg-white/70 border border-white/60 text-xs font-bold text-emerald-900/80 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-emerald-700" />
          <span>More telemetry</span>
        </div>
        <ChevronRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-0.5 transition-all" />
      </button>

      {/* AI Insight Card */}
      <div className="pt-1">
        <AIInsight insight={dynamicAiInsight} />
      </div>
    </div>
  );
};
