/**
 * Plant Monitoring Data Contracts and Type Definitions
 *
 * Defines the standard interfaces for 24/7 real-time telemetry,
 * deterministic plant health calculations, trend & anomaly detection,
 * alerts, device connectivity, and timeline events.
 */

export type PlantHealthStatus = 'HEALTHY' | 'ATTENTION' | 'STRESSED' | 'CRITICAL' | 'UNKNOWN';

export type AlertSeverity = 'INFO' | 'ATTENTION' | 'CRITICAL';

export type TrendDirection = 'stable' | 'increasing' | 'decreasing' | 'rapid_drop' | 'rapid_rise';

export interface SensorReading {
  soilMoisture: number; // 0 - 100%
  temperature: number | null; // Celsius
  humidity: number | null; // 0 - 100%
  light: number | null; // 0 - 100%
  co2?: number | null; // ppm
  timestamp: string; // ISO 8601
  deviceId: string;
  isMock?: boolean;
}

export interface HealthScoreBreakdown {
  overall: number; // 0 - 100
  moistureScore: number; // 0 - 100
  tempScore: number; // 0 - 100
  humidityScore: number; // 0 - 100
  lightScore: number; // 0 - 100
  stabilityScore: number; // 0 - 100
  status: PlantHealthStatus;
  summary: string;
}

export interface PlantThresholdConfig {
  id: string;
  species: string;
  minMoisture: number;
  maxMoisture: number;
  criticalMinMoisture: number;
  criticalMaxMoisture: number;
  minTemp: number;
  maxTemp: number;
  minHumidity: number;
  maxHumidity: number;
  minLight: number;
  maxLight: number;
}

export interface TrendAnalysisResult {
  parameter: 'soilMoisture' | 'temperature' | 'humidity' | 'light';
  direction: TrendDirection;
  ratePerHour: number;
  description: string;
  tamilDescription: string;
}

export interface AnomalyEvent {
  id: string;
  parameter: string;
  detectedValue: number;
  previousValue: number;
  delta: number;
  severity: AlertSeverity;
  timestamp: string;
  message: string;
  tamilMessage: string;
}

export interface MonitoringAlert {
  id: string;
  level: AlertSeverity;
  code: string;
  title: string;
  message: string;
  tamilMessage: string;
  parameter: string;
  currentReading: number | null;
  configuredRange: string;
  timestamp: string;
  recommendedAction: string;
  recommendedActionTamil: string;
  isResolved?: boolean;
  resolvedAt?: string;
  aiExplanation?: {
    english: string;
    tamil: string;
    personality: 'angry' | 'humorous' | 'protective' | 'friendly';
  };
}

export interface DeviceConnectionStatus {
  deviceId: string;
  isOnline: boolean;
  lastSeen: string | null;
  isStale: boolean;
  packetCount: number;
  isMock: boolean;
  ipAddress?: string;
}

export interface PlantTimelineEvent {
  id: string;
  timestamp: string;
  timeFormatted: string;
  status: PlantHealthStatus;
  title: string;
  description: string;
  type: 'telemetry' | 'health_change' | 'alert' | 'touch' | 'watering' | 'observation';
  icon?: string;
}

export interface HistoricalDataPoint {
  timestamp: string;
  soilMoisture: number;
  temperature: number | null;
  humidity: number | null;
  light: number | null;
  healthScore: number;
}

export interface PlantTelemetryPayload {
  soilMoisture?: number | null;
  moisture?: number | null; // Compatibility alias
  temperature?: number | null;
  humidity?: number | null;
  light?: number | null;
  co2?: number | null;
  deviceId?: string;
  timestamp?: string;
  isMock?: boolean;
}
