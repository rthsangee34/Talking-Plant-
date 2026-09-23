import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sprout, Scan, AlertTriangle, RefreshCw } from 'lucide-react';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useObserverStore } from '../../stores/plant/observer-store';
import { captureCameraFrameUnmirrored } from '../../lib/plant/camera-capture';
import { saveSelectedCamera, loadSelectedCamera } from '../../lib/plant/camera-manager';

export const PlantVisionCard: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeDeviceIdRef = useRef<string | null>(null);

  const {
    isActive: isCameraActive,
    setActive: setCameraActive,
    selectedDeviceId,
    setSelectedDeviceId,
    setIsConnecting,
    setCameraConnectHandler,
    setLastSnapshot,
  } = useCameraStore();
  const { isAnalyzing } = useObserverStore();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasLiveVideo, setHasLiveVideo] = useState<boolean>(false);

  // Initialize or switch camera stream
  const startCamera = useCallback(
    async (deviceIdToUse?: string): Promise<{ success: boolean; error?: string }> => {
      setCameraError(null);
      setHasLiveVideo(false);
      setIsConnecting(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraActive(false);
        setIsConnecting(false);
        const errMsg = 'Camera API not supported on this browser.';
        setCameraError(errMsg);
        return { success: false, error: errMsg };
      }

      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const targetId = deviceIdToUse || useCameraStore.getState().selectedDeviceId || loadSelectedCamera();
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        };

        if (targetId) {
          videoConstraints.deviceId = { exact: targetId };
        } else {
          videoConstraints.facingMode = 'environment';
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current && videoRef.current.videoWidth > 0) {
              setHasLiveVideo(true);
              setCameraActive(true);
            }
          };
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        if (track) {
          const settings = track.getSettings?.();
          if (settings?.deviceId) {
            activeDeviceIdRef.current = settings.deviceId;
            setSelectedDeviceId(settings.deviceId);
            saveSelectedCamera(settings.deviceId);
          }
        }

        setCameraActive(true);
        setIsConnecting(false);
        setCameraError(null);
        return { success: true };
      } catch (err: any) {
        console.log('[PlantVision] Camera stream not available, activating fallback plant image:', err?.message);
        setCameraActive(false);
        setHasLiveVideo(false);
        setIsConnecting(false);
        const errMsg = err?.message || 'Camera disconnected';
        setCameraError(errMsg);
        return { success: false, error: errMsg };
      }
    },
    [setCameraActive, setSelectedDeviceId, setIsConnecting]
  );

  // Register startCamera as global camera connection handler
  useEffect(() => {
    setCameraConnectHandler(startCamera);
    return () => {
      setCameraConnectHandler(null);
    };
  }, [startCamera, setCameraConnectHandler]);

  // Initial connection on mount
  useEffect(() => {
    startCamera();

    // Listen for device changes (e.g. webcam plugged in)
    const onDeviceChange = () => {
      if (!useCameraStore.getState().isActive) {
        startCamera();
      }
    };

    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // Switch camera when selectedDeviceId changes
  useEffect(() => {
    if (selectedDeviceId && selectedDeviceId !== activeDeviceIdRef.current) {
      activeDeviceIdRef.current = selectedDeviceId;
      startCamera(selectedDeviceId);
    }
  }, [selectedDeviceId, startCamera]);

  // Periodically take snapshot of live video for AI analysis
  useEffect(() => {
    if (!isCameraActive || !videoRef.current) return;

    const interval = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const snapshot = await captureCameraFrameUnmirrored(videoRef.current);
          if (snapshot) {
            setLastSnapshot(snapshot);
          }
        } catch {}
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isCameraActive, setLastSnapshot]);

  return (
    <div className="w-full h-[195px] sm:h-[225px] lg:h-full lg:flex-1 lg:min-h-0 bg-white rounded-2xl sm:rounded-3xl p-2 sm:p-2.5 lg:p-3 border border-stone-200/80 shadow-xs relative flex flex-col overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          MAIN PLANT VISION VIEWPORT (LIVE VIDEO OR FALLBACK IMAGE)
          ───────────────────────────────────────────────────────────── */}
      <div className="relative w-full h-full flex-1 min-h-0 rounded-xl sm:rounded-2xl overflow-hidden bg-stone-900 shadow-inner flex items-center justify-center">
        
        {/* Base Potted Plant Image (Matching Screenshot 1: always present so no black screen ever shows) */}
        <img
          src="/fallback-plant.jpg"
          alt="Potted Plant Vision View"
          className="absolute inset-0 w-full h-full object-cover filter brightness-[1.02] contrast-[1.03]"
        />

        {/* Live Camera Stream Element (Overlays only when active and streaming frames) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            isCameraActive && hasLiveVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* ───────────────────────────────────────────────────────────
            TOP OVERLAY BADGES: "Plant Detected" & "LIVE"
            ─────────────────────────────────────────────────────────── */}
        <div className="absolute top-3 left-3 z-10">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/75 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-md">
            <Sprout className="w-3.5 h-3.5 text-emerald-400" />
            <span>Plant Detected</span>
          </div>
        </div>

        <div className="absolute top-3 right-3 z-10">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/75 backdrop-blur-md border border-white/20 text-emerald-400 text-xs font-bold shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE</span>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────
            CYAN RETICLE CORNER BRACKETS FRAMING THE PLANT
            ─────────────────────────────────────────────────────────── */}
        <div className="absolute inset-8 sm:inset-12 pointer-events-none z-10 flex flex-col justify-between">
          {/* Top row brackets */}
          <div className="flex justify-between w-full">
            <div className="w-6 sm:w-8 h-6 sm:h-8 border-t-[3px] border-l-[3px] border-cyan-400/90 rounded-tl-md" />
            <div className="w-6 sm:w-8 h-6 sm:h-8 border-t-[3px] border-r-[3px] border-cyan-400/90 rounded-tr-md" />
          </div>
          {/* Bottom row brackets */}
          <div className="flex justify-between w-full">
            <div className="w-6 sm:w-8 h-6 sm:h-8 border-b-[3px] border-l-[3px] border-cyan-400/90 rounded-bl-md" />
            <div className="w-6 sm:w-8 h-6 sm:h-8 border-b-[3px] border-r-[3px] border-cyan-400/90 rounded-br-md" />
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────
            BOTTOM SCANNING OVERLAY CARD
            ─────────────────────────────────────────────────────────── */}
        <div className="absolute bottom-3 inset-x-3 sm:inset-x-5 z-20">
          <div className="bg-emerald-950/80 backdrop-blur-md border border-white/15 rounded-xl px-3.5 py-2.5 sm:py-3 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xl">
            {/* Left: Scan Status & Progress Bar */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                <Scan className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-stone-100 tracking-tight">
                  {isAnalyzing ? 'Analyzing plant with Gemini AI...' : 'Scanning plant details...'}
                </span>
                {/* Progress bar */}
                <div className="w-36 sm:w-48 h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 ${
                      isAnalyzing
                        ? 'w-full animate-pulse'
                        : 'w-2/3 animate-[shimmer_2s_infinite]'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Right: Analyzing Dimensions */}
            <div className="text-[10px] sm:text-[11px] text-emerald-200/90 font-medium sm:text-right">
              Analyzing health • Light • Soil • Temperature
            </div>
          </div>
        </div>

        {/* Reconnect prompt if camera disconnected */}
        {!isCameraActive && cameraError && (
          <button
            type="button"
            onClick={startCamera}
            className="absolute top-12 right-3 z-20 px-2.5 py-1 rounded-md bg-black/60 hover:bg-black/80 text-[10px] text-stone-200 border border-white/20 flex items-center gap-1 transition-all cursor-pointer"
            title="Retry connecting camera"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Connect Cam</span>
          </button>
        )}
      </div>
    </div>
  );
};
