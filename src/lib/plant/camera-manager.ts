// camera-manager.ts — Headless camera lifecycle logic (no React)

const STORAGE_KEY = 'plantTalkSelectedCameraId';

// ─── Platform detection ──────────────────────────────────────────

export interface PlatformInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

export function detectPlatform(): PlatformInfo {
  const ua = navigator.userAgent || '';
  const isAndroid = /android/i.test(ua);
  const isIOS = /iP(hone|od|ad)/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = isAndroid || isIOS || /mobile|tablet/i.test(ua);
  return { isMobile, isIOS, isAndroid };
}

// ─── Secure context check ────────────────────────────────────────

export function checkSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  if (location.protocol === 'https:') return true;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return true;
  return false;
}

// ─── Device enumeration ──────────────────────────────────────────

export async function enumerateVideoDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all.filter((d) => d.kind === 'videoinput');
  } catch (err) {
    console.error('enumerateVideoDevices error:', err);
    return [];
  }
}

/**
 * Returns a human-readable label for a device, using the browser-reported
 * label when available and falling back to `Camera N` when not.
 */
export function getDeviceLabel(device: MediaDeviceInfo, index: number): string {
  if (device.label && device.label.trim().length > 0) return device.label;
  return `Camera ${index + 1}`;
}

// ─── Preferred device selection ──────────────────────────────────

/**
 * Picks the best default device when no manual selection has been made.
 *
 * Mobile order:  rear/environment → first available → front
 * Desktop order: storedId → external USB → built-in → first
 */
export function selectPreferredDevice(
  devices: MediaDeviceInfo[],
  isMobile: boolean,
  storedId: string | null
): string | null {
  if (devices.length === 0) return null;

  if (isMobile) {
    // Prefer environment / rear
    const rear = devices.find(
      (d) => /back|rear|environment/i.test(d.label)
    );
    if (rear) return rear.deviceId;
    // First available
    return devices[0].deviceId;
  }

  // Desktop
  if (storedId) {
    const stored = devices.find((d) => d.deviceId === storedId);
    if (stored) return stored.deviceId;
  }

  // External USB camera (heuristic: name contains USB / external but not built-in / integrated)
  const external = devices.find(
    (d) =>
      d.label &&
      /usb|external/i.test(d.label) &&
      !/built-in|integrated|facetime/i.test(d.label)
  );
  if (external) return external.deviceId;

  // Built-in
  const builtIn = devices.find(
    (d) => d.label && /built-in|integrated|facetime|webcam/i.test(d.label)
  );
  if (builtIn) return builtIn.deviceId;

  // First available
  return devices[0].deviceId;
}

// ─── Constraint building ─────────────────────────────────────────

export function buildConstraints(
  deviceId: string | null,
  facingMode: 'user' | 'environment' | null,
  _isMobile: boolean
): MediaStreamConstraints {
  const videoConstraints: MediaTrackConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  };

  if (deviceId) {
    videoConstraints.deviceId = { exact: deviceId };
  } else if (facingMode) {
    videoConstraints.facingMode = { ideal: facingMode };
  }

  return { video: videoConstraints };
}

// ─── Stream start with multi-tier fallback ───────────────────────

export async function startStream(
  constraints: MediaStreamConstraints
): Promise<{ stream: MediaStream; error: null } | { stream: null; error: string }> {
  const tryMedia = async (c: MediaStreamConstraints): Promise<MediaStream | null> => {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch {
      return null;
    }
  };

  // Tier 1: Full constraints
  let stream = await tryMedia(constraints);

  // Tier 2: 720p fallback
  if (!stream) {
    const fallback: MediaStreamConstraints = {
      video: {
        ...(typeof constraints.video === 'object' ? constraints.video : {}),
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };
    // Keep deviceId if present
    if (typeof constraints.video === 'object' && constraints.video.deviceId) {
      (fallback.video as MediaTrackConstraints).deviceId = constraints.video.deviceId;
    }
    stream = await tryMedia(fallback);
  }

  // Tier 3: Device-only
  if (!stream && typeof constraints.video === 'object' && constraints.video.deviceId) {
    stream = await tryMedia({ video: { deviceId: constraints.video.deviceId } });
  }

  // Tier 4: Unconstrained
  if (!stream) {
    stream = await tryMedia({ video: true });
  }

  if (!stream) {
    return {
      stream: null,
      error: 'Unable to access camera. Please check permissions or ensure camera is not in use.',
    };
  }

  return { stream, error: null };
}

// ─── Capability extraction ───────────────────────────────────────

export interface ExtractedCapabilities {
  torchSupported: boolean;
  zoomRange: { min: number; max: number; step: number } | null;
  focusModes: string[];
  exposureModes: string[];
  resolution: { width: number; height: number };
  frameRate: number | undefined;
  label: string;
  is1080p: boolean;
}

export function extractCapabilities(track: MediaStreamTrack): ExtractedCapabilities {
  const settings = track.getSettings?.() || {};
  const caps = (track as any).getCapabilities?.() || {};

  const width = settings.width || 1280;
  const height = settings.height || 720;
  const is1080p = width >= 1800 && height >= 1000;

  let torchSupported = false;
  if (caps.torch === true || (Array.isArray(caps.torch) && caps.torch.includes(true))) {
    torchSupported = true;
  }

  let zoomRange: { min: number; max: number; step: number } | null = null;
  if (caps.zoom && typeof caps.zoom === 'object' && 'min' in caps.zoom && 'max' in caps.zoom) {
    const z = caps.zoom as { min: number; max: number; step?: number };
    if (z.max > z.min) {
      zoomRange = { min: z.min, max: z.max, step: z.step || 0.1 };
    }
  }

  const focusModes: string[] = caps.focusMode || [];
  const exposureModes: string[] = caps.exposureMode || [];

  return {
    torchSupported,
    zoomRange,
    focusModes,
    exposureModes,
    resolution: { width, height },
    frameRate: settings.frameRate,
    label: track.label || 'Camera',
    is1080p,
  };
}

// ─── Torch control ───────────────────────────────────────────────

export async function applyTorch(track: MediaStreamTrack, enabled: boolean): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [{ torch: enabled } as any] });
    return true;
  } catch {
    console.warn('Torch not supported or failed to apply');
    return false;
  }
}

// ─── Zoom control ────────────────────────────────────────────────

export async function applyZoom(track: MediaStreamTrack, level: number): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [{ zoom: level } as any] });
    return true;
  } catch {
    console.warn('Zoom not supported or failed to apply');
    return false;
  }
}

// ─── Stream cleanup ──────────────────────────────────────────────

export function stopAllTracks(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

// ─── LocalStorage persistence ────────────────────────────────────

export function saveSelectedCamera(deviceId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, deviceId);
  } catch {
    // Storage quota or privacy mode — silently ignore
  }
}

export function loadSelectedCamera(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearSelectedCamera(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore
  }
}
