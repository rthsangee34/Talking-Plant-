import React, { useEffect, useState } from 'react';
import { MessageSquare, BellRing, BellOff, RefreshCcw, AlertCircle, Send, CheckCircle2, XCircle } from 'lucide-react';

interface ApiErrorDetails {
  code?: number;
  message: string;
  details?: string;
  recipient: string;
  wamid?: string;
}

interface WhatsAppStatus {
  configured: boolean;
  alertsEnabled: boolean;
  muted: boolean;
  ownerConfigured: boolean;
  lastOutboundMessageAt: string | null;
  lastOutboundMessageId: string | null;
  lastOutboundState: 'sending' | 'accepted_by_meta' | 'failed' | null;
  apiErrorDetails: ApiErrorDetails | null;
  mode: 'test' | 'production';
}

export const WhatsAppStatusPanel: React.FC = () => {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/whatsapp/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: WhatsAppStatus = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    try {
      setRetrying(true);
      const res = await fetch('/api/whatsapp/protection-alert', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const formatTime = (iso: string | null): string => {
    if (!iso) return 'Never';
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('en-LK', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'medium' }).format(d);
    } catch {
      return 'Unknown';
    }
  };

  if (loading && !status) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <MessageSquare className="w-4 h-4 animate-pulse" />
          <span className="text-xs font-semibold">Loading WhatsApp status...</span>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-rose-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-semibold">WhatsApp: {error}</span>
        </div>
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700">WhatsApp</div>
              <div className="text-[10px] text-slate-400">Not configured</div>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold">
            INACTIVE
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-green-200 bg-white p-4 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700">WhatsApp Integration</div>
            <div className="text-[10px] text-slate-500">Cloud API Connected ({status.mode})</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status.muted ? (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold flex items-center gap-1">
              <BellOff className="w-3 h-3" /> MUTED
            </span>
          ) : status.alertsEnabled ? (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-md text-[10px] font-bold flex items-center gap-1">
              <BellRing className="w-3 h-3" /> ALERTS ON
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold">
              ALERTS OFF
            </span>
          )}
          <button
            onClick={fetchStatus}
            className="p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCcw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex flex-col gap-2">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">Owner Configured:</span>
          <span className={status.ownerConfigured ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
            {status.ownerConfigured ? '✓ Yes' : '✗ No'}
          </span>
        </div>
        
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500">Last Outgoing Alert:</span>
          <span className="text-slate-700 font-medium">{formatTime(status.lastOutboundMessageAt)}</span>
        </div>

        {status.lastOutboundState ? (
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 mt-1">
            <span className="text-slate-500">Status:</span>
            <div className="flex items-center gap-1.5 font-medium">
              {status.lastOutboundState === 'sending' && (
                <span className="text-indigo-600 flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" /> Sending alert...
                </span>
              )}
              {status.lastOutboundState === 'accepted_by_meta' && (
                <span className="text-blue-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accepted by WhatsApp API — delivery not yet confirmed.
                </span>
              )}
              {status.lastOutboundState === 'failed' && (
                <span className="text-rose-600 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Alert failed
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 mt-1">
            <span className="text-slate-500">Status:</span>
            <span className="text-slate-500 font-medium">Idle - No alerts sent yet</span>
          </div>
        )}
      </div>

      {status.lastOutboundState === 'failed' && status.apiErrorDetails && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="p-3 bg-rose-50 border border-rose-100 rounded text-[10px] text-rose-700 break-words flex flex-col gap-1.5">
            {status.apiErrorDetails.code && (
              <div><strong>Error Code:</strong> {status.apiErrorDetails.code}</div>
            )}
            <div><strong>Message:</strong> {status.apiErrorDetails.message}</div>
            {status.apiErrorDetails.details && (
              <div><strong>Details:</strong> {status.apiErrorDetails.details}</div>
            )}
            <div><strong>Recipient:</strong> {status.apiErrorDetails.recipient}</div>
            {status.apiErrorDetails.wamid && (
              <div><strong>Message ID:</strong> {status.apiErrorDetails.wamid}</div>
            )}
          </div>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="self-end px-3 py-1 bg-slate-800 text-white rounded text-[10px] font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {retrying ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
            Retry Alert
          </button>
        </div>
      )}

      {status.lastOutboundMessageId && status.lastOutboundState !== 'failed' && (
        <div className="text-[9px] text-slate-400 font-mono self-end">
          ID: {status.lastOutboundMessageId.split('-')[0]}...
        </div>
      )}
    </div>
  );
};
