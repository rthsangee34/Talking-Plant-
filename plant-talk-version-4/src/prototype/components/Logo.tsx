import React from 'react';
import plantTalkLogo from '../assets/plant-talk.png';

interface LogoProps {
  compact?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ compact = false }) => {
  return (
    <div className="flex items-center gap-3 select-none">
      {/* Official Plant Talk Logo with 1:1 Aspect Ratio */}
      <div 
        className={`relative flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-md border border-white/80 shadow-sm p-1 transition-all duration-300 ${
          compact ? 'w-10 h-10' : 'w-12 h-12 sm:w-14 sm:h-14'
        }`}
      >
        <img
          src={plantTalkLogo}
          alt="Plant Talk Logo — Vivekananda College of Technology Smart Agriculture Project"
          className="w-full h-full object-contain"
          loading="eager"
        />
        {/* Subtle glass reflection highlight */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/30 to-white/60 pointer-events-none" />
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-base sm:text-lg font-extrabold tracking-tight text-emerald-950 leading-tight">
            Plant Talk
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-600/20 text-emerald-800 text-[10px] font-bold tracking-wider">
            v4.0
          </span>
        </div>
        <span className="text-[11px] sm:text-xs font-medium text-emerald-800/75 tracking-normal">
          Plant Intelligence
        </span>
      </div>
    </div>
  );
};
