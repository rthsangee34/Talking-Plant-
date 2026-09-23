import React from 'react';
import { Leaf } from 'lucide-react';

interface HealthRingProps {
  score: number;
  maxScore?: number;
}

export const HealthRing: React.FC<HealthRingProps> = ({
  score,
  maxScore = 100,
}) => {
  const size = 110;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, score / maxScore));
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(16, 185, 129, 0.15)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>

        {/* Animated progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#healthGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Center Score Typography */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
        <div className="text-2xl font-black text-emerald-950 tracking-tight leading-none">
          {score}
        </div>
        <div className="text-[10px] font-bold text-emerald-800/60 mt-0.5">
          / {maxScore}
        </div>
        <Leaf className="w-3 h-3 text-emerald-600 mt-0.5 fill-emerald-500/20" />
      </div>
    </div>
  );
};
