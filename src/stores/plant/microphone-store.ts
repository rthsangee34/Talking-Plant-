import { create } from 'zustand';

interface MicrophoneState {
  hasPermission: boolean;
  volumeLevel: number;
  setHasPermission: (permission: boolean) => void;
  setVolumeLevel: (level: number) => void;
}

export const useMicrophoneStore = create<MicrophoneState>((set) => ({
  hasPermission: false,
  volumeLevel: 0,
  setHasPermission: (permission) => set({ hasPermission: permission }),
  setVolumeLevel: (level) => set({ volumeLevel: level }),
}));
