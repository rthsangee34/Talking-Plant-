import React from 'react';
import { Zap, Camera, Mic, BarChart3, ChevronRight } from 'lucide-react';
import { QuickActionItem } from '../types';

interface QuickActionsProps {
  onSelectAction: (actionId: string) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onSelectAction }) => {
  const actions: { id: string; title: string; description: string; icon: React.ElementType; color: string; badge?: string }[] = [
    {
      id: 'scan',
      title: 'Scan Plant',
      description: 'Analyze plant with AI',
      icon: Camera,
      color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    },
    {
      id: 'voice',
      title: 'Talk to Plant',
      description: 'Chat with Gemini Live',
      icon: Mic,
      color: 'bg-purple-500/15 text-purple-700 border-purple-500/30',
      badge: 'Live',
    }, 
    {
      id: 'telemetry',
      title: 'View Telemetry',
      description: 'Check sensor data',
      icon: BarChart3,
      color: 'bg-sky-500/15 text-sky-700 border-sky-500/30',
    },
  ];

  return (
    <div className="flex flex-col gap-2.5 liquid-glass rounded-3xl p-3.5 sm:p-4 border border-white/75 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-800">
          <Zap className="w-4 h-4" />
        </div>
        <h2 className="text-sm sm:text-base font-bold text-emerald-950 tracking-tight">
          Quick Actions
        </h2>
      </div>

      {/* Actions List */}
      <div className="flex flex-col gap-2">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              type="button"
              onClick={() => onSelectAction(act.id)}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-white/60 hover:bg-white/85 border border-white/75 shadow-xs transition-all duration-200 cursor-pointer group text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${act.color} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-950">
                      {act.title}
                    </span>
                    {act.badge && (
                      <span className="px-1.5 py-0.2 rounded-full bg-purple-500/15 text-purple-800 border border-purple-500/30 text-[9px] font-bold">
                        {act.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-emerald-900/60">
                    {act.description}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-emerald-800/40 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
