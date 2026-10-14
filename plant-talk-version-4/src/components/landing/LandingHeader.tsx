import React, { useState } from 'react';
import { Menu, X, Sparkles, User, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

interface LandingHeaderProps {
  onInstallClick: () => void;
  onEnterApp?: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({ onInstallClick, onEnterApp }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, signOut } = useAuthStore();

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-emerald-950/5 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="relative w-11 h-11 flex items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-xs group-hover:scale-105 transition-transform">
            <img 
              src="/planttalklogo.png" 
              alt="Talking Plant Logo" 
              className="w-9 h-9 object-contain"
            />
          </div>
          <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-emerald-950 font-['Outfit']">
            Talking Plant
          </span>
        </div>

        {/* Desktop Navigation Links */}
        {/* CRITICAL RESTRICTION: No Home, No Get Started in Header */}
        <nav className="hidden md:flex items-center gap-8 font-semibold text-stone-700 text-sm">
          <button
            onClick={() => scrollToSection('features')}
            className="hover:text-emerald-700 transition-colors cursor-pointer py-1"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="hover:text-emerald-700 transition-colors cursor-pointer py-1"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToSection('about')}
            className="hover:text-emerald-700 transition-colors cursor-pointer py-1"
          >
            About
          </button>
        </nav>

        {/* Right side: Authenticated status or mobile toggle */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user && (
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-stone-200">
              <button
                onClick={onEnterApp}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/70 border border-emerald-300 text-emerald-900 text-xs font-bold hover:bg-emerald-200/80 transition-colors cursor-pointer"
                title="Go to Your Plant Dashboard"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-emerald-700" />
                )}
                <span className="max-w-[120px] truncate">{user.displayName || 'My Plant'}</span>
              </button>
              <button
                onClick={() => signOut()}
                className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-emerald-950/10 px-6 py-5 shadow-xl animate-in slide-in-from-top-2">
          <nav className="flex flex-col gap-4 font-semibold text-stone-800 text-base">
            <button
              onClick={() => scrollToSection('features')}
              className="text-left py-2 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="text-left py-2 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="text-left py-2 hover:text-emerald-700 transition-colors cursor-pointer"
            >
              About
            </button>

            {isAuthenticated && user && (
              <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onEnterApp?.();
                  }}
                  className="flex items-center gap-2 text-sm font-bold text-emerald-800"
                >
                  <User className="w-4 h-4" />
                  <span>Open Plant Dashboard</span>
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="text-xs font-semibold text-stone-500 hover:text-rose-600"
                >
                  Sign Out
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};
