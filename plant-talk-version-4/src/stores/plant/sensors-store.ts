import { create } from 'zustand';
import { PlantSensorReadings } from '../../types';
import { normalizeSensorReadings } from '../../lib/plant/sensors';
import { checkIsEmbeddedPreview } from '../../lib/plant/esp32-serial';

export type EspConnectionStatus =
  | 'disconnected'
  | 'selecting'
  | 'connecting'
  | 'connected'
  | 'waiting_data'
  | 'stale'
  | 'unsupported'
  | 'error';

interface SensorsState {
  readings: PlantSensorReadings;
  isManualOverride: boolean;
  isEspConnected: boolean;
  connectionStatus: EspConnectionStatus;
  baudRate: number;
  lastPacketTime: string | null;
  validPacketCount: number;
  lastRawLine: string | null;
  connectionError: string | null;
  technicalError: string | null;
  isEmbeddedPreview: boolean;

  updateReadings: (newReadings: Partial<PlantSensorReadings>) => void;
  setManualOverride: (override: boolean) => void;
  setEspConnected: (connected: boolean) => void;
  setSensorValue: <K extends keyof PlantSensorReadings>(key: K, value: PlantSensorReadings[K]) => void;
  setConnectionStatus: (status: EspConnectionStatus) => void;
  setConnectionError: (userMsg: string | null, techMsg?: string | null) => void;
  recordValidPacket: (rawLine: string, readings: Partial<PlantSensorReadings>) => void;
  setLastRawLine: (line: string) => void;
  resetConnectionInfo: () => void;
}

export const useSensorsStore = create<SensorsState>((set) => ({
  readings: {
    moisture: 52,
    light: 68,
    temperature: 24.5,
    humidity: 58,
    co2: 580,
  },
  isManualOverride: false,
  isEspConnected: false,
  connectionStatus: 'disconnected',
  baudRate: 115200,
  lastPacketTime: null,
  validPacketCount: 0,
  lastRawLine: null,
  connectionError: null,
  technicalError: null,
  isEmbeddedPreview: checkIsEmbeddedPreview(),

  updateReadings: (newReadings) =>
    set((state) => ({
      readings: normalizeSensorReadings({ ...state.readings, ...newReadings }),
    })),

  setManualOverride: (override) => set({ isManualOverride: override }),

  setEspConnected: (connected) => set({ isEspConnected: connected }),

  setSensorValue: (key, value) =>
    set((state) => ({
      readings: { ...state.readings, [key]: value },
    })),

  setConnectionStatus: (status) =>
    set({
      connectionStatus: status,
      isEspConnected: status === 'connected' || status === 'waiting_data' || status === 'stale',
    }),

  setConnectionError: (userMsg, techMsg = null) =>
    set({
      connectionError: userMsg,
      technicalError: techMsg,
    }),

  recordValidPacket: (rawLine, newReadings) =>
    set((state) => ({
      readings: normalizeSensorReadings({ ...state.readings, ...newReadings }),
      isEspConnected: true,
      isManualOverride: false,
      connectionStatus: 'connected',
      validPacketCount: state.validPacketCount + 1,
      lastPacketTime: new Date().toLocaleTimeString(),
      lastRawLine: rawLine,
      connectionError: null,
    })),

  setLastRawLine: (line) => set({ lastRawLine: line }),

  resetConnectionInfo: () =>
    set({
      isEspConnected: false,
      connectionStatus: 'disconnected',
      validPacketCount: 0,
      lastPacketTime: null,
      lastRawLine: null,
    }),
}));
