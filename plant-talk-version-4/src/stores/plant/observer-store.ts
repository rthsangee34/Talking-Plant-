import { create } from 'zustand';
import { PlantObservation, PlantAnalysis } from '../../types';

interface ObserverState {
  history: PlantObservation[];
  currentObservation: PlantObservation | null;
  lastAnalysis: PlantAnalysis | null;
  isObserving: boolean;
  isAnalyzing: boolean;
  streamingStatus: string | null;
  lastObservationTime: string | null;

  addObservation: (observation: PlantObservation) => void;
  setCurrentObservation: (observation: PlantObservation | null) => void;
  setLastAnalysis: (analysis: PlantAnalysis | null) => void;
  setIsObserving: (observing: boolean) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setStreamingStatus: (status: string | null) => void;
  clearHistory: () => void;
}

export const useObserverStore = create<ObserverState>((set) => ({
  history: [],
  currentObservation: null,
  lastAnalysis: null,
  isObserving: false,
  isAnalyzing: false,
  streamingStatus: null,
  lastObservationTime: null,

  addObservation: (observation) =>
    set((state) => ({
      history: [observation, ...state.history],
      currentObservation: observation,
      lastObservationTime: observation.timestamp,
    })),

  setCurrentObservation: (observation) => set({ currentObservation: observation }),
  setLastAnalysis: (analysis) => set({ lastAnalysis: analysis }),
  setIsObserving: (observing) => set({ isObserving: observing }),
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setStreamingStatus: (status) => set({ streamingStatus: status }),
  clearHistory: () => set({ history: [], currentObservation: null, lastObservationTime: null }),
}));
