import { create } from 'zustand';

interface UiModeState {
  showDebugPanel: boolean;
  toggleDebugPanel: () => void;
}

export const useUiModeStore = create<UiModeState>((set) => ({
  showDebugPanel: false,
  toggleDebugPanel: () => set((state) => ({ showDebugPanel: !state.showDebugPanel })),
}));
