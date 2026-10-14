import React from 'react';
import { Home, Eye, BarChart2, Mic, History, ShieldCheck, Lock } from 'lucide-react';
import { NavSection } from '../types';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'vision', label: 'Vision', icon: Eye },
  { id: 'telemetry', label: 'Telemetry', icon: BarChart2 },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'history', label: 'History', icon: History },
  { id: 'diagnostics', label: 'Diagnostics', icon: ShieldCheck },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
}) => {
  return (
    <aside 
      className="hidden md:flex flex-col justify-between w-40 lg:w-44 shrink-0 liquid-glass rounded-3xl p-3 border border-white/70 shadow-sm"
      aria-label="Main Navigation"
    >
      {/* Top Navigation Links */}
      <nav className="flex flex-col gap-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'liquid-glass-active text-emerald-950 shadow-xs'
                  : 'text-emerald-900/70 hover:text-emerald-950 hover:bg-white/50'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div 
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                  isActive ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-800'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Secure Access Button */}
      <div className="pt-2 border-t border-emerald-950/10">
        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-2xl bg-white/60 hover:bg-white/80 border border-white/80 text-emerald-900 text-[11px] font-bold shadow-xs transition-all cursor-pointer active:scale-95"
        >
          <Lock className="w-3.5 h-3.5 text-emerald-700" />
          <span>Secure Access</span>
        </button>
      </div>
    </aside>
  );
};
