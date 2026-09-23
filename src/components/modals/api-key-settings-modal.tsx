import React, { useState } from 'react';
import {
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  X,
  Lock,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useApiUsageStore } from '../../stores/plant/api-usage-store';

export const ApiKeySettingsModal: React.FC = () => {
  const {
    apiKey,
    apiStatus,
    apiStatusMessage,
    isSettingsModalOpen,
    closeSettingsModal,
    openSetupModal,
    disconnectApiKey,
  } = useSettingsStore();

  const { totalCalls } = useApiUsageStore();

  if (!isSettingsModalOpen) return null;

  const maskedKey = apiKey
    ? apiKey.length > 8
      ? `••••••••••••••••••••${apiKey.slice(-4)}`
      : '••••••••••••••••'
    : 'No key configured in session';

  const getStatusBadge = () => {
    switch (apiStatus) {
      case 'AI_READY':
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400 animate-pulse',
          label: 'Gemini AI Ready',
        };
      case 'CONNECTING':
        return {
          bg: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
          dot: 'bg-teal-400 animate-spin',
          label: 'Connecting…',
        };
      case 'RATE_LIMITED':
        return {
          bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400',
          label: 'Rate Limited',
        };
      case 'INVALID_KEY':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400',
          label: 'Invalid Key',
        };
      case 'AI_OFFLINE':
        return {
          bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400',
          label: 'AI Offline',
        };
      case 'NO_KEY':
      default:
        return {
          bg: 'bg-slate-800 border-slate-700 text-slate-400',
          dot: 'bg-slate-500',
          label: 'No API Key',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-settings-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-950/70 border border-emerald-500/30 text-emerald-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 id="api-settings-title" className="text-sm font-bold text-white">
                Gemini AI Configuration
              </h3>
              <p className="text-[11px] text-slate-400">Active session credentials & status</p>
            </div>
          </div>

          <button
            onClick={closeSettingsModal}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          {/* Status Banner */}
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${badge.bg}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
              <span className="font-bold text-xs">{badge.label}</span>
            </div>
            <span className="text-[11px] font-mono opacity-80">{totalCalls} calls this session</span>
          </div>

          {/* Current Key Card (Masked) */}
          <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400" />
              Active Session Key
            </span>
            <div className="font-mono text-xs text-slate-300 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 select-none truncate">
              {maskedKey}
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              Stored safely in sessionStorage. Automatically cleared when you close this browser tab or disconnect.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={() => {
                closeSettingsModal();
                openSetupModal();
              }}
              className="flex-1 min-h-[40px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Change Key</span>
            </button>

            {apiKey && (
              <button
                onClick={disconnectApiKey}
                className="flex-1 min-h-[40px] px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Need a new Gemini key?</span>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
          >
            <span>Google AI Studio</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
