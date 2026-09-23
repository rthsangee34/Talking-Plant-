import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ApiCallRecord {
  id: string;
  type: 'vision' | 'live' | 'protection' | 'general';
  endpoint: string;
  timestamp: string;
  status: 'success' | 'error';
  latencyMs?: number;
}

interface ApiUsageState {
  totalCalls: number;
  visionCalls: number;
  liveSessions: number;
  protectionAlerts: number;
  lastCallAt: string | null;
  history: ApiCallRecord[];

  recordApiCall: (type: 'vision' | 'live' | 'protection' | 'general', endpoint: string, status?: 'success' | 'error', latencyMs?: number) => void;
  resetUsage: () => void;
}

export const useApiUsageStore = create<ApiUsageState>()(
  persist(
    (set) => ({
      totalCalls: 3, // Initial seeded usage for demo / startup calls
      visionCalls: 2,
      liveSessions: 1,
      protectionAlerts: 0,
      lastCallAt: new Date().toLocaleTimeString(),
      history: [],

      recordApiCall: (type, endpoint, status = 'success', latencyMs) =>
        set((state) => ({
          totalCalls: state.totalCalls + 1,
          visionCalls: type === 'vision' ? state.visionCalls + 1 : state.visionCalls,
          liveSessions: type === 'live' ? state.liveSessions + 1 : state.liveSessions,
          protectionAlerts: type === 'protection' ? state.protectionAlerts + 1 : state.protectionAlerts,
          lastCallAt: new Date().toLocaleTimeString(),
          history: [
            {
              id: `call-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              type,
              endpoint,
              timestamp: new Date().toLocaleTimeString(),
              status,
              latencyMs,
            },
            ...state.history.slice(0, 49), // Keep last 50 calls
          ],
        })),

      resetUsage: () =>
        set({
          totalCalls: 0,
          visionCalls: 0,
          liveSessions: 0,
          protectionAlerts: 0,
          lastCallAt: null,
          history: [],
        }),
    }),
    {
      name: 'plant-api-usage',
    }
  )
);
