import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Camera, 
  Square, 
  Scan, 
  UploadCloud, 
  Maximize2, 
  Focus,
  CheckCircle2,
  ChevronDown,
  Hand,
  Volume2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useMonitoringStore } from '../../stores/plant/monitoring-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import {
  enumerateVideoDevices,
  selectPreferredDevice,
  buildConstraints,
  startStream,
  stopAllTracks,
  extractCapabilities,
  getDeviceLabel,
  saveSelectedCamera,
  loadSelectedCamera,
  detectPlatform,
} from '../../lib/plant/camera-manager';
import {
  useHandTracker,
  HAND_CONNECTIONS,
  type HandKeypoint,
  type TrackedFingertip,
} from '../../lib/plant/vision-tracker';
import {
  fetchGeminiProtectionAlert,
  speakTouchWarning,
  playGeminiAudio,
} from '../../lib/plant/warning-voice-system';
import { captureCameraFrameUnmirrored } from '../../lib/plant/camera-capture';
import plantHeroImage from '../assets/plant-hero.jpg';

interface CameraViewProps {
  onStopCamera: () => void;
  onCapture?: (dataUrl: string) => void;
  onScanPlant?: () => void;
  onUpload?: (file?: File) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onStopCamera,
  onCapture,
  onScanPlant,
  onUpload,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  const [cameraState, setCameraState] = useState<'requesting' | 'live' | 'fallback'>('requesting');
  const [deviceList, setDeviceList] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [cameraDropdownOpen, setCameraDropdownOpen] = useState(false);
  const [plantSpeech, setPlantSpeech] = useState<string | null>(null);
  const speechTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchCounterRef = useRef<number>(0);

  const {
    devices,
    selectedDeviceId,
    facingMode,
    isMobile,
    touchLanguage,
    setActive,
    setDevices,
    setSelectedDeviceId,
    setStreamInfo,
  } = useCameraStore();

  // Hand & touch detection callback
  const handleConfirmedTouch = useCallback(async (type: 'initial' | 'continuous-3s' | 'continuous-6s') => {
    touchCounterRef.current += 1;
    const currentCount = touchCounterRef.current;

    // Escalation logic:
    // 1st touch -> humorous response (level 1)
    // 2nd touch -> annoyed response (level 2)
    // 3rd touch -> angry response (level 3)
    // 4th/5th -> urgent response (level 4)
    // 6th+ -> desperate response (level 5)
    let escalationLevel = 1;
    if (currentCount === 2) escalationLevel = 2;
    else if (currentCount === 3) escalationLevel = 3;
    else if (currentCount === 4 || currentCount === 5) escalationLevel = 4;
    else if (currentCount >= 6) escalationLevel = 5;

    try {
      const alertResult = await fetchGeminiProtectionAlert({
        escalationLevel,
        touchType: type,
        touchCount: currentCount,
        language: touchLanguage,
        plantName: 'Golden Pothos',
      });

      const spokenText =
        touchLanguage === 'ta'
          ? alertResult.tamilText
          : touchLanguage === 'mixed'
          ? `${alertResult.tamilText} / ${alertResult.englishText}`
          : alertResult.englishText;

      const speechToPlay =
        touchLanguage === 'ta'
          ? alertResult.tamilText
          : touchLanguage === 'mixed'
          ? `${alertResult.tamilText} ${alertResult.englishText}`
          : alertResult.englishText;

      setPlantSpeech(spokenText);

      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = setTimeout(() => {
        setPlantSpeech(null);
      }, 7000);

      // Play native 24kHz audio or SpeechSynthesis fallback
      if (alertResult.audioBase64) {
        await playGeminiAudio(alertResult.audioBase64);
      } else {
        speakTouchWarning(speechToPlay, touchLanguage);
      }

      // Record in timeline
      try {
        useMonitoringStore.getState().addTimelineEvent({
          id: `touch-${Date.now()}`,
          timestamp: new Date().toISOString(),
          timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: escalationLevel >= 4 ? 'ATTENTION' : 'HEALTHY',
          title: `Touch Detected (${currentCount}x)`,
          description: spokenText,
          type: 'touch',
        });
      } catch {}
    } catch (err) {
      console.warn('[CAMERA-VIEW] Error handling touch speech response:', err);
    }
  }, [touchLanguage]);

