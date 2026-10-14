/**
 * Types for Photosynthesis Intelligence Engine.
 *
 * NOTE: As per botanical science, this system provides environmental support
 * and efficiency estimates, NOT direct biochemical laboratory measurements.
 */

export type PhotosynthesisCondition = 'good' | 'moderate' | 'low' | 'poor';

export type PhotosynthesisConfidence = 'high' | 'medium' | 'low';

export type LimitingFactorType =
  | 'light'
  | 'water'
  | 'co2'
  | 'temperature'
  | 'leaf_health'
  | 'none'
  | 'undetermined';

export type FactorStatus =
  | 'too_low'
  | 'low'
  | 'moderate'
  | 'good'
  | 'excessive'
  | 'too_wet'
  | 'dry'
  | 'suitable'
  | 'stressful'
  | 'unavailable';

export interface FactorAssessment {
  score: number; // 0 - 100
  status: FactorStatus;
  label: string; // User-friendly label (e.g. "Low", "Good", "Suitable", "Unavailable")
  available: boolean;
  value: number | null;
  unit: string;
  weight: number; // Configured base weight
  normalizedWeight: number; // Dynamically adjusted weight among available sensors
  detail: string;
}

export interface LimitingFactor {
  factor: LimitingFactorType;
  factorName: string; // e.g., "Insufficient Light", "Dry Soil / Water Scarcity"
  severity: 'mild' | 'moderate' | 'severe' | 'none' | 'uncertain';
  explanation: string;
  recommendedAction: string | null;
}

export interface PhotosynthesisAnalysis {
  overallScore: number; // 0 - 100
  status: PhotosynthesisCondition;
  statusLabel: string; // e.g. "Good Environmental Support for Photosynthesis"
  statusEmoji: string; // 🟢, 🟡, 🟠, 🔴
  confidence: PhotosynthesisConfidence;
  factors: {
    light: FactorAssessment;
    water: FactorAssessment;
    co2: FactorAssessment;
    temperature: FactorAssessment;
    leafHealth: FactorAssessment;
  };
  limitingFactor: LimitingFactor;
  explanation: string;
  plantSpecies?: string | null;
  timestamp: string;
  isEstimateOnly: true;
}

export interface PhotosynthesisEngineConfig {
  weights?: {
    light?: number;
    water?: number;
    co2?: number;
    temperature?: number;
    leafHealth?: number;
  };
  speciesProfile?: {
    targetMoistureMin?: number;
    targetMoistureMax?: number;
    targetLightMin?: number;
    targetLightMax?: number;
    speciesName?: string;
  };
}

export type PhotosynthesisResponseMode = 'simple' | 'detailed_science' | 'child_friendly';
