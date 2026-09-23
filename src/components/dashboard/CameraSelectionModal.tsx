import React, { useEffect, useState, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Check,
  Radio,
} from 'lucide-react';
import { useCameraStore } from '../../stores/plant/camera-store';
import { getDeviceLabel, enumerateVideoDevices, saveSelectedCamera } from '../../lib/plant/camera-manager';

interface CameraSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CameraSelectionModal: React.FC<CameraSelectionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    isActive: isCameraActive,
    selectedDeviceId,
    setSelectedDeviceId,
    devices: storeDevices,
    setDevices: setStoreDevices,
    cameraConnectHandler,
  } = useCameraStore();

  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(selectedDeviceId);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Scan and enumerate video devices, requesting permission if labels are masked
  const scanDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    setErrorMessage(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      setErrorMessage('Camera access is not supported by your browser.');
      setIsLoadingDevices(false);
      return;
    }

    try {
      let videoDevices = await enumerateVideoDevices();

      // If devices have empty labels, probe with a brief getUserMedia to unlock permissions and device labels
      const hasMaskedLabels =
        videoDevices.length > 0 && videoDevices.every((d) => !d.label || d.label.trim() === '');

      if (hasMaskedLabels || videoDevices.length === 0) {
        try {
          const probeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
          probeStream.getTracks().forEach((track) => track.stop());
          videoDevices = await enumerateVideoDevices();
        } catch (permErr: any) {
          if (
            permErr?.name === 'NotAllowedError' ||
            permErr?.name === 'PermissionDeniedError' ||
            permErr?.message?.toLowerCase().includes('denied') ||
            permErr?.message?.toLowerCase().includes('permission')
          ) {
            setErrorMessage(
              'Camera permission was denied. Please allow camera access in your browser settings and try again.'
            );
            setIsLoadingDevices(false);
            return;
          }
        }
      }

      setAvailableDevices(videoDevices);
      setStoreDevices(videoDevices);

      if (videoDevices.length === 0) {
        setErrorMessage('No camera detected. Please connect a camera and try again.');
        setSelectedId(null);
      } else {
        // Retain currently active device, or choose first available device
        const activeMatches =
          selectedDeviceId && videoDevices.some((d) => d.deviceId === selectedDeviceId);
        const nextSelected = activeMatches ? selectedDeviceId : videoDevices[0].deviceId;
        setSelectedId(nextSelected);
      }
    } catch (err: any) {
      console.error('[CameraModal] Error scanning devices:', err);
      setErrorMessage(err?.message || 'Failed to detect video devices.');
    } finally {
      setIsLoadingDevices(false);
    }
  }, [selectedDeviceId, setStoreDevices]);

  // Load devices whenever modal opens
  useEffect(() => {
    if (isOpen) {
      scanDevices();
    }
  }, [isOpen, scanDevices]);

  // Sync selectedId with selectedDeviceId when modal opens
  useEffect(() => {
    if (isOpen && selectedDeviceId) {
      setSelectedId(selectedDeviceId);
    }
  }, [isOpen, selectedDeviceId]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle camera selection and connection
  const handleConnect = async () => {
    if (!selectedId) return;

    setIsConnecting(true);
    setErrorMessage(null);

    try {
      // Use existing camera system via registered connection handler
      if (cameraConnectHandler) {
        const result = await cameraConnectHandler(selectedId);
        if (result.success) {
          setSelectedDeviceId(selectedId);
          saveSelectedCamera(selectedId);
          setIsConnecting(false);
          onClose();
          return;
        } else {
          setErrorMessage(result.error || 'Selected camera cannot be accessed.');
          setIsConnecting(false);
          return;
        }
      }

      // Fallback: Verify access directly if handler not yet attached
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedId } },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());

      setSelectedDeviceId(selectedId);
      saveSelectedCamera(selectedId);
      useCameraStore.getState().setActive(true);
      setIsConnecting(false);
      onClose();
    } catch (err: any) {
      console.error('[CameraModal] Connection error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Please allow access in browser settings.');
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        setErrorMessage('Selected camera is already in use by another application.');
      } else {
        setErrorMessage(err?.message || 'Selected camera cannot be accessed.');
      }
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-selection-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-emerald-950/60 backdrop-blur-sm animate-fade-in font-sans"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isConnecting) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col transition-all">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="camera-selection-title"
                className="text-base font-extrabold text-stone-900 tracking-tight font-['Outfit']"
              >
                Camera Connection
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Select video source for plant vision
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isConnecting}
            className="w-8 h-8 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-950 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoadingDevices ? (
            <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-stone-500">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
              <span className="text-xs font-semibold">Detecting video devices...</span>
            </div>
          ) : availableDevices.length === 0 ? (
            /* No Camera Found State */
            <div className="py-8 px-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-stone-200 flex items-center justify-center mx-auto text-stone-500">
                <CameraOff className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-800">
                  No camera detected. Please connect a camera and try again.
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Plug in a USB webcam or ensure camera permissions are allowed.
                </p>
              </div>
              <button
                type="button"
                onClick={scanDevices}
                className="px-4 py-2 rounded-xl bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
                <span>Scan Devices Again</span>
              </button>
            </div>
          ) : (
            /* Available Cameras List */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-500 font-semibold px-1">
                <span>Available Video Devices ({availableDevices.length})</span>
                <button
                  type="button"
                  onClick={scanDevices}
                  disabled={isLoadingDevices || isConnecting}
                  className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer text-xs font-bold"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5 scrollbar-thin">
                {availableDevices.map((device, index) => {
                  const isSelected = selectedId === device.deviceId;
                  const isCurrentlyActive =
                    isCameraActive && selectedDeviceId === device.deviceId;
                  const label = getDeviceLabel(device, index);

                  return (
                    <button
                      key={device.deviceId || `cam-${index}`}
                      type="button"
                      onClick={() => setSelectedId(device.deviceId)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs ring-1 ring-emerald-500/20'
                          : 'bg-stone-50 hover:bg-stone-100/90 border-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'bg-stone-200/90 text-stone-600'
                          }`}
                        >
                          <Camera className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold truncate ${
                                isSelected ? 'text-emerald-950' : 'text-stone-800'
                              }`}
                            >
                              {label}
                            </span>
                            {isCurrentlyActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                Active Stream
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-500 truncate mt-0.5">
                            {device.deviceId
                              ? `Device ID: ${device.deviceId.slice(0, 16)}...`
                              : 'Default Camera Device'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center justify-center">
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-stone-300" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 border-t border-stone-100 bg-stone-50/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isConnecting}
            className="px-4 py-2 rounded-xl bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting || availableDevices.length === 0 || !selectedId}
            className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting Camera...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>
                  {isCameraActive && selectedId === selectedDeviceId
                    ? 'Camera Connected'
                    : isCameraActive
                    ? 'Switch Camera'
                    : 'Connect Camera'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
