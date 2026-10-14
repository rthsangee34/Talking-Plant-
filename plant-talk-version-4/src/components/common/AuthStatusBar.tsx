import React from 'react';
import { User, LogOut, Globe, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

interface AuthStatusBarProps {
  onReturnToLanding: () => void;
}

export const AuthStatusBar: React.FC<AuthStatusBarProps> = ({ onReturnToLanding }) => {
  const { user, signOut } = useAuthStore();

  if (!user) return null;

  return (
    <div className="fixed top-3 left-4 z-40 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-md border border-stone-200/80 shadow-md text-xs font-semibold text-stone-700 select-none transition-all hover:bg-white">
      <div className="flex items-center gap-2 pr-2 border-r border-stone-200">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'Google Account'}
            className="w-5 h-5 rounded-full object-cover border border-emerald-400"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">
            <User className="w-3 h-3" />
          </div>
        )}
        <span className="max-w-[110px] truncate text-emerald-950 font-bold">
          {user.displayName || user.email?.split('@')[0] || 'User'}
        </span>
      </div>

      <button
        onClick={onReturnToLanding}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
        title="View Landing Page"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>Landing</span>
      </button>

      <button
        onClick={() => signOut()}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-stone-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
        title="Sign Out"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Sign Out</span>
      </button>
    </div>
  );
};
