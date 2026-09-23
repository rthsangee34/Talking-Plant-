import { create } from 'zustand';

interface ObservationLoopState {
  autoObserveEnabled: boolean;
  intervalMinutes: number;
  lastRunTimestamp: string | null;
  setAutoObserveEnabled: (enabled: boolean) => void;
  setIntervalMinutes: (minutes: number) => void;
  setLastRunTimestamp: (ts: string | null) => void;
}

export const useObservationLoopStore = create<ObservationLoopState>((set) => ({
  autoObserveEnabled: false,
  intervalMinutes: 5,
  lastRunTimestamp: null,

  setAutoObserveEnabled: (enabled) => set({ autoObserveEnabled: enabled }),
  setIntervalMinutes: (minutes) => set({ intervalMinutes: minutes }),
  setLastRunTimestamp: (ts) => set({ lastRunTimestamp: ts }),
}));
