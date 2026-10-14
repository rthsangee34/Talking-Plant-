import React from 'react';
import { Download, Compass, Sparkles, Sprout } from 'lucide-react';

interface LandingHeroProps {
  onInstallClick: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onInstallClick }) => {
  const scrollToFeatures = () => {
    const el = document.getElementById('features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 sm:pt-12 sm:pb-24 lg:pt-16 lg:pb-28">
      {/* Soft botanical atmospheric glow in the background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-200/25 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-10 right-10 w-72 h-72 bg-emerald-300/15 rounded-full blur-2xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Heading, description, actions */}
          <div className="lg:col-span-6 flex flex-col items-start text-left">
            
            {/* Small introductory label */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 mb-5 text-emerald-800 text-xs sm:text-sm font-bold tracking-wide select-none">
              <span className="text-emerald-600 text-base">🍃</span>
              <span>A SMARTER WAY TO CARE —</span>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-emerald-950 font-['Outfit'] tracking-tight leading-[1.12]">
              Meet Your <br className="hidden sm:inline" />
              <span className="text-emerald-700">Talking Plant</span>
            </h1>

            {/* Supporting description */}
            <p className="mt-5 text-stone-700 text-base sm:text-lg leading-relaxed max-w-lg font-normal">
              An intelligent plant companion that talks, listens and helps you keep your plants healthy. Because every plant has a story to tell!
            </p>

            {/* Button group */}
            <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-4 w-full sm:w-auto">
              {/* Primary: Install App Button */}
              <button
                id="hero-install-app-btn"
                onClick={onInstallClick}
                className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-base shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98"
              >
                <Download className="w-5 h-5 shrink-0" />
                <span>Install App</span>
              </button>

              {/* Secondary: Explore Button */}
              <button
                id="hero-explore-btn"
                onClick={scrollToFeatures}
                className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-white/90 hover:bg-emerald-50 border border-[#16a34a] text-[#16a34a] font-bold text-base shadow-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98"
              >
                <Compass className="w-5 h-5 shrink-0 text-[#16a34a]" />
                <span>Explore</span>
              </button>
            </div>

            {/* Quick security / platform note */}
            <div className="mt-6 flex items-center gap-2 text-xs text-stone-700 font-medium select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Progressive Web App • Multi-Platform • Google AI Powered</span>
            </div>
          </div>

          {/* Right Column: Hero plant image composition matching design */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-md lg:max-w-lg rounded-3xl overflow-hidden shadow-2xl shadow-emerald-950/10 border border-white/80 bg-gradient-to-b from-white/60 to-emerald-50/40 p-2 sm:p-3 transition-transform hover:scale-[1.01]">
              <img
                src="/hero-plant-full.png"
                alt="Meet Your Talking Plant - Friendly smiling smart plant companion"
                className="w-full h-auto object-cover rounded-2xl"
                loading="eager"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
