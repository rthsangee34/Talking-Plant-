import { create } from 'zustand';

export type StartupCaptureStatus = 'idle' | 'waiting-for-camera' | 'capturing' | 'completed' | 'error';

export interface CameraStreamInfo {
  width: number;
  height: number;
  frameRate?: number;
  label?: string;
  is1080p: boolean;
}

export interface CameraCapabilities {
  focusModes?: string[];
  exposureModes?: string[];
  supportedResolutions?: { width: number; height: number }[];
  frameRateRange?: { min: number; max: number };
}

interface CameraState {
  // Core stream state
  isActive: boolean;
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  lastSnapshot: string | null;
  lastMultiSnapshots: string[];
  streamInfo: CameraStreamInfo | null;

  // Startup capture
  startupCaptureStatus: StartupCaptureStatus;
  capturedStartupFrames: string[];

  // Mobile facing mode
  facingMode: 'user' | 'environment' | null;
  isMobile: boolean;

  // Torch & zoom
  torchEnabled: boolean;
  torchSupported: boolean;
  zoomLevel: number;
  zoomRange: { min: number; max: number; step: number } | null;

  // Capabilities
  cameraCapabilities: CameraCapabilities | null;

  // Disconnect & security
  disconnectedMessage: string | null;
  insecureContext: boolean;

  // Protection & Touch Detection System
  protectionEnabled: boolean;
  interactionCount: number;
  lastWhatsAppAlertAt: number | null;
  touchLanguage: 'en' | 'ta';
  debugModeEnabled: boolean;
  selectedTargetPlantId: string | null;
  activeWarningText: string | null;
  touchTelemetry: {
    targetLockStatus: string;
    stabilityScore: number;
    minDistancePx: number;
    handDetected: boolean;
    touchState: string;
    candidateFrames: number;
    touchingFingertips: string[];
    fps: number;
  } | null;

  // Actions
  setActive: (active: boolean) => void;
  setDevices: (devices: MediaDeviceInfo[]) => void;
  setSelectedDeviceId: (id: string | null) => void;
  setIsConnecting: (connecting: boolean) => void;
  setCameraConnectHandler: (handler: ((deviceId: string) => Promise<{ success: boolean; error?: string }>) | null) => void;
  setLastSnapshot: (snapshot: string | null) => void;
  setLastMultiSnapshots: (snapshots: string[]) => void;
  setStreamInfo: (info: CameraStreamInfo | null) => void;
  setStartupCaptureStatus: (status: StartupCaptureStatus) => void;
  setCapturedStartupFrames: (frames: string[]) => void;
  setFacingMode: (mode: 'user' | 'environment' | null) => void;
  setIsMobile: (mobile: boolean) => void;
  setTorchEnabled: (enabled: boolean) => void;
  setTorchSupported: (supported: boolean) => void;
  setZoomLevel: (level: number) => void;
  setZoomRange: (range: { min: number; max: number; step: number } | null) => void;
  setCameraCapabilities: (caps: CameraCapabilities | null) => void;
  setDisconnectedMessage: (msg: string | null) => void;
  setInsecureContext: (insecure: boolean) => void;

  setProtectionEnabled: (enabled: boolean) => void;
  incrementInteraction: () => void;
  resetInteractionCount: () => void;
  setLastWhatsAppAlertAt: (timestamp: number) => void;
  setTouchLanguage: (lang: 'en' | 'ta') => void;
  setDebugModeEnabled: (enabled: boolean) => void;
  setSelectedTargetPlantId: (id: string | null) => void;
  setActiveWarningText: (text: string | null) => void;
  setTouchTelemetry: (telemetry: CameraState['touchTelemetry']) => void;

  isConnecting: boolean;
  cameraConnectHandler: ((deviceId: string) => Promise<{ success: boolean; error?: string }>) | null;
}

export const useCameraStore = create<CameraState>((set) => ({
  // Core stream state
  isActive: false,
  isConnecting: false,
  cameraConnectHandler: null,
  devices: [],
  selectedDeviceId: null,
  lastSnapshot: null,
  lastMultiSnapshots: [],
  streamInfo: null,

  // Startup capture
  startupCaptureStatus: 'idle',
  capturedStartupFrames: [],

  // Mobile facing mode
  facingMode: null,
  isMobile: false,

  // Torch & zoom
  torchEnabled: false,
  torchSupported: false,
  zoomLevel: 1,
  zoomRange: null,

  // Capabilities
  cameraCapabilities: null,

  // Disconnect & security
  disconnectedMessage: null,
  insecureContext: false,

  // Protection & Touch Detection Zone
  protectionEnabled: true,
  interactionCount: 0,
  lastWhatsAppAlertAt: null,
  touchLanguage: 'ta',
  debugModeEnabled: true,
  selectedTargetPlantId: null,
  activeWarningText: null,
  touchTelemetry: null,

  // Actions
  setActive: (active) => set({ isActive: active }),
  setIsConnecting: (connecting) => set({ isConnecting: connecting }),
  setCameraConnectHandler: (handler) => set({ cameraConnectHandler: handler }),
  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  setLastSnapshot: (snapshot) => set({ lastSnapshot: snapshot }),
  setLastMultiSnapshots: (snapshots) => set({ lastMultiSnapshots: snapshots }),
  setStreamInfo: (info) => set({ streamInfo: info }),
  setStartupCaptureStatus: (status) => set({ startupCaptureStatus: status }),
  setCapturedStartupFrames: (frames) => set({ capturedStartupFrames: frames }),
  setFacingMode: (mode) => set({ facingMode: mode }),
  setIsMobile: (mobile) => set({ isMobile: mobile }),
  setTorchEnabled: (enabled) => set({ torchEnabled: enabled }),
  setTorchSupported: (supported) => set({ torchSupported: supported }),
  setZoomLevel: (level) => set({ zoomLevel: level }),
  setZoomRange: (range) => set({ zoomRange: range }),
  setCameraCapabilities: (caps) => set({ cameraCapabilities: caps }),
  setDisconnectedMessage: (msg) => set({ disconnectedMessage: msg }),
  setInsecureContext: (insecure) => set({ insecureContext: insecure }),

  setProtectionEnabled: (enabled) => set({ protectionEnabled: enabled }),
  incrementInteraction: () => set((state) => ({ interactionCount: Math.min(state.interactionCount + 1, 5) })),
  resetInteractionCount: () => set({ interactionCount: 0 }),
  setLastWhatsAppAlertAt: (timestamp) => set({ lastWhatsAppAlertAt: timestamp }),
  setTouchLanguage: (lang) => set({ touchLanguage: lang }),
  setDebugModeEnabled: (enabled) => set({ debugModeEnabled: enabled }),
  setSelectedTargetPlantId: (id) => set({ selectedTargetPlantId: id }),
  setActiveWarningText: (text) => set({ activeWarningText: text }),
  setTouchTelemetry: (telemetry) => set({ touchTelemetry: telemetry }),
}));
