import React from 'react';
import { Sparkles, Clock } from 'lucide-react';
import { AIInsightData } from '../types';

interface AIInsightProps {
  insight: AIInsightData;
}

export const AIInsight: React.FC<AIInsightProps> = ({ insight }) => {
  return (
    <div className="w-full p-3 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-emerald-500/10 backdrop-blur-md border border-purple-500/20 shadow-xs flex flex-col gap-1.5 transition-all hover:border-purple-500/35">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-xs">
          <div className="w-5 h-5 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-600">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span>AI Insight</span>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-950/60">
          <Clock className="w-3 h-3 text-emerald-800/50" />
          <span>{insight.time}</span>
        </div>
      </div>

      <p className="text-xs font-medium text-emerald-950/90 leading-relaxed pl-6.5">
        &ldquo;{insight.text}&rdquo;
      </p>
    </div>
  );
};
