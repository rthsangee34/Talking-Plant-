import React, { useState } from 'react';
import { Activity, Zap, CheckCircle2, ChevronDown, RefreshCw, Server } from 'lucide-react';
import { useApiUsageStore } from '../../stores/plant/api-usage-store';

export const ApiUsageIndicator: React.FC = () => {
  const { totalCalls, visionCalls, liveSessions, protectionAlerts, lastCallAt, history, resetUsage } =
    useApiUsageStore();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Indicator Pill Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 rounded-full transition-all cursor-pointer text-xs font-semibold text-amber-900 shadow-xs"
        title="Click to view Gemini API usage breakdown"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
        <span>API: <strong className="font-mono">{totalCalls}</strong> calls</span>
        <ChevronDown className={`w-3 h-3 text-amber-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Breakdown Modal */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-4 text-slate-800 text-xs font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Gemini API Telemetry</span>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-2.5 h-2.5" /> Healthy
              </span>
            </div>

            {/* Metrics List */}
            <div className="space-y-2 font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Total API Requests:</span>
                <span className="font-bold text-slate-900">{totalCalls}</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 text-[11px]">
                <span className="text-slate-500">Multi-Plant Vision AI:</span>
                <span className="font-semibold text-emerald-700">{visionCalls} reqs</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 text-[11px]">
                <span className="text-slate-500">Gemini Live Voice:</span>
                <span className="font-semibold text-blue-700">{liveSessions} sessions</span>
              </div>
              <div className="flex items-center justify-between px-2 py-1 text-[11px]">
                <span className="text-slate-500">Protection Alerts:</span>
                <span className="font-semibold text-purple-700">{protectionAlerts} sent</span>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Last active: {lastCallAt || 'Just now'}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetUsage();
                }}
                className="text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
