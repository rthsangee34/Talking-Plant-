export type NavSection = 
  | 'overview' 
  | 'vision' 
  | 'telemetry' 
  | 'voice' 
  | 'history' 
  | 'diagnostics';

export type Language = 'en' | 'ta';

export interface PlantMetrics {
  healthScore: number; // e.g. 85
  maxHealthScore: number; // 100
  status: 'Healthy' | 'Growing Well' | 'Needs Attention';
  statusDescription: string;
  moisture: number; // e.g. 84%
  temperature: number; // e.g. 30.2°C
  humidity: number; // e.g. 35%
  light: number; // e.g. 32%
  stability: number; // e.g. 92%
  lastUpdated: string;
}

export interface SystemStatusState {
  camera: { status: 'Ready' | 'Active' | 'Offline'; label: string };
  esp32: { status: 'Connected' | 'Connecting' | 'Offline'; label: string };
  geminiAi: { status: 'Ready' | 'Processing' | 'Setup'; label: string };
  voice: { status: 'Ready' | 'Listening' | 'Active' | 'Offline'; label: string };
}

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  iconName: 'scan' | 'voice' | 'telemetry';
  color: string;
  badge?: string;
}

export interface AIInsightData {
  time: string;
  text: string;
  tone: 'positive' | 'neutral' | 'alert';
}
