import React from 'react';
import { Home, Eye, BarChart2, Mic, History, ShieldCheck, Leaf } from 'lucide-react';
import { NavSection, Language } from '../types';

interface BottomNavigationProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  language: Language;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeSection,
  onSelectSection,
  language,
}) => {
  const navItems = [
    { id: 'overview' as NavSection, label: 'Overview', icon: Home },
    { id: 'vision' as NavSection, label: 'Vision', icon: Eye },
    { id: 'telemetry' as NavSection, label: 'Telemetry', icon: BarChart2 },
    { id: 'voice' as NavSection, label: 'Voice', icon: Mic },
    { id: 'history' as NavSection, label: 'History', icon: History },
    { id: 'diagnostics' as NavSection, label: 'Diagnostics', icon: ShieldCheck },
  ];

  return (
    <div className="w-full shrink-0 flex flex-col md:flex-row items-center justify-between gap-3 z-30 pt-1">
      {/* Center Floating Dock / Navigation Bar */}
      <div className="flex items-center gap-1 sm:gap-2 p-1.5 liquid-glass rounded-full border border-white/80 shadow-md">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-emerald-600/15 border border-emerald-600/30 text-emerald-950 shadow-xs'
                  : 'text-emerald-900/70 hover:text-emerald-950 hover:bg-white/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-700' : 'text-emerald-800/70'}`} />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right Side: Script Tagline & Protected Isolation Badge */}
      <div className="hidden lg:flex items-center gap-4">
        {/* Signature Tagline */}
        <div className="flex items-center gap-1.5 text-emerald-800/80 font-medium select-none" style={{ fontFamily: 'Caveat, cursive', fontSize: '1.25rem' }}>
          <span>Better Care, Greener Tomorrow</span>
          <Leaf className="w-4 h-4 text-emerald-600 fill-emerald-600/20 inline-block" />
        </div>

        {/* Protection & Hardware Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-white/80 text-[11px] font-semibold text-emerald-950 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Protected Isolation</span>
          <span className="text-emerald-900/30">•</span>
          <span>ESP32 WebSerial</span>
          <span className="text-emerald-900/30">•</span>
          <span>{language === 'en' ? 'EN / தமிழ்' : 'தமிழ் / EN'}</span>
        </div>
      </div>
    </div>
  );
};
