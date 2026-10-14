import React, { useState } from 'react';
import {
  X,
  Settings,
  Sparkles,
  Key,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Camera,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { connectESP32, disconnectESP32 } from '../../lib/plant/esp32-serial';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDisconnect?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onDisconnect,
}) => {
  const {
    apiKey,
    aiProvider,
    apiStatus,
    disconnectApiKey,
    validateAndConnectKey,
  } = useSettingsStore();

  const { isActive: isCameraActive } = useCameraStore();
  const { isEspConnected, connectionStatus } = useSensorsStore();

  const [isChangingKey, setIsChangingKey] = useState<boolean>(false);
  const [newKey, setNewKey] = useState<string>('');
  const [showNewKey, setShowNewKey] = useState<boolean>(false);
  const [keyValidationMsg, setKeyValidationMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState<boolean>(false);

  if (!isOpen) return null;

  // Mask key showing only last 4 characters
  const maskedKey = apiKey
    ? '••••••••••••••••••••••••' + (apiKey.length > 4 ? apiKey.slice(-4) : '')
    : 'Not Configured';

  const handleSaveNewKey = async () => {
    if (!newKey.trim()) return;
    setIsValidating(true);
    setKeyValidationMsg(null);

    const res = await validateAndConnectKey(newKey.trim());
    setIsValidating(false);

    if (res.success) {
      setKeyValidationMsg({ success: true, text: '✓ API Key updated successfully!' });
      setTimeout(() => {
        setIsChangingKey(false);
        setKeyValidationMsg(null);
        setNewKey('');
      }, 1000);
    } else {
      setKeyValidationMsg({ success: false, text: res.message });
    }
  };

  const handleConfirmDisconnect = () => {
    disconnectApiKey();
    setIsConfirmingDisconnect(false);
    onClose();
    if (onDisconnect) {
      onDisconnect();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-emerald-950/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-stone-900 tracking-tight font-['Outfit']">
              Settings & Configuration
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* AI Provider & API Key Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>AI Engine Configuration</span>
            </h3>

            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500 font-medium">AI Provider</span>
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Google Gemini
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-500 font-medium">API Status</span>
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              </div>

              <div>
                <span className="text-xs text-stone-500 font-medium block mb-1">Configured API Key</span>
                <div className="font-mono text-xs bg-white px-3 py-2 rounded-xl border border-stone-200 text-stone-700 tracking-wider select-all">
                  {maskedKey}
                </div>
              </div>

              {/* Change API Key field */}
              {isChangingKey ? (
                <div className="pt-2 border-t border-stone-200 space-y-2">
                  <label className="block text-xs font-semibold text-stone-800">New Gemini API Key</label>
                  <div className="relative">
                    <input
                      type={showNewKey ? 'text' : 'password'}
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="Paste new API key..."
                      className="w-full px-3 py-2 pr-10 text-xs font-mono rounded-xl border border-stone-300 focus:border-emerald-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewKey(!showNewKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 p-1"
                    >
                      {showNewKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {keyValidationMsg && (
                    <p
                      className={`text-xs ${
                        keyValidationMsg.success ? 'text-emerald-600 font-semibold' : 'text-rose-600'
                      }`}
                    >
                      {keyValidationMsg.text}
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveNewKey}
                      disabled={isValidating || !newKey.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {isValidating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      <span>Validate & Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingKey(false);
                        setKeyValidationMsg(null);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 pt-2 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setIsChangingKey(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Key className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Change API Key</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfirmingDisconnect(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect AI</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Hardware Status Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-emerald-700" />
              <span>Hardware & Sensor Interfaces</span>
            </h3>

            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80 space-y-3">
              {/* Camera */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-stone-600" />
                  <span className="text-xs font-semibold text-stone-800">Camera Vision</span>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isCameraActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {isCameraActive ? 'Connected (Live)' : 'Disconnected (Fallback Image)'}
                </span>
              </div>

              {/* Arduino */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-stone-600" />
                  <span className="text-xs font-semibold text-stone-800">Arduino / ESP32 Serial</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isEspConnected) {
                      disconnectESP32();
                    } else {
                      connectESP32();
                    }
                  }}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    isEspConnected
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-white border-stone-300 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {isEspConnected ? 'Connected (Click to Disconnect)' : 'Click to Connect USB'}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-100 bg-stone-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CONFIRMATION DIALOG: DISCONNECT AI
          ───────────────────────────────────────────────────────────── */}
      {isConfirmingDisconnect && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-stone-900">Disconnect AI?</h4>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Plant Talk AI features will stop working until a valid API key is configured again. You will be returned to the Setup page.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingDisconnect(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisconnect}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
