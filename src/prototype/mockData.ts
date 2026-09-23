import { PlantMetrics, SystemStatusState, AIInsightData, QuickActionItem } from './types';

export const initialPlantMetrics: PlantMetrics = {
  healthScore: 85,
  maxHealthScore: 100,
  status: 'Healthy',
  statusDescription: 'Your plant looks healthy! Conditions are good. Keep monitoring for better growth.',
  moisture: 84,
  temperature: 30.2,
  humidity: 35,
  light: 32,
  stability: 92,
  lastUpdated: 'Just now',
};

export const initialSystemStatus: SystemStatusState = {
  camera: { status: 'Ready', label: 'Ready' },
  esp32: { status: 'Connected', label: 'Connected' },
  geminiAi: { status: 'Ready', label: 'Ready' },
  voice: { status: 'Ready', label: 'Ready' },
};

export const initialAiInsight: AIInsightData = {
  time: '10:36 AM',
  text: 'Your plant is currently growing well.',
  tone: 'positive',
};

export const quickActionItems: QuickActionItem[] = [
  {
    id: 'scan-plant',
    title: 'Scan Plant',
    description: 'Analyze plant with AI',
    iconName: 'scan',
    color: 'emerald',
  },
  {
    id: 'talk-plant',
    title: 'Talk to Plant',
    description: 'Chat with Gemini Live',
    iconName: 'voice',
    color: 'purple',
    badge: 'Live',
  },
  {
    id: 'view-telemetry',
    title: 'View Telemetry',
    description: 'Check sensor data',
    iconName: 'telemetry',
    color: 'blue',
  },
];
