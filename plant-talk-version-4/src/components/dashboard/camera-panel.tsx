import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  Layers,
  SwitchCamera,
  FlashlightOff,
  Flashlight,
  ZoomIn,
  Wifi,
  WifiOff,
  ShieldAlert,
  Monitor,
  RotateCcw,
  CheckCircle2,
  ImageIcon,
  Volume2,
  Globe,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useExperienceStore } from '../../stores/plant/experience-store';
import { useConversationStore } from '../../stores/plant/conversation-store';
import { useObserverStore } from '../../stores/plant/observer-store';
import { useMonitoringStore } from '../../stores/plant/monitoring-store';
import { sensorService } from '../../services/sensorService';
import {
  useHandTracker,
  HAND_CONNECTIONS,
  type TargetPlantLock,
  type TrackedFingertip,
  type HandKeypoint,
  type DetectedPlant,
  type TouchState,
} from '../../lib/plant/vision-tracker';
import {
  getRandomWarningPhrase,
  speakTouchWarning,
  playGeminiAudio,
  fetchGeminiProtectionAlert,
} from '../../lib/plant/warning-voice-system';
import {
  captureCameraFrameUnmirrored,
  captureMultiFrames,
  createDefaultPlantSampleDataUrl,
  createFrameVariationsFromSnapshot,
  validateFrameQuality,
  selectBestFrame,
} from '../../lib/plant/camera-capture';
import {
  detectPlatform,
  checkSecureContext,
  enumerateVideoDevices,
  getDeviceLabel,
  selectPreferredDevice,
  buildConstraints,
  startStream,
  extractCapabilities,
  applyTorch,
  applyZoom,
  stopAllTracks,
  saveSelectedCamera,
  loadSelectedCamera,
  clearSelectedCamera,
} from '../../lib/plant/camera-manager';
import { executePlantAnalysis } from '../../lib/plant/run-analysis';

interface CameraPanelProps {
  onCapture?: (dataUrl: string) => void;
  onMultiCapture?: (dataUrls: string[]) => void;
}

// ─── Startup Capture Configuration ────────────────────────────────

const STARTUP_CAPTURE_CONFIG = {
  requiredFrames: 3,
  intervalMs: 1000,
  stabilizationDelayMs: 1500,
  microscopeStabilizationDelayMs: 2500,
  maximumSequenceDurationMs: 10000,
};

// ─── Camera Component ─────────────────────────────────────────────

