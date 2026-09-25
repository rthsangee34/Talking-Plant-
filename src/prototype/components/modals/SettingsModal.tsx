import React, { useState } from 'react';
import { X, Settings, Cpu, Sparkles, Check, Key, Usb, Camera } from 'lucide-react';
import { Language } from '../../types';
import { useSettingsStore } from '../../../stores/plant/settings-store';
import { useSensorsStore } from '../../../stores/plant/sensors-store';
import { useCameraStore } from '../../../stores/plant/camera-store';
import { connectESP32, disconnectESP32 } from '../../../lib/plant/esp32-serial';

interface SettingsModalProps {
  isOpen: boolean;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  language,
  onLanguageChange,
  onClose,
}) => {
  const { apiKey, apiStatus, apiKeyConfigured, validateAndConnectKey } = useSettingsStore();
  const { isEspConnected, connectionStatus } = useSensorsStore();
  const { devices, selectedDeviceId, setSelectedDeviceId, streamInfo } = useCameraStore();

  const [inputKey, setInputKey] = useState(apiKey || '');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(!apiKey && !apiKeyConfigured);

  if (!isOpen) return null;

  const handleSaveKey = async () => {
    if (!inputKey.trim()) {
      setKeyError('API key cannot be empty');
      return;
    }
    setIsValidating(true);
    setKeyError(null);
    const res = await validateAndConnectKey(inputKey);
    setIsValidating(false);
    if (!res.success) {
      setKeyError(res.message);
    } else {
      setShowKeyInput(false);
    }
  };

  const isAiReady = apiStatus === 'AI_READY' || apiKeyConfigured;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/20 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md liquid-glass rounded-3xl p-5 border border-white/90 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/70 hover:bg-white/90 border border-white/80 flex items-center justify-center text-emerald-950 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-800">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-emerald-950">Settings</h3>
            <p className="text-xs text-emerald-800/70">Plant Intelligence & Hardware Preferences</p>
          </div>
        </div>

        {/* Language Options */}
        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/50 border border-white/70">
          <label className="text-xs font-bold text-emerald-950">Language / மொழி</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => onLanguageChange('mixed')}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                language === 'mixed'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white/70 text-emerald-950 border-white/80 hover:bg-white'
              }`}
            >
              <span>தமிழ் & EN (Bilingual)</span>
              {language === 'mixed' && <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onLanguageChange('ta')}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                language === 'ta'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white/70 text-emerald-950 border-white/80 hover:bg-white'
              }`}
            >
              <span>தமிழ் (Tamil)</span>
              {language === 'ta' && <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => onLanguageChange('en')}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white/70 text-emerald-950 border-white/80 hover:bg-white'
              }`}
            >
              <span>English (EN)</span>
              {language === 'en' && <Check className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Camera Resolution & Selection */}
        <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/50 border border-white/70 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
              <Camera className="w-3.5 h-3.5 text-emerald-700" />
              <span>Camera Resolution</span>
            </div>
            <span className="font-mono text-emerald-800 font-semibold">
              {streamInfo ? `${streamInfo.width} × ${streamInfo.height}` : '1920 × 1080 (FHD)'}
            </span>
          </div>
          {devices.length > 1 && (
            <div className="mt-1 pt-1 border-t border-black/5 flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-emerald-900/80">Active Device:</span>
              <select
                value={selectedDeviceId || ''}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-white/80 text-xs text-emerald-950 font-medium"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Gemini AI Engine Configuration */}
        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/50 border border-white/70 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-indigo-950 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Gemini AI Engine</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
              isAiReady
                ? 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-800 border-amber-500/30'
            }`}>
              {isAiReady ? 'Ready' : 'Setup Required'}
            </span>
          </div>

          {showKeyInput ? (
            <div className="flex flex-col gap-1.5 mt-1">
              <input
                type="password"
                placeholder="Enter Google Gemini API Key"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white border border-white/80 text-xs font-mono text-slate-900"
              />
              {keyError && <p className="text-[10px] text-rose-600 font-semibold">{keyError}</p>}
              <div className="flex justify-end gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => setShowKeyInput(false)}
                  className="px-2.5 py-1 rounded-xl bg-slate-200 text-slate-700 font-semibold text-[11px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isValidating}
                  onClick={handleSaveKey}
                  className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-semibold text-[11px]"
                >
                  {isValidating ? 'Validating…' : 'Save Key'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-emerald-900/80 pt-1">
              <span>{apiKey ? `Key configured: ••••${apiKey.slice(-4)}` : 'Key configured via environment'}</span>
              <button
                type="button"
                onClick={() => setShowKeyInput(true)}
                className="text-emerald-700 underline font-semibold cursor-pointer"
              >
                Change Key
              </button>
            </div>
          )}
        </div>

        {/* ESP32 WebSerial Connection Control */}
        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-white/50 border border-white/70 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
              <Cpu className="w-3.5 h-3.5 text-emerald-700" />
              <span>ESP32 WebSerial</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
              isEspConnected
                ? 'bg-emerald-500/15 text-emerald-800 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-800 border-amber-500/30'
            }`}>
              {isEspConnected ? 'Connected @ 115200' : connectionStatus}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-emerald-900/70">
              {isEspConnected ? 'Receiving real hardware sensor packets' : 'Connect via USB serial cable'}
            </span>
            <button
              type="button"
              onClick={isEspConnected ? disconnectESP32 : connectESP32}
              className={`px-3 py-1 rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-all active:scale-95 ${
                isEspConnected
                  ? 'bg-rose-600 text-white'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isEspConnected ? 'Disconnect' : 'Connect USB'}
            </button>
          </div>
        </div>

        {/* Close action */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl btn-liquid-emerald text-xs font-bold shadow-md cursor-pointer mt-1"
        >
          Done
        </button>
      </div>
    </div>
  );
};
