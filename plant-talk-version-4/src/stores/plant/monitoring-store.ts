import { create } from 'zustand';
import type {
  HealthScoreBreakdown,
  DeviceConnectionStatus,
  MonitoringAlert,
  TrendAnalysisResult,
  PlantTimelineEvent,
  HistoricalDataPoint,
} from '../../types/plantMonitoring';

interface MonitoringState {
  healthScore: HealthScoreBreakdown;
  deviceStatus: DeviceConnectionStatus;
  activeAlerts: MonitoringAlert[];
  trends: TrendAnalysisResult[];
  timeline: PlantTimelineEvent[];
  historicalPoints: HistoricalDataPoint[];
  historyRange: '1h' | '6h' | '24h' | '7d';
  isMockMode: boolean;
  activeMockScenario: string | null;
  isVoiceAlertEnabled: boolean;
  lastAnomaly: string | null;

  setHealthScore: (health: HealthScoreBreakdown) => void;
  setDeviceStatus: (status: Partial<DeviceConnectionStatus>) => void;
  addAlert: (alert: MonitoringAlert) => void;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;
  setTrends: (trends: TrendAnalysisResult[]) => void;
  addTimelineEvent: (event: PlantTimelineEvent) => void;
  setTimeline: (events: PlantTimelineEvent[]) => void;
  setHistoricalPoints: (points: HistoricalDataPoint[]) => void;
  setHistoryRange: (range: '1h' | '6h' | '24h' | '7d') => void;
  setMockMode: (isMock: boolean) => void;
  setActiveMockScenario: (scenario: string | null) => void;
  setVoiceAlertEnabled: (enabled: boolean) => void;
  setLastAnomaly: (anomaly: string | null) => void;
  fetchHistory: (range?: '1h' | '6h' | '24h' | '7d') => Promise<void>;
  fetchStatus: () => Promise<void>;
}

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  healthScore: {
    overall: 85,
    moistureScore: 88,
    tempScore: 90,
    humidityScore: 82,
    lightScore: 85,
    stabilityScore: 92,
    status: 'HEALTHY',
    summary: 'Environmental conditions appear balanced.',
  },

  deviceStatus: {
    deviceId: 'plant-talk-01',
    isOnline: false,
    lastSeen: null,
    isStale: false,
    packetCount: 0,
    isMock: false,
  },

  activeAlerts: [],
  trends: [
    {
      parameter: 'soilMoisture',
      direction: 'stable',
      ratePerHour: 0.1,
      description: 'Soil moisture is stable.',
      tamilDescription: 'மண்ணின் ஈரப்பதம் சீராக உள்ளது.',
    },
  ],
  timeline: [],
  historicalPoints: [],
  historyRange: '1h',
  isMockMode: false,
  activeMockScenario: null,
  isVoiceAlertEnabled: true,
  lastAnomaly: null,

  setHealthScore: (health) => set({ healthScore: health }),

  setDeviceStatus: (status) =>
    set((state) => ({
      deviceStatus: { ...state.deviceStatus, ...status },
    })),

  addAlert: (alert) =>
    set((state) => {
      // Check if already exists by code
      const filtered = state.activeAlerts.filter((a) => a.code !== alert.code);
      return { activeAlerts: [alert, ...filtered] };
    }),

  dismissAlert: (id) =>
    set((state) => ({
      activeAlerts: state.activeAlerts.filter((a) => a.id !== id),
    })),

  clearAlerts: () => set({ activeAlerts: [] }),

  setTrends: (trends) => set({ trends }),

  addTimelineEvent: (event) =>
    set((state) => ({
      timeline: [event, ...state.timeline].slice(0, 100),
    })),

  setTimeline: (events) => set({ timeline: events }),

  setHistoricalPoints: (points) => set({ historicalPoints: points }),

  setHistoryRange: (range) => {
    set({ historyRange: range });
    get().fetchHistory(range);
  },

  setMockMode: (isMock) => set({ isMockMode: isMock }),

  setActiveMockScenario: (scenario) => set({ activeMockScenario: scenario }),

  setVoiceAlertEnabled: (enabled) => set({ isVoiceAlertEnabled: enabled }),

  setLastAnomaly: (anomaly) => set({ lastAnomaly: anomaly }),

  fetchHistory: async (range) => {
    const targetRange = range || get().historyRange;
    try {
      const res = await fetch(`/api/sensors/history?range=${targetRange}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.records)) {
          set({ historicalPoints: json.records });
        }
      }
    } catch {
      // Offline fallback: keep existing
    }
  },

  fetchStatus: async () => {
    try {
      const res = await fetch('/api/sensors/status');
      if (res.ok) {
        const json = await res.json();
        if (json.device) set({ deviceStatus: json.device });
        if (json.activeAlerts) set({ activeAlerts: json.activeAlerts });
        if (json.timeline) set({ timeline: json.timeline });
      }
    } catch {
      // Server unreachable
    }
  },
}));