export const CameraPanel: React.FC<CameraPanelProps> = ({ onCapture, onMultiCapture }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const protectionUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isHandlingTouchRef = useRef(false);
  const lastWarningTextRef = useRef<string | null>(null);
  const warningBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Startup capture refs (React Strict Mode safe) ──────────
  const startupCaptureTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startupSequenceCompletedRef = useRef(false);
  const startupCaptureStartedRef = useRef(false);
  const startupCaptureCountRef = useRef(0);
  const startupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCapturingMulti, setIsCapturingMulti] = useState(false);
  const [isAnalyzingStartup, setIsAnalyzingStartup] = useState(false);

  const { showToast } = useExperienceStore();

  // Global audio & speech synthesis unlock on user interaction
  useEffect(() => {
    const unlock = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const {
    isActive,
    devices,
    selectedDeviceId,
    lastSnapshot,
    streamInfo,
    startupCaptureStatus,
    capturedStartupFrames,
    facingMode,
    isMobile,
    torchEnabled,
    torchSupported,
    zoomLevel,
    zoomRange,
    disconnectedMessage,
    insecureContext,
    setActive,
    setDevices,
    setSelectedDeviceId,
    setLastSnapshot,
    setLastMultiSnapshots,
    setStreamInfo,
    setStartupCaptureStatus,
    setCapturedStartupFrames,
    setFacingMode,
    setIsMobile,
    setTorchEnabled,
    setTorchSupported,
    setZoomLevel,
    setZoomRange,
    setDisconnectedMessage,
    setInsecureContext,
    setCameraCapabilities,
    protectionEnabled,
    interactionCount,
    incrementInteraction,
    setProtectionEnabled,
    resetInteractionCount,
    touchLanguage,
    setTouchLanguage,
    debugModeEnabled,
    setDebugModeEnabled,
    selectedTargetPlantId,
    setSelectedTargetPlantId,
    activeWarningText,
    setActiveWarningText,
    touchTelemetry,
  } = useCameraStore();

  const { addMessage } = useConversationStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size exceeds maximum limit of 10MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLastSnapshot(reader.result);
        setLastMultiSnapshots([reader.result]);
        showToast('Plant photo uploaded successfully!', 'success');
        executePlantAnalysis(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirmedTouch = useCallback(async (type: 'initial' | 'continuous-3s' | 'continuous-6s' = 'initial', isSimulated = false) => {
    if (isHandlingTouchRef.current) return;
    isHandlingTouchRef.current = true;

    const {
      interactionCount: currentCount,
      touchLanguage: currentLang,
      setActiveWarningText,
    } = useCameraStore.getState();

    const count = isSimulated ? 5 : (currentCount || 1);
    const plantName = useObserverStore.getState().lastAnalysis?.plants?.[0]?.commonName || 'Houseplant';

    // Immediate visual feedback so user sees hand was detected and Gemini is preparing speech
    setActiveWarningText(
      currentLang === 'ta'
        ? '🌿 செடி பேசுகிறது (Gemini AI குரல்)...'
        : '🌿 Ferny is speaking (Gemini AI Voice)...'
    );

    // 24/7 Monitoring Integration: Provide real-time health context and log timeline event
    const healthState = useMonitoringStore.getState().healthScore;
    let contextSummary: string | undefined = undefined;
    if (healthState.status === 'CRITICAL' || healthState.moistureScore <= 25) {
      contextSummary = 'Critical alert: Soil moisture is under 20%. The plant is extremely thirsty and dehydrated. Complain about being touched before being watered!';
    } else if (healthState.status === 'ATTENTION') {
      contextSummary = 'Soil moisture is low. Tell human to check the soil and water before touching.';
    }

    sensorService.recordTimelineEvent(
      `Touch Detected (Stage ${count})`,
      `Touch defense triggered (${type})`,
      healthState.status,
      'touch'
    );

    try {
      // 1. Fetch progressive warning generated by Gemini AI with angry + humorous personality
      const alert = await fetchGeminiProtectionAlert({
        escalationLevel: count,
        touchType: type,
        touchCount: count,
        language: currentLang,
        plantName,
        contextSummary,
        previousMessage: lastWarningTextRef.current || undefined,
      });

      let phraseToSpeak = currentLang === 'ta' ? alert.tamilText : alert.englishText;

      // If in critical condition and using offline fallback, make phrase moisture-aware
      if (alert.source === 'fallback' && healthState.status === 'CRITICAL') {
        phraseToSpeak = currentLang === 'ta'
          ? 'ஐயோ! என் மண்ணில் கொஞ்சம் கூட ஈரம் இல்ல, தண்ணி ஊத்தாம என்ன தொடாதீங்க! 😤🌱'
          : 'Ouch! Don\'t poke me right now, my soil is bone dry! Go get some water first! 😤🌱';
      }

      lastWarningTextRef.current = phraseToSpeak;

      // 2. Speak Gemini alert message with tailored plant personality voice
      if (alert.audioBase64) {
        console.log('[Ferny Protection] 🌿 Playing Gemini authentic Sri Lankan Tamil / English AI voice');
        await playGeminiAudio(alert.audioBase64);
      } else {
        console.log('[Ferny Protection] 🔊 Fallback to browser SpeechSynthesis');
        speakTouchWarning(phraseToSpeak, currentLang);
      }
      setActiveWarningText(phraseToSpeak);

      // 3. Add bilingual alert to conversation feed
      const sourceBadge = alert.source === 'gemini' ? 'Gemini AI Voice' : 'Botanical Alert';
      const typeLabel = type === 'continuous-3s'
        ? '3s Continuous Hold'
        : type === 'continuous-6s'
        ? '6s Prolonged Hold'
        : `Touch #${count} Warning`;

      const promptWarning = `🚨 [பாதுகாப்பு எச்சரிக்கை / ${typeLabel}] (${sourceBadge})\n${alert.tamilText}\n\n👉 ${alert.englishText}`;
      addMessage({
        id: `protect-${Date.now()}`,
        sender: 'plant',
        text: promptWarning,
        timestamp: new Intl.DateTimeFormat('en-LK', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date()),
        language: currentLang,
      });
    } catch (err) {
      console.error('[Ferny Protection] Alert generation error:', err);
    } finally {
      // Release in-flight flag immediately so the next distinct touch is never locked out
      isHandlingTouchRef.current = false;
      if (warningBannerTimeoutRef.current) {
        clearTimeout(warningBannerTimeoutRef.current);
      }
      warningBannerTimeoutRef.current = setTimeout(() => {
        setActiveWarningText(null);
      }, 4000);
    }
  }, [addMessage]);

  const {
    isModelLoading,
    modelError,
    isHandInZone,
    targetLock,
    targetPlant,
    candidates,
    trackedFingertips,
    handKeypoints,
    minFingertipDistance,
    touchState,
    debugRefs,
  } = useHandTracker(videoRef, handleConfirmedTouch);

  const handleSimulateSingleTouch = async () => {
    incrementInteraction();
    await handleConfirmedTouch('initial', false);
  };

  // ─── Helpers ──────────────────────────────────────────────────

  const isFrontCamera = facingMode === 'user';

  const isMicroscopeCamera = useCallback((): boolean => {
    const label = streamInfo?.label?.toLowerCase() || '';
    return /microscope|uvc|usb2\.0/i.test(label);
  }, [streamInfo]);

  // ─── Startup capture timer cleanup ────────────────────────────

  const clearStartupCaptureTimer = useCallback(() => {
    if (startupCaptureTimerRef.current) {
      clearInterval(startupCaptureTimerRef.current);
      startupCaptureTimerRef.current = null;
    }
    if (startupTimeoutRef.current) {
      clearTimeout(startupTimeoutRef.current);
      startupTimeoutRef.current = null;
    }
  }, []);

  const resetStartupCaptureState = useCallback(() => {
    clearStartupCaptureTimer();
    startupCaptureCountRef.current = 0;
    startupSequenceCompletedRef.current = false;
    startupCaptureStartedRef.current = false;
    setCapturedStartupFrames([]);
    setStartupCaptureStatus('idle');
  }, [clearStartupCaptureTimer, setCapturedStartupFrames, setStartupCaptureStatus]);

  // ─── Startup capture sequence ─────────────────────────────────

  const startStartupCaptureSequence = useCallback(() => {
    // Triple guard: ref-based protection against React Strict Mode
    if (startupSequenceCompletedRef.current) return;
    if (startupCaptureStartedRef.current) return;
    if (startupCaptureTimerRef.current) return;
    if (!videoRef.current) return;

    startupCaptureStartedRef.current = true;
    startupCaptureCountRef.current = 0;
    setCapturedStartupFrames([]);
    setStartupCaptureStatus('capturing');

    // Maximum sequence timeout — stop after 10s no matter what
    startupTimeoutRef.current = setTimeout(() => {
      if (!startupSequenceCompletedRef.current) {
        clearStartupCaptureTimer();
        startupSequenceCompletedRef.current = true;

        const framesCollected = useCameraStore.getState().capturedStartupFrames;
        if (framesCollected.length > 0) {
          setStartupCaptureStatus('completed');
          showToast(`Captured ${framesCollected.length} of 3 frames (timeout reached).`, 'warning');
          // Analyze whatever we got
          analyzeStartupFrames(framesCollected);
        } else {
          setStartupCaptureStatus('error');
          showToast('Startup capture timed out — no valid frames captured.', 'error');
        }
      }
    }, STARTUP_CAPTURE_CONFIG.maximumSequenceDurationMs);

    // Capture one frame per second
    startupCaptureTimerRef.current = setInterval(async () => {
      // Already completed? Stop immediately.
      if (startupCaptureCountRef.current >= STARTUP_CAPTURE_CONFIG.requiredFrames) {
        clearStartupCaptureTimer();
        startupSequenceCompletedRef.current = true;
        setStartupCaptureStatus('completed');
        return;
      }

      if (!videoRef.current || !useCameraStore.getState().isActive) return;

      const currentFacing = useCameraStore.getState().facingMode;
      const frame = await captureCameraFrameUnmirrored(
        videoRef.current,
        currentFacing === 'user',
        /microscope|uvc|usb2\.0/i.test(useCameraStore.getState().streamInfo?.label || '')
      );

      if (!frame) return; // Retry next interval

      // Validate quality
      const quality = await validateFrameQuality(frame);
      if (!quality.valid) {
        console.warn(`Startup frame rejected: ${quality.issues.join(', ')} (score: ${quality.score})`);
        return; // Retry next interval — don't increment count
      }

      startupCaptureCountRef.current += 1;
      const count = startupCaptureCountRef.current;

      // Update frames immutably via store
      const prev = useCameraStore.getState().capturedStartupFrames;
      const next = [...prev, frame];
      setCapturedStartupFrames(next);
      setLastSnapshot(frame);

      showToast(`Captured startup frame ${count} of ${STARTUP_CAPTURE_CONFIG.requiredFrames}`, 'info');

      // Check if done
      if (count >= STARTUP_CAPTURE_CONFIG.requiredFrames) {
        clearStartupCaptureTimer();
        startupSequenceCompletedRef.current = true;
        setStartupCaptureStatus('completed');

        // Analyze the 3-frame set
        analyzeStartupFrames(next);
      }
    }, STARTUP_CAPTURE_CONFIG.intervalMs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearStartupCaptureTimer, setCapturedStartupFrames, setLastSnapshot, setStartupCaptureStatus, showToast]);

  // ─── Analyze startup frames (single API call) ─────────────────

  const analyzeStartupFrames = useCallback(
    async (frames: string[]) => {
      if (frames.length === 0) return;

      setIsAnalyzingStartup(true);
      try {
        const best = await selectBestFrame(frames);
        setLastSnapshot(best);
        setLastMultiSnapshots(frames);
        onCapture?.(best);
        onMultiCapture?.(frames);

        showToast(`Analyzing ${frames.length} startup frames for plant identification...`, 'info');
        await executePlantAnalysis(frames.length > 1, best, frames);
      } catch (err) {
        console.error('Startup frame analysis error:', err);
        showToast('Analysis of startup frames failed.', 'error');
      } finally {
        setIsAnalyzingStartup(false);
      }
    },
    [onCapture, onMultiCapture, setLastMultiSnapshots, setLastSnapshot, showToast]
  );

  // ─── Begin startup capture after stabilization ────────────────

  const beginStartupCaptureAfterStabilization = useCallback(async () => {
    if (!videoRef.current) return;

    setStartupCaptureStatus('waiting-for-camera');

    // Wait for video readyState >= 2 and valid dimensions
    await new Promise<void>((resolve) => {
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        const v = videoRef.current;
        if ((v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) || attempts >= 40) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });

    // Stabilization delay for focus/exposure
    const stabDelay = isMicroscopeCamera()
      ? STARTUP_CAPTURE_CONFIG.microscopeStabilizationDelayMs
      : STARTUP_CAPTURE_CONFIG.stabilizationDelayMs;
    await new Promise((r) => setTimeout(r, stabDelay));

    // Only start if not already completed or started (React Strict Mode guard)
    if (!startupSequenceCompletedRef.current && !startupCaptureStartedRef.current) {
      startStartupCaptureSequence();
    }
  }, [isMicroscopeCamera, setStartupCaptureStatus, startStartupCaptureSequence]);

  // ─── Auto-scan every 5 minutes ────────────────────────────────

  useEffect(() => {
    if (!isActive) return;

    // Refresh frames and trigger analysis every 5 minutes
    const interval = setInterval(() => {
      if (useCameraStore.getState().isActive && !isCapturing && !isCapturingMulti) {
        handleMultiScan();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isCapturing, isCapturingMulti]);

  // ─── Init: Platform, secure context, initial enumeration ──────

  useEffect(() => {
    const platform = detectPlatform();
    setIsMobile(platform.isMobile);

    if (platform.isMobile) {
      setFacingMode('environment');
    }

    if (!checkSecureContext()) {
      setInsecureContext(true);
    }

    // Initial device enumeration (before permission, labels may be empty)
    enumerateVideoDevices().then((videoDevices) => {
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !useCameraStore.getState().selectedDeviceId) {
        const storedId = loadSelectedCamera();
        const preferred = selectPreferredDevice(videoDevices, platform.isMobile, storedId);
        if (preferred) setSelectedDeviceId(preferred);
      }
    });
  }, [setDevices, setFacingMode, setIsMobile, setInsecureContext, setSelectedDeviceId]);

  // ─── Device change listener ───────────────────────────────────

  useEffect(() => {
    if (!navigator.mediaDevices) return;

    const handleDeviceChange = async () => {
      const videoDevices = await enumerateVideoDevices();
      setDevices(videoDevices);

      const currentId = useCameraStore.getState().selectedDeviceId;
      if (currentId) {
        const stillAvailable = videoDevices.some((d) => d.deviceId === currentId);
        if (!stillAvailable) {
          // Selected camera was disconnected
          resetStartupCaptureState();

          if (streamRef.current) {
            stopAllTracks(streamRef.current);
            streamRef.current = null;
          }
          if (videoRef.current) videoRef.current.srcObject = null;

          setActive(false);
          setStreamInfo(null);
          setTorchSupported(false);
          setTorchEnabled(false);
          setZoomRange(null);
          setCameraCapabilities(null);
          clearSelectedCamera();

          setDisconnectedMessage('Selected camera was disconnected.');

          // Auto-select another camera
          if (videoDevices.length > 0) {
            const platform = detectPlatform();
            const next = selectPreferredDevice(videoDevices, platform.isMobile, null);
            if (next) setSelectedDeviceId(next);
          } else {
            setSelectedDeviceId(null);
          }
        }
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [
    resetStartupCaptureState,
    setActive,
    setCameraCapabilities,
    setDevices,
    setDisconnectedMessage,
    setSelectedDeviceId,
    setStreamInfo,
    setTorchEnabled,
    setTorchSupported,
    setZoomRange,
  ]);

  // ─── Cleanup on unmount ───────────────────────────────────────

  useEffect(() => {
    return () => {
      clearStartupCaptureTimer();
      if (streamRef.current) {
        stopAllTracks(streamRef.current);
        streamRef.current = null;
      }
    };
  }, [clearStartupCaptureTimer]);

  // ─── Start camera ─────────────────────────────────────────────

  const startCamera = async (overrideDeviceId?: string, overrideFacing?: 'user' | 'environment' | null) => {
    setIsInitializing(true);
    setPermissionError(null);
    setDisconnectedMessage(null);

    // Reset startup sequence for this new camera session
    resetStartupCaptureState();

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionError('Camera access is not supported in this browser environment. You can upload plant photos directly.');
      setIsInitializing(false);
      return;
    }

    // Stop existing stream
    if (streamRef.current) {
      stopAllTracks(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;

    const deviceId = overrideDeviceId || useCameraStore.getState().selectedDeviceId;
    const facing = overrideFacing !== undefined ? overrideFacing : useCameraStore.getState().facingMode;

    const constraints = buildConstraints(deviceId, facing, isMobile);
    const result = await startStream(constraints);

    if (!result.stream) {
      setPermissionError(result.error || 'Camera permission denied or camera device is busy.');
      setActive(false);
      setStreamInfo(null);
      setIsInitializing(false);
      return;
    }

    streamRef.current = result.stream;

    if (videoRef.current) {
      videoRef.current.srcObject = result.stream;
      try {
        await videoRef.current.play();
      } catch (playErr) {
        console.warn('Video play error:', playErr);
      }
    }

    // Wait until video has valid dimensions before setting active
    if (videoRef.current) {
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const check = setInterval(() => {
          attempts++;
          const v = videoRef.current;
          if ((v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) || attempts >= 40) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    // Extract capabilities
    const track = result.stream.getVideoTracks()[0];
    if (track) {
      const caps = extractCapabilities(track);
      
      if (import.meta.env.DEV) {
        console.log('[DEBUG] Selected device ID:', track.getSettings()?.deviceId);
        console.log('[DEBUG] Video dimensions:', caps.resolution.width, 'x', caps.resolution.height);
      }

      setStreamInfo({
        width: caps.resolution.width,
        height: caps.resolution.height,
        frameRate: caps.frameRate,
        label: caps.label,
        is1080p: caps.is1080p,
      });
      setTorchSupported(caps.torchSupported);
      setZoomRange(caps.zoomRange);
      setZoomLevel(caps.zoomRange?.min || 1);
      setCameraCapabilities({
        focusModes: caps.focusModes,
        exposureModes: caps.exposureModes,
      });
      setTorchEnabled(false);
    }

    setActive(true);

    // Re-enumerate now that permission is granted (get real labels)
    try {
      const videoDevices = await enumerateVideoDevices();
      setDevices(videoDevices);

      const activeDeviceId = track?.getSettings()?.deviceId;
      if (activeDeviceId) {
        setSelectedDeviceId(activeDeviceId);
        saveSelectedCamera(activeDeviceId);
      }
    } catch {
      // Non-critical
    }

    setIsInitializing(false);

    // Extract capabilities (already done above, keep structure intact)
    // Begin the one-time startup capture sequence
    beginStartupCaptureAfterStabilization();
  };

  // ─── Stop camera ──────────────────────────────────────────────

  const stopCamera = () => {
    resetStartupCaptureState();

    if (streamRef.current) {
      stopAllTracks(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;

    setActive(false);
    setStreamInfo(null);
    setTorchSupported(false);
    setTorchEnabled(false);
    setZoomRange(null);
    setCameraCapabilities(null);
  };

  // ─── Switch camera (without reload) ───────────────────────────

  const handleCameraSwitch = async (newDeviceId: string) => {
    resetStartupCaptureState();
    setSelectedDeviceId(newDeviceId);
    saveSelectedCamera(newDeviceId);
    setDisconnectedMessage(null);

    if (isActive) {
      await startCamera(newDeviceId);
    }
  };

  // ─── Toggle front / rear ──────────────────────────────────────

  const handleToggleFacing = async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    resetStartupCaptureState();

    if (isActive) {
      await startCamera(undefined, newFacing);
    }
  };

  // ─── Retake startup frames ────────────────────────────────────

  const handleRetakeStartupFrames = async () => {
    resetStartupCaptureState();
    if (isActive && videoRef.current) {
      beginStartupCaptureAfterStabilization();
    }
  };

  // ─── Refresh cameras ─────────────────────────────────────────

  const handleRefreshCameras = async () => {
    const videoDevices = await enumerateVideoDevices();
    setDevices(videoDevices);
    setDisconnectedMessage(null);

    const currentId = useCameraStore.getState().selectedDeviceId;
    if (currentId && !videoDevices.some((d) => d.deviceId === currentId)) {
      clearSelectedCamera();
      if (videoDevices.length > 0) {
        const preferred = selectPreferredDevice(videoDevices, isMobile, null);
        if (preferred) setSelectedDeviceId(preferred);
      }
    }

    showToast(`Found ${videoDevices.length} camera${videoDevices.length !== 1 ? 's' : ''}`, 'info');
  };

  // ─── Manual capture ───────────────────────────────────────────

  const handleTakeSnapshot = async () => {
    setIsCapturing(true);
    try {
      let frame: string | null = null;
      if (videoRef.current && isActive) {
        frame = await captureCameraFrameUnmirrored(videoRef.current, isFrontCamera, isMicroscopeCamera());
      }

      if (!frame) {
        frame = lastSnapshot;
      }
      
      if (!frame) {
        showToast('No usable picture was captured.', 'error');
        setIsCapturing(false);
        return;
      }

      setLastSnapshot(frame);
      setLastMultiSnapshots([frame]);
      onCapture?.(frame);
      showToast('Frame captured! Running botanical vision analysis...', 'info');

      await executePlantAnalysis(false, frame, [frame]);
    } catch (err) {
      console.error('Capture frame error:', err);
      showToast('Failed to capture frame.', 'error');
    } finally {
      setIsCapturing(false);
    }
  };

  // ─── Multi-frame scan (manual) ────────────────────────────────

  const handleMultiScan = async () => {
    setIsCapturingMulti(true);
    try {
      showToast('Scanning 3 sequential frames for high-precision flower & species analysis...', 'info');
      let frames: string[] = [];
      if (videoRef.current && isActive) {
        frames = await captureMultiFrames(videoRef.current, 3, 1000);
      }

      if (!frames || frames.length === 0) {
        if (lastSnapshot) {
          frames = await createFrameVariationsFromSnapshot(lastSnapshot, 3);
        }
      }

      if (!frames || frames.length === 0) {
        showToast('No usable picture was captured.', 'error');
        setIsCapturingMulti(false);
        return;
      }

      const latestFrame = frames[frames.length - 1];
      setLastSnapshot(latestFrame);
      setLastMultiSnapshots(frames);
      onMultiCapture?.(frames);
      onCapture?.(latestFrame);

      showToast(`Captured ${frames.length} frames! Analyzing species & flowers...`, 'info');
      await executePlantAnalysis(true, latestFrame, frames);
    } catch (err) {
      console.error('Multi-frame scan error:', err);
      showToast('Multi-frame scan failed.', 'error');
    } finally {
      setIsCapturingMulti(false);
    }
  };

  // ─── Torch toggle ─────────────────────────────────────────────

  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    const newState = !torchEnabled;
    const success = await applyTorch(track, newState);
    if (success) {
      setTorchEnabled(newState);
    } else {
      showToast('Flashlight not supported on this camera.', 'warning');
    }
  };

  // ─── Zoom change ──────────────────────────────────────────────

  const handleZoomChange = async (level: number) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    const success = await applyZoom(track, level);
    if (success) {
      setZoomLevel(level);
    }
  };

  // ─── Render helpers ───────────────────────────────────────────

  const statusLabel = startupCaptureStatus === 'capturing'
    ? `Capturing frame ${Math.min(startupCaptureCountRef.current + 1, 3)} of 3…`
    : startupCaptureStatus === 'waiting-for-camera'
    ? 'Preparing camera…'
    : startupCaptureStatus === 'completed'
    ? 'Startup capture completed'
    : startupCaptureStatus === 'error'
    ? 'Capture failed'
    : isActive
    ? 'Ready'
    : 'Idle';

  const cameraConnectionLabel = isActive
    ? disconnectedMessage
      ? 'Disconnected'
      : 'Connected'
    : 'Idle';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm shadow-md flex flex-col gap-2.5 h-full min-h-0 overflow-y-auto pr-1 scrollbar-thin">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-emerald-100">Plant Vision Camera</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {streamInfo && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
              {streamInfo.width}×{streamInfo.height} {streamInfo.is1080p ? '1080p FHD' : 'HD'}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isActive
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            {isActive ? 'Camera Active' : 'Camera Idle'}
          </span>
          {protectionEnabled && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                interactionCount >= 5 ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                interactionCount >= 4 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Protection: {interactionCount}/5
            </span>
          )}
        </div>
      </div>

      {/* ── Camera status info bar ──────────────────────────── */}
      {isActive && streamInfo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-lg px-3 py-2">
            <span className="text-emerald-500/70 font-medium block">Camera</span>
            <span className="text-emerald-200 font-semibold truncate block">{streamInfo.label || 'Unknown'}</span>
          </div>
          <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-lg px-3 py-2">
            <span className="text-emerald-500/70 font-medium block">Resolution</span>
            <span className="text-emerald-200 font-semibold">{streamInfo.width} × {streamInfo.height}</span>
          </div>
          <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-lg px-3 py-2">
            <span className="text-emerald-500/70 font-medium block">Capture</span>
            <span className="text-emerald-200 font-semibold">{statusLabel}</span>
          </div>
          <div className="bg-emerald-950/40 border border-emerald-800/30 rounded-lg px-3 py-2">
            <span className="text-emerald-500/70 font-medium block">Status</span>
            <span className="text-emerald-200 font-semibold flex items-center gap-1.5">
              {isActive && !disconnectedMessage ? (
                <Wifi className="w-3 h-3 text-emerald-400" />
              ) : (
                <WifiOff className="w-3 h-3 text-rose-400" />
              )}
              {cameraConnectionLabel}
            </span>
          </div>
        </div>
      )}

      {/* ── Startup capture progress ────────────────────────── */}
      {isActive && (startupCaptureStatus === 'waiting-for-camera' || startupCaptureStatus === 'capturing') && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-emerald-200 font-medium">
              {startupCaptureStatus === 'waiting-for-camera'
                ? 'Preparing camera…'
                : `Capturing frame ${Math.min(startupCaptureCountRef.current + 1, 3)} of 3…`}
            </p>
            <div className="flex gap-1.5 mt-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    n <= capturedStartupFrames.length
                      ? 'bg-emerald-400'
                      : n === capturedStartupFrames.length + 1 && startupCaptureStatus === 'capturing'
                      ? 'bg-emerald-400/40 animate-pulse'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Startup capture completed banner ─────────────────── */}
      {startupCaptureStatus === 'completed' && capturedStartupFrames.length > 0 && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-emerald-200 font-medium">
              {capturedStartupFrames.length} startup frames captured
              {isAnalyzingStartup ? ' — analyzing…' : ''}
            </p>
            <p className="text-[11px] text-emerald-500/60 mt-0.5">
              Automatic capture stopped • Camera preview is still active
            </p>
          </div>
        </div>
      )}

      {/* ── Startup capture error banner ──────────────────────── */}
      {startupCaptureStatus === 'error' && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>Startup capture failed — no valid frames could be captured. Try "Retake Startup Frames" or capture manually.</span>
        </div>
      )}

      {/* ── Insecure context warning ────────────────────────── */}
      {insecureContext && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-xl text-sm">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Camera access requires HTTPS or localhost.</span>
        </div>
      )}

      {/* ── Disconnected camera warning ─────────────────────── */}
      {disconnectedMessage && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{disconnectedMessage}</span>
        </div>
      )}

      {/* ── Permission error ────────────────────────────────── */}
      {permissionError && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* ── Video Preview ───────────────────────────────────── */}
      <div className={`relative aspect-video w-full max-h-[30vh] min-h-[160px] bg-slate-950 rounded-xl overflow-hidden border flex items-center justify-center group ${
        protectionEnabled && interactionCount >= 5 ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.7)] animate-pulse' :
        protectionEnabled && interactionCount >= 4 ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' :
        'border-emerald-900/40'
      }`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 absolute'} ${
            protectionEnabled && interactionCount === 1 ? 'animate-bounce' : ''
          }`}
          style={isFrontCamera && isActive ? { transform: 'scaleX(-1)' } : undefined}
        />

        {protectionEnabled && isActive && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* ── Real-time Status Panel (HUD Overlay) ── */}
            <div className="absolute top-2 inset-x-2 z-30 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-xl border border-emerald-500/40 text-[11px] font-mono shadow-xl text-slate-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">TARGET:</span>
                  <span className={targetLock.isLocked ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                    {targetLock.isLocked ? 'LOCKED 🔒' : 'ACQUIRING 🔄'}
                  </span>
                  <span className="text-slate-400 text-[10px]">({targetLock.label})</span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">HAND:</span>
                  <span className={trackedFingertips.length > 0 ? "text-amber-300 font-bold" : "text-slate-400"}>
                    {trackedFingertips.length > 0 ? 'DETECTED 🖐️' : 'NONE'}
                  </span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">DIST:</span>
                  <span className={minFingertipDistance === 0 ? "text-rose-400 font-bold animate-pulse" : minFingertipDistance < 0.1 ? "text-amber-300 font-bold" : "text-slate-300"}>
                    {minFingertipDistance === 0 ? '0px' : `${Math.round(minFingertipDistance * 640)}px`}
                  </span>
                </span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">TOUCH:</span>
                  <span className={isHandInZone ? "text-rose-400 font-bold animate-pulse" : touchState === 'TOUCH_CANDIDATE' ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                    {isHandInZone ? 'YES 🔴' : touchState === 'TOUCH_CANDIDATE' ? `CANDIDATE 🟡` : 'NO 🟢'}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 border border-emerald-500/50 font-bold text-emerald-300">
                  {touchState}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {touchTelemetry?.fps || 22} FPS
                </span>
              </div>
            </div>

            {/* ── Spatial Tracking Overlays (mirrored with video if front camera) ── */}
            {debugModeEnabled && (
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={isFrontCamera ? { transform: 'scaleX(-1)' } : undefined}
              >
                {/* ── Plant Segmentation Mask Polygon (Visual Debug) ── */}
                {targetPlant?.contourPoints && targetPlant.contourPoints.length > 2 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    <polygon
                      points={targetPlant.contourPoints.map((p) => `${p.x * 100}%,${p.y * 100}%`).join(' ')}
                      fill="rgba(16, 185, 129, 0.2)"
                      stroke="#34d399"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  </svg>
                )}

                {/* ── Dynamic Target Plant Lock Reticle ── */}
                <div
                  className={`absolute transition-all duration-150 border-2 rounded-xl pointer-events-none z-15 ${
                    interactionCount >= 5
                      ? 'border-red-500 bg-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.7)] animate-pulse'
                      : interactionCount >= 4
                      ? 'border-yellow-400 bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.6)]'
                      : isHandInZone
                      ? 'border-amber-400 bg-amber-400/25 shadow-[0_0_25px_rgba(251,191,36,0.7)] animate-pulse'
                      : 'border-emerald-400/70 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  }`}
                  style={{
                    left: `${Math.max(1, targetLock.bounds.xMin * 100)}%`,
                    top: `${Math.max(1, targetLock.bounds.yMin * 100)}%`,
                    width: `${Math.min(98, (targetLock.bounds.xMax - targetLock.bounds.xMin) * 100)}%`,
                    height: `${Math.min(98, (targetLock.bounds.yMax - targetLock.bounds.yMin) * 100)}%`,
                  }}
                >
                  {/* Corner brackets */}
                  <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-300" />
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-300" />
                  <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-300" />
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-300" />

                  {/* Header Badge */}
                  <div
                    className="absolute -top-6 left-1 flex items-center gap-1.5 px-2 py-0.5 rounded-t-md bg-black/85 backdrop-blur-md border border-b-0 border-emerald-500/40 text-[10px] font-mono whitespace-nowrap shadow-md"
                    style={isFrontCamera ? { transform: 'scaleX(-1)' } : undefined}
                  >
                    <ShieldAlert className={`w-3 h-3 ${
                      interactionCount >= 5 ? 'text-red-400 animate-bounce' :
                      isHandInZone ? 'text-amber-400 animate-bounce' :
                      'text-emerald-400'
                    }`} />
                    <span className={`font-bold uppercase tracking-wider ${
                      interactionCount >= 5 ? 'text-red-400' :
                      isHandInZone ? 'text-amber-300 font-extrabold' :
                      'text-emerald-300'
                    }`}>
                      {isHandInZone
                        ? '⚠️ HAND TOUCHING PLANT!'
                        : targetLock.isLocked
                        ? `🔒 TARGET LOCKED: ${targetLock.label}`
                        : `🌱 ACQUIRING PLANT TARGET (${targetLock.stabilityScore}%)`}
                    </span>
                  </div>

                  {/* Target Status / Distance Badge */}
                  <div
                    className="absolute -top-6 right-1 px-2 py-0.5 rounded-t-md bg-black/85 backdrop-blur-md border border-b-0 border-emerald-500/40 text-[10px] font-mono text-emerald-300 whitespace-nowrap shadow-md"
                    style={isFrontCamera ? { transform: 'scaleX(-1)' } : undefined}
                  >
                    {minFingertipDistance === 0 ? (
                      <span className="text-rose-400 font-bold animate-pulse">CONTACT 0px</span>
                    ) : minFingertipDistance < 0.25 ? (
                      <span className="text-amber-300 font-bold">APPROACHING ({Math.round(minFingertipDistance * 640)}px)</span>
                    ) : (
                      <span className="text-emerald-400">STABILITY {targetLock.stabilityScore}%</span>
                    )}
                  </div>
                </div>

                {/* ── Hand Skeleton Lines (Visual Debug) ── */}
                {handKeypoints.map((hand, hIdx) => (
                  <svg key={`hand-skel-${hIdx}`} className="absolute inset-0 w-full h-full pointer-events-none z-15">
                    {HAND_CONNECTIONS.map(([p1, p2], cIdx) => {
                      const pt1 = hand[p1];
                      const pt2 = hand[p2];
                      if (!pt1 || !pt2) return null;
                      const isClose = minFingertipDistance < 0.1;
                      const isTouching = isHandInZone;
                      const strokeColor = isTouching ? '#f43f5e' : isClose ? '#f59e0b' : '#06b6d4';
                      return (
                        <line
                          key={`conn-${hIdx}-${cIdx}`}
                          x1={`${pt1.x * 100}%`}
                          y1={`${pt1.y * 100}%`}
                          x2={`${pt2.x * 100}%`}
                          y2={`${pt2.y * 100}%`}
                          stroke={strokeColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeOpacity="0.85"
                        />
                      );
                    })}
                  </svg>
                ))}

                {/* ── Tracked Fingertips Markers ── */}
                {trackedFingertips.map((tip, idx) => {
                  const isTouching = tip.isTouching;
                  const isClose = tip.distance < 0.08;
                  const dotColor = isTouching
                    ? 'bg-rose-500 border-white shadow-[0_0_12px_rgba(244,63,94,1)] animate-ping'
                    : isClose
                    ? 'bg-amber-400 border-black shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                    : 'bg-cyan-400 border-black shadow-[0_0_6px_rgba(6,182,212,0.8)]';

                  return (
                    <div
                      key={`${tip.name}-${idx}`}
                      className="absolute pointer-events-none transition-all duration-75 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 z-20"
                      style={{ left: `${tip.x * 100}%`, top: `${tip.y * 100}%` }}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 ${dotColor}`} />
                      <span
                        className={`text-[9px] font-mono px-1 py-0.5 rounded bg-black/85 backdrop-blur-xs font-bold leading-none ${
                          isTouching ? 'text-rose-300 border border-rose-500/60' : isClose ? 'text-amber-300 border border-amber-500/50' : 'text-cyan-300 border border-cyan-500/40'
                        }`}
                        style={isFrontCamera ? { transform: 'scaleX(-1)' } : undefined}
                      >
                        {isTouching ? `🚨 ${tip.name}` : `🖐️ ${tip.name}`}
                      </span>
                    </div>
                  );
                })}

                {/* ── Dynamic Distance Line between Closest Fingertip and Target Plant ── */}
                {trackedFingertips.length > 0 && minFingertipDistance > 0 && minFingertipDistance < 0.35 && (
                  (() => {
                    const closest = trackedFingertips.reduce((best, tip) => tip.distance < best.distance ? tip : best, trackedFingertips[0]);
                    const plantCenter = targetPlant ? targetPlant.center : { x: (targetLock.bounds.xMin + targetLock.bounds.xMax) / 2, y: (targetLock.bounds.yMin + targetLock.bounds.yMax) / 2 };
                    const midX = (closest.x + plantCenter.x) / 2;
                    const midY = (closest.y + plantCenter.y) / 2;
                    return (
                      <>
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-15">
                          <line
                            x1={`${closest.x * 100}%`}
                            y1={`${closest.y * 100}%`}
                            x2={`${plantCenter.x * 100}%`}
                            y2={`${plantCenter.y * 100}%`}
                            stroke="#f59e0b"
                            strokeWidth="2"
                            strokeDasharray="4 3"
                            strokeOpacity="0.9"
                          />
                        </svg>
                        <div
                          className="absolute pointer-events-none z-25 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-black/90 border border-amber-400 text-amber-300 text-[10px] font-mono font-bold whitespace-nowrap shadow-md"
                          style={{
                            left: `${midX * 100}%`,
                            top: `${midY * 100}%`,
                            transform: isFrontCamera ? 'translate(-50%, -50%) scaleX(-1)' : 'translate(-50%, -50%)',
                          }}
                        >
                          Distance: {Math.round(minFingertipDistance * 640)}px
                        </div>
                      </>
                    );
                  })()
                )}
              </div>
            )}

          </div>
        )}

        {!isActive && lastSnapshot && (
          <img src={lastSnapshot} alt="Last Plant Snapshot" className="w-full h-full object-cover" />
        )}

        {!isActive && !lastSnapshot && (
          <div className="flex flex-col items-center gap-3 text-emerald-500/60 p-6 text-center">
            <Camera className="w-12 h-12 stroke-[1.5]" />
            <p className="text-sm font-medium">Camera preview inactive. Click "Start Camera" or press "Capture Frame" / "Scan 3 Frames" below.</p>
          </div>
        )}

        {/* Front camera mirror indicator */}
        {isFrontCamera && isActive && (
          <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[10px] text-slate-300 font-medium">
            Mirrored preview (AI receives correct orientation)
          </div>
        )}
      </div>

      {/* ── Startup frame thumbnails ─────────────────────────── */}
      {capturedStartupFrames.length > 0 && (
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-emerald-500/60 shrink-0" />
          <span className="text-[10px] text-emerald-500/60 font-medium uppercase shrink-0">Startup Frames</span>
          <div className="flex gap-2 flex-1 overflow-x-auto">
            {capturedStartupFrames.map((frame, idx) => (
              <div
                key={idx}
                className="w-16 h-12 rounded-lg overflow-hidden border border-emerald-800/30 shrink-0 bg-slate-900"
              >
                <img
                  src={frame}
                  alt={`Startup frame ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Camera Selector ─────────────────────────────────── */}
      {devices.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Monitor className="w-4 h-4 text-emerald-500/70" />
          <select
            value={selectedDeviceId || ''}
            onChange={(e) => handleCameraSwitch(e.target.value)}
            className="flex-1 min-w-0 bg-slate-900 border border-emerald-800/40 text-emerald-200 text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-500 truncate"
          >
            {devices.map((device, idx) => (
              <option key={device.deviceId || idx} value={device.deviceId}>
                {getDeviceLabel(device, idx)}
              </option>
            ))}
          </select>
          <button
            onClick={handleRefreshCameras}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl border border-slate-700 transition-all active:scale-95 cursor-pointer"
            title="Refresh cameras"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      )}

      {/* ── Primary Controls ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {!isActive ? (
          <button
            onClick={() => startCamera()}
            disabled={isInitializing || insecureContext}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isInitializing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            Start Camera
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg transition-all border border-slate-700 active:scale-95 cursor-pointer"
          >
            <EyeOff className="w-3.5 h-3.5" />
            Stop Camera
          </button>
        )}

        <button
          onClick={handleTakeSnapshot}
          disabled={isCapturing || isCapturingMulti}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isCapturing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          Capture Frame
        </button>

        <button
          onClick={handleMultiScan}
          disabled={isCapturing || isCapturingMulti}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isCapturingMulti ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
          Scan 3 Frames
        </button>

        {/* Integrated Upload Photo Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg transition-all border border-slate-700 active:scale-95 cursor-pointer"
          title="Upload plant photo (PNG, JPG, WebP)"
        >
          <Upload className="w-3.5 h-3.5 text-emerald-400" />
          Upload Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Switch front/rear (mobile) */}
        {isMobile && isActive && (
          <button
            onClick={handleToggleFacing}
            className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
            Switch Camera
          </button>
        )}

        {/* Retake startup frames */}
        {isActive && (startupCaptureStatus === 'completed' || startupCaptureStatus === 'error') && (
          <button
            onClick={handleRetakeStartupFrames}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-xs rounded-lg transition-all border active:scale-95 cursor-pointer ${
              startupCaptureStatus === 'error'
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retake Frames
          </button>
        )}
      </div>

      {/* ── Protection Controls ───────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className={`w-4 h-4 ${protectionEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-xs font-semibold text-slate-200">Space Protection</span>
            {isModelLoading && <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin ml-1" />}
          </div>

          <button
            onClick={() => setProtectionEnabled(!protectionEnabled)}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              protectionEnabled
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
            }`}
          >
            {protectionEnabled ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        {protectionEnabled && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
            {/* Visual Debug Overlay toggle */}
            <button
              onClick={() => setDebugModeEnabled(!debugModeEnabled)}
              className={`min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95 cursor-pointer ${
                debugModeEnabled
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {debugModeEnabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Debug: {debugModeEnabled ? 'ON' : 'OFF'}
            </button>

            {/* Language toggle */}
            <button
              onClick={() => setTouchLanguage(touchLanguage === 'en' ? 'ta' : 'en')}
              className="min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all active:scale-95 cursor-pointer"
            >
              <Globe className="w-3 h-3 text-emerald-400" />
              {touchLanguage === 'en' ? 'EN 🇬🇧' : 'தமிழ் 🇱🇰'}
            </button>

            {/* Reset interaction counter */}
            <button
              onClick={resetInteractionCount}
              className="min-h-[32px] px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95 cursor-pointer"
            >
              Reset ({interactionCount}/5)
            </button>

            {/* Simulate Single Touch */}
            <button
              onClick={handleSimulateSingleTouch}
              className="min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all active:scale-95 cursor-pointer"
              title="Test touch detection voice and animation without camera"
            >
              <Volume2 className="w-3 h-3" />
              Simulate Touch
            </button>
          </div>
        )}
      </div>
      


      {/* ── Advanced Controls (Torch & Zoom) ────────────────── */}
      {isActive && (torchSupported || zoomRange) && (
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-emerald-900/20">
          {/* Torch / Flashlight */}
          {torchSupported && (
            <button
              onClick={handleToggleTorch}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 font-medium text-xs rounded-xl transition-all active:scale-95 cursor-pointer ${
                torchEnabled
                  ? 'bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-900/30'
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }`}
            >
              {torchEnabled ? (
                <>
                  <FlashlightOff className="w-3.5 h-3.5" /> Turn Flash Off
                </>
              ) : (
                <>
                  <Flashlight className="w-3.5 h-3.5" /> Turn Flash On
                </>
              )}
            </button>
          )}

          {/* Zoom Slider */}
          {zoomRange && (
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <ZoomIn className="w-3.5 h-3.5 text-emerald-500/70 shrink-0" />
              <span className="text-[10px] text-emerald-500/60 font-medium uppercase shrink-0">Zoom</span>
              <input
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={zoomRange.step}
                value={zoomLevel}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
              <span className="text-xs text-emerald-300 font-semibold tabular-nums min-w-[32px] text-right">
                {zoomLevel.toFixed(1)}×
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
