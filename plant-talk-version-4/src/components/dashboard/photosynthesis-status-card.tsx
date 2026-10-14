import React, { useMemo } from 'react';
import {
  Sun,
  Droplets,
  Wind,
  Thermometer,
  Leaf,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useObserverStore } from '../../stores/plant/observer-store';
import { DEFAULT_PLANT_PROFILE } from '../../lib/plant/plants';
import { calculatePhotosynthesisAnalysis } from '../../lib/plantAnalysis/photosynthesisEngine';
import { FactorAssessment } from '../../lib/plantAnalysis/types';

export const PhotosynthesisStatusCard: React.FC = () => {
  const { readings, isEspConnected, isManualOverride } = useSensorsStore();
  const { lastAnalysis } = useObserverStore();
  const profile = DEFAULT_PLANT_PROFILE;

  const analysis = useMemo(() => {
    // If disconnected and not manual override, pass null to represent offline
    const activeReadings = isEspConnected || isManualOverride ? readings : null;
    return calculatePhotosynthesisAnalysis(activeReadings, lastAnalysis, {
      speciesProfile: {
        speciesName: profile.species,
        targetLightMin: profile.targetLightMin,
        targetLightMax: profile.targetLightMax,
        targetMoistureMin: profile.targetMoistureMin,
        targetMoistureMax: profile.targetMoistureMax,
      },
    });
  }, [readings, isEspConnected, isManualOverride, lastAnalysis, profile]);

  const { overallScore, status, statusLabel, statusEmoji, confidence, factors, limitingFactor } =
    analysis;

  // Status badge styling
  const statusBadgeColor = useMemo(() => {
    switch (status) {
      case 'good':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'moderate':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'low':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'poor':
      default:
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    }
  }, [status]);

  const confidenceBadge = useMemo(() => {
    switch (confidence) {
      case 'high':
        return { text: 'High Confidence', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'medium':
        return { text: 'Medium Confidence', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'low':
      default:
        return { text: 'Low Confidence (Telemetry Limited)', color: 'bg-slate-700/50 text-slate-400 border-slate-600/30' };
    }
  }, [confidence]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 shadow-md backdrop-blur-sm flex flex-col gap-2.5 text-slate-100 transition-all duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Leaf className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-emerald-200 tracking-wide">
                Photosynthesis Intelligence
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700/50">
                Estimate Only
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Environmental capacity estimate based on current sunlight, hydration, and atmosphere
            </p>
          </div>
        </div>

        {/* Confidence Badge */}
        <span
          className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${confidenceBadge.color}`}
        >
          {confidenceBadge.text}
        </span>
      </div>

      {/* Main Condition Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
        {/* Score Gauge */}
        <div className="flex flex-col items-center justify-center text-center p-2">
          <div className="relative flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                className="stroke-slate-800"
                strokeWidth="9"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                className={`transition-all duration-700 ease-out ${
                  overallScore >= 75
                    ? 'stroke-emerald-400'
                    : overallScore >= 50
                    ? 'stroke-amber-400'
                    : overallScore >= 25
                    ? 'stroke-orange-400'
                    : 'stroke-rose-500'
                }`}
                strokeWidth="9"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * overallScore) / 100}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {overallScore}%
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Support
              </span>
            </div>
          </div>
        </div>

        {/* Condition details */}
        <div className="md:col-span-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold border flex items-center gap-1.5 ${statusBadgeColor}`}
            >
              <span>{statusEmoji}</span>
              <span>{statusLabel}</span>
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {analysis.explanation}
          </p>

          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
            <span>Equation: 6CO₂ + 6H₂O + Sunlight → C₆H₁₂O₆ + 6O₂</span>
          </div>
        </div>
      </div>

      {/* 5 Factors Breakdown Grid */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Photosynthetic Environmental Factors</span>
          <span className="text-[10px] text-slate-500 font-normal">Real-Time Sensor Inputs</span>
        </h4>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* 1. Light */}
          <FactorMiniCard
            icon={<Sun className="w-3.5 h-3.5 text-amber-400" />}
            title="Light (Sunlight)"
            factor={factors.light}
            suffix="%"
          />

          {/* 2. Water / Soil */}
          <FactorMiniCard
            icon={<Droplets className="w-3.5 h-3.5 text-blue-400" />}
            title="Water / Soil"
            factor={factors.water}
            suffix="%"
          />

          {/* 3. CO2 */}
          <FactorMiniCard
            icon={<Wind className="w-3.5 h-3.5 text-purple-400" />}
            title="CO₂ Air Substrate"
            factor={factors.co2}
            suffix=" ppm"
          />

          {/* 4. Temperature */}
          <FactorMiniCard
            icon={<Thermometer className="w-3.5 h-3.5 text-rose-400" />}
            title="Enzyme Temp"
            factor={factors.temperature}
            suffix="°C"
          />

          {/* 5. Leaf Health */}
          <FactorMiniCard
            icon={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
            title="Leaf Chlorophyll"
            factor={factors.leafHealth}
            suffix=""
            isLeaf
          />
        </div>
      </div>

      {/* Limiting Factor & Action Suggestion */}
      <div
        className={`rounded-xl p-3.5 sm:p-4 border flex flex-col gap-2 ${
          limitingFactor.severity === 'severe'
            ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            : limitingFactor.severity === 'moderate'
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            : limitingFactor.severity === 'mild'
            ? 'bg-orange-950/30 border-orange-500/30 text-orange-200'
            : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
        }`}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {limitingFactor.severity === 'none' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : limitingFactor.severity === 'severe' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            )}
            <span className="font-bold text-xs sm:text-sm tracking-wide">
              {limitingFactor.severity === 'none'
                ? 'Balanced Photosynthetic Conditions'
                : `Main Limiting Factor: ${limitingFactor.factorName}`}
            </span>
          </div>

          {limitingFactor.severity !== 'none' && limitingFactor.severity !== 'uncertain' && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                limitingFactor.severity === 'severe'
                  ? 'bg-rose-900/60 border-rose-400/50 text-rose-300'
                  : 'bg-amber-900/60 border-amber-400/50 text-amber-300'
              }`}
            >
              {limitingFactor.severity} limitation
            </span>
          )}
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {limitingFactor.explanation}
        </p>

        {limitingFactor.recommendedAction && (
          <div className="mt-1 pt-2 border-t border-slate-800/60 flex items-start gap-2 text-xs text-emerald-300">
            <span className="font-semibold shrink-0">💡 Suggested Care:</span>
            <span>{limitingFactor.recommendedAction}</span>
          </div>
        )}
      </div>

      {/* Scientific Disclaimer Footer */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 border-t border-slate-800/80 pt-2.5">
        <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
        <span>
          <strong>Scientific Note:</strong> PlantTalk estimates environmental support for
          photosynthesis based on physical sensor conditions and visual health. It is not a direct
          laboratory gas-exchange measurement.
        </span>
      </div>
    </div>
  );
};

interface FactorMiniCardProps {
  icon: React.ReactNode;
  title: string;
  factor: FactorAssessment;
  suffix: string;
  isLeaf?: boolean;
}

const FactorMiniCard: React.FC<FactorMiniCardProps> = ({
  icon,
  title,
  factor,
  suffix,
  isLeaf,
}) => {
  return (
    <div
      className={`rounded-xl p-2.5 border flex flex-col justify-between gap-1.5 transition-all ${
        !factor.available
          ? 'bg-slate-950/40 border-slate-800/40 opacity-70'
          : factor.score >= 80
          ? 'bg-slate-950/80 border-emerald-500/20'
          : factor.score >= 55
          ? 'bg-slate-950/80 border-amber-500/20'
          : 'bg-slate-950/80 border-rose-500/20'
      }`}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-slate-400 flex items-center gap-1">
          {icon}
          <span className="truncate max-w-[70px] sm:max-w-none">{title}</span>
        </span>
        {factor.available ? (
          <span
            className={`font-bold text-[11px] ${
              factor.score >= 80
                ? 'text-emerald-400'
                : factor.score >= 55
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {factor.score}%
          </span>
        ) : (
          <HelpCircle className="w-3 h-3 text-slate-600" />
        )}
      </div>

      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-200 truncate">
          {factor.available
            ? isLeaf
              ? factor.label
              : `${factor.value}${suffix}`
            : 'Unavailable'}
        </span>
        {factor.available && !isLeaf && (
          <span className="text-[10px] text-slate-400 truncate ml-1">{factor.label}</span>
        )}
      </div>

      {/* Mini score bar */}
      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            !factor.available
              ? 'bg-slate-700 w-0'
              : factor.score >= 80
              ? 'bg-emerald-400'
              : factor.score >= 55
              ? 'bg-amber-400'
              : 'bg-rose-500'
          }`}
          style={{ width: `${factor.available ? factor.score : 0}%` }}
        />
      </div>
    </div>
  );
};
