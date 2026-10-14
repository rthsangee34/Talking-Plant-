import { create } from 'zustand';

export type TabType = 'dashboard' | 'analysis' | 'observations' | 'voice' | 'history' | 'debug';

interface ExperienceState {
  activeTab: TabType;
  toast: { message: string; type: 'info' | 'success' | 'warning' | 'error' } | null;
  setActiveTab: (tab: TabType) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  clearToast: () => void;
}

export const useExperienceStore = create<ExperienceState>((set) => ({
  activeTab: 'dashboard',
  toast: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set({ toast: null });
    }, 4000);
  },
  clearToast: () => set({ toast: null }),
}));