  // Hook real hand & plant vision tracker to video
  const {
    targetLock,
    isHandInZone,
    handKeypoints,
    trackedFingertips,
    touchState,
  } = useHandTracker(videoRef, handleConfirmedTouch);

  // Initialize and start camera device
  const startCameraDevice = useCallback(async (deviceId: string | null) => {
    setCameraState('requesting');

    if (streamRef.current) {
      stopAllTracks(streamRef.current);
      streamRef.current = null;
    }

    try {
      const platform = detectPlatform();
      const constraints = buildConstraints(deviceId, facingMode, platform.isMobile);
      const res = await startStream(constraints);

      if (!isMountedRef.current) {
        if (res.stream) stopAllTracks(res.stream);
        return;
      }

      if (res.stream) {
        streamRef.current = res.stream;
        if (videoRef.current) {
          videoRef.current.srcObject = res.stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
          };
        }

        const videoTrack = res.stream.getVideoTracks()[0];
        if (videoTrack) {
          const caps = extractCapabilities(videoTrack);
          setStreamInfo({
            width: caps.resolution.width,
            height: caps.resolution.height,
            frameRate: caps.frameRate,
            label: caps.label,
            is1080p: caps.is1080p,
          });
        }

        setActive(true);
        setCameraState('live');
        if (deviceId) {
          saveSelectedCamera(deviceId);
          setCurrentDeviceId(deviceId);
          setSelectedDeviceId(deviceId);
        }
      } else {
        setCameraState('fallback');
      }
    } catch {
      if (isMountedRef.current) {
        setCameraState('fallback');
      }
    }
  }, [facingMode, setActive, setSelectedDeviceId, setStreamInfo]);

  // Mount effect: Enumerate cameras and auto-start
  useEffect(() => {
    isMountedRef.current = true;

    async function init() {
      const detected = await enumerateVideoDevices();
      if (!isMountedRef.current) return;

      setDeviceList(detected);
      setDevices(detected);

      const platform = detectPlatform();
      const stored = loadSelectedCamera();
      const preferredId = selectPreferredDevice(detected, platform.isMobile, stored);
      setCurrentDeviceId(preferredId);
      startCameraDevice(preferredId);
    }

    init();

    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        stopAllTracks(streamRef.current);
        streamRef.current = null;
      }
      setActive(false);
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    };
  }, [startCameraDevice, setActive, setDevices]);

  // Render hand skeleton & fingertip points over video on canvas overlay
  useEffect(() => {
    const canvas = canvasOverlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video || cameraState !== 'live') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (handKeypoints.length > 0) {
      // Draw skeleton lines
      for (const hand of handKeypoints) {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
        ctx.lineWidth = 2.5;

        for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
          const p1 = hand[startIdx];
          const p2 = hand[endIdx];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
            ctx.stroke();
          }
        }

        // Draw joints
        for (const kp of hand) {
          ctx.beginPath();
          ctx.arc(kp.x * w, kp.y * h, 4, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(52, 211, 153, 0.9)';
          ctx.fill();
        }
      }

      // Draw tracked fingertips with pulse rings
      for (const tip of trackedFingertips) {
        ctx.beginPath();
        ctx.arc(tip.x * w, tip.y * h, tip.isTouching ? 9 : 6, 0, 2 * Math.PI);
        ctx.fillStyle = tip.isTouching ? 'rgba(239, 68, 68, 0.95)' : 'rgba(59, 130, 246, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [handKeypoints, trackedFingertips, cameraState]);

  const handleStop = () => {
    if (streamRef.current) {
      stopAllTracks(streamRef.current);
      streamRef.current = null;
    }
    setActive(false);
    onStopCamera();
  };

  const handleSwitchCamera = (deviceId: string) => {
    setCameraDropdownOpen(false);
    setCurrentDeviceId(deviceId);
    startCameraDevice(deviceId);
  };

  const handleCaptureClick = () => {
    if (videoRef.current && cameraState === 'live') {
      const dataUrl = captureCameraFrameUnmirrored(videoRef.current);
      if (onCapture) onCapture(dataUrl);
    } else {
      if (onCapture) onCapture(plantHeroImage);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
  };

  // Determine Reticle Box dimensions from real plant tracking lock
  const bounds = targetLock.bounds;
  const reticleStyle: React.CSSProperties = targetLock.isLocked
    ? {
        left: `${Math.round(bounds.xMin * 100)}%`,
        top: `${Math.round(bounds.yMin * 100)}%`,
        width: `${Math.round((bounds.xMax - bounds.xMin) * 100)}%`,
        height: `${Math.round((bounds.yMax - bounds.yMin) * 100)}%`,
        position: 'absolute',
      }
    : {};

  const isTouchingNow = touchState === 'TOUCH_CONFIRMED' || touchState === 'WARNING_TRIGGERED';

  return (
    <div className="flex flex-col gap-3 h-full animate-in fade-in zoom-in-95 duration-400">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Live Camera Hero Card */}
      <div className="flex-1 min-h-0 flex flex-col liquid-glass rounded-3xl p-3 sm:p-4 border border-white/80 shadow-md relative overflow-hidden">
        {/* Card Header with LIVE indicator & Camera Switcher */}
        <div className="flex items-center justify-between gap-2 mb-2.5 px-1 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-800">
              <Camera className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-emerald-950 tracking-tight">
              Live Plant Camera
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Camera Selector (If multiple cameras detected) */}
            {deviceList.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCameraDropdownOpen(!cameraDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 hover:bg-white/90 backdrop-blur-md border border-white/80 text-[11px] font-semibold text-emerald-950 shadow-xs transition-all cursor-pointer"
                  title="Switch camera device"
                >
                  <span className="truncate max-w-[110px]">
                    {deviceList.find((d) => d.deviceId === currentDeviceId)?.label || 'Camera'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-emerald-700 shrink-0" />
                </button>

                {cameraDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-48 rounded-2xl liquid-glass border border-white/80 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                    {deviceList.map((dev, idx) => (
                      <button
                        key={dev.deviceId || idx}
                        type="button"
                        onClick={() => handleSwitchCamera(dev.deviceId)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-left transition-all cursor-pointer ${
                          dev.deviceId === currentDeviceId
                            ? 'bg-emerald-500/15 text-emerald-950 font-bold'
                            : 'text-slate-800 hover:bg-white/60'
                        }`}
                      >
                        <span className="truncate">{getDeviceLabel(dev, idx)}</span>
                        {dev.deviceId === currentDeviceId && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* LIVE Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-[11px] font-bold text-rose-700">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              <span>LIVE</span>
              <span className="text-rose-900/30">|</span>
              <span className="font-mono text-emerald-900/80">30 FPS</span>
            </div>
          </div>
        </div>

        {/* Video / Camera Feed Viewport */}
        <div className="relative flex-1 min-h-0 w-full rounded-2xl overflow-hidden shadow-inner border border-white/60 bg-slate-950">
          {cameraState === 'live' ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Transparent Canvas Overlay for Hand Skeleton & Reticle */}
              <canvas
                ref={canvasOverlayRef}
                width={640}
                height={480}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />
            </>
          ) : (
            /* Fallback Realistic Optical Camera Feed with Simulated Scan Layer */
            <div className="relative w-full h-full">
              <img
                src={plantHeroImage}
                alt="Optical Live Stream"
                className="w-full h-full object-cover filter contrast-105"
              />
              <div className="absolute inset-0 bg-emerald-950/20 mix-blend-overlay" />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,52,34,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />
            </div>
          )}

          {/* Plant Speech Bubble Banner when the plant responds */}
          {plantSpeech && (
            <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-center animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="max-w-md px-4 py-2.5 rounded-2xl bg-emerald-950/90 backdrop-blur-md border border-emerald-400/50 text-white shadow-xl flex items-center gap-2.5">
                <Volume2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
                <p className="text-xs font-semibold leading-snug tracking-tight text-emerald-100">
                  {plantSpeech}
                </p>
              </div>
            </div>
          )}

          {/* Plant Target Bounding Box / Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none p-4 flex items-center justify-center">
            {targetLock.isLocked ? (
              <div
                style={reticleStyle}
                className="rounded-2xl border-2 border-emerald-400/90 animate-target-reticle flex flex-col justify-between p-2 shadow-lg transition-all duration-300"
              >
                <div className="flex justify-between items-start">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-300" />
                  <span className="px-2 py-0.5 rounded-md bg-emerald-950/85 backdrop-blur-md text-[10px] font-mono text-emerald-300 font-bold border border-emerald-500/30">
                    PLANT LOCKED • {targetLock.stabilityScore}%
                  </span>
                  <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-300" />
                </div>
                <div className="flex justify-between items-end">
                  <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-300" />
                  <span className="text-[10px] font-mono text-emerald-200/80 drop-shadow-sm">
                    {targetLock.label || 'Target Plant'}
                  </span>
                  <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-300" />
                </div>
              </div>
            ) : (
              <div className="relative w-52 sm:w-64 h-52 sm:h-64 rounded-2xl border-2 border-emerald-400/80 animate-target-reticle flex flex-col justify-between p-2">
                <div className="flex justify-between items-start">
                  <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-300" />
                  <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 backdrop-blur-md text-[10px] font-mono text-emerald-300 font-bold border border-emerald-500/30">
                    ACQUIRING PLANT…
                  </span>
                  <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-300" />
                </div>
                <div className="flex items-center justify-center">
                  <Focus className="w-8 h-8 text-emerald-400/50 animate-pulse" />
                </div>
                <div className="flex justify-between items-end">
                  <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-300" />
                  <span className="text-[10px] font-mono text-emerald-200/80 drop-shadow-sm">
                    Vision Pipeline Active
                  </span>
                  <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-300" />
                </div>
              </div>
            )}
          </div>

          {/* Bottom-Left: Live Touch Status Badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border text-xs font-semibold shadow-md z-20 transition-all duration-200">
            {isTouchingNow ? (
              <div className="flex items-center gap-1.5 text-rose-300 bg-rose-950/90 border border-rose-500/50 px-2.5 py-0.5 rounded-full animate-bounce">
                <Hand className="w-3.5 h-3.5 text-rose-400" />
                <span>TOUCH DETECTED</span>
              </div>
            ) : isHandInZone ? (
              <div className="flex items-center gap-1.5 text-amber-200 bg-amber-950/85 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Hand Approaching</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-200 bg-emerald-950/80 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Camera Active • Plant Protected</span>
              </div>
            )}
          </div>

          {/* Bottom-Right Maximize Button */}
          <button
            type="button"
            onClick={() => {
              if (videoRef.current?.requestFullscreen) {
                videoRef.current.requestFullscreen();
              }
            }}
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white/90 flex items-center justify-center transition-all cursor-pointer active:scale-95 z-20"
            title="Full screen"
            aria-label="Full screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Camera Controls Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 shrink-0">
          <button
            type="button"
            onClick={handleCaptureClick}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl liquid-glass-interactive text-emerald-950 text-xs font-bold cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-700" />
            <span>Capture</span>
          </button>

          <button
            type="button"
            onClick={handleStop}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl bg-rose-600/90 hover:bg-rose-700 text-white border border-rose-400/40 text-xs font-bold cursor-pointer shadow-md transition-all active:scale-95"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop Camera</span>
          </button>

          <button
            type="button"
            onClick={onScanPlant}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl liquid-glass-interactive text-emerald-950 text-xs font-bold cursor-pointer"
          >
            <Scan className="w-4 h-4 text-emerald-700" />
            <span>Scan Plant</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl liquid-glass-interactive text-emerald-950 text-xs font-bold cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-emerald-700" />
            <span>Upload</span>
          </button>
        </div>
      </div>
    </div>
  );
};
