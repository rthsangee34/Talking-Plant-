import React from 'react';
import { History, Trash2, Calendar, FileText } from 'lucide-react';
import { useObserverStore } from '../../stores/plant/observer-store';

export const HistoryPanel: React.FC = () => {
  const { history, clearHistory } = useObserverStore();

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col gap-3 text-slate-100 shadow-md h-full min-h-0 overflow-y-auto pr-1 scrollbar-thin">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-tight text-white">Observation History Log</h2>
        </div>

        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Trash2 className="w-3 h-3" /> Clear History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-6 text-center text-slate-400 text-xs">
          No historical observations recorded in this session yet.
        </div>
      ) : (
        <div className="space-y-2.5 flex-1 min-h-[140px] overflow-y-auto pr-1">
          {history.map((obs) => (
            <div
              key={obs.id}
              className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg flex flex-col gap-2 text-xs"
            >
              <div className="flex items-center justify-between font-mono text-[11px] text-slate-400 border-b border-slate-800 pb-1.5">
                <span className="flex items-center gap-1.5 font-bold text-slate-200">
                  <Calendar className="w-3 h-3 text-emerald-400" /> {obs.timestamp}
                </span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold rounded text-[10px]">
                  {obs.healthStatus}
                </span>
              </div>

              <p className="text-slate-200 italic font-medium">"{obs.sensoryNote}"</p>

              <div className="text-[11px] text-slate-400 grid grid-cols-2 gap-2 bg-slate-900 p-2 rounded border border-slate-800">
                <div>Moisture: <span className="font-bold text-blue-400">{obs.moisture}%</span></div>
                <div>Light: <span className="font-bold text-amber-400">{obs.light}%</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
