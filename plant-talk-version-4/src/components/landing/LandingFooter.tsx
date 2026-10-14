import React from 'react';
import { Youtube, Instagram, Twitter } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[#052e16] text-emerald-100/80 border-t border-emerald-900/60 pt-12 pb-8 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-10 border-b border-emerald-900/40">
          
          {/* Logo & Brand Name */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-800/60 border border-emerald-700/60 flex items-center justify-center p-1 group-hover:scale-105 transition-transform overflow-hidden">
              <img 
                src="/planttalklogo-nav.png" 
                alt="Talking Plant Logo" 
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-['Outfit']">
              Talking Plant
            </span>
          </div>

          {/* Navigation Links */}
          {/* CRITICAL RESTRICTION: Do not include Home or Get Started */}
          <nav className="flex items-center gap-8 text-sm font-semibold text-emerald-200/90">
            <button
              onClick={() => scrollTo('features')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollTo('how-it-works')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollTo('about')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              About
            </button>
          </nav>

          {/* Social Links */}
          <div className="flex items-center gap-4 text-emerald-300">
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-emerald-900/60 hover:bg-emerald-800 flex items-center justify-center hover:text-white transition-colors cursor-pointer"
              aria-label="YouTube"
            >
              <Youtube className="w-4 h-4" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-emerald-900/60 hover:bg-emerald-800 flex items-center justify-center hover:text-white transition-colors cursor-pointer"
              aria-label="Instagram"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-emerald-900/60 hover:bg-emerald-800 flex items-center justify-center hover:text-white transition-colors cursor-pointer"
              aria-label="Twitter / X"
            >
              <Twitter className="w-4 h-4" />
            </a>
          </div>

        </div>

        {/* Bottom Slogan & Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-emerald-300/70 font-medium">
          <p>© 2025 Talking Plant. All rights reserved.</p>
          <div className="flex items-center gap-1 text-emerald-200">
            <span>Happy Plants</span>
            <span className="text-rose-400">♥</span>
            <span>Happy You</span>
            <span className="text-emerald-400 text-sm">🍃</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
