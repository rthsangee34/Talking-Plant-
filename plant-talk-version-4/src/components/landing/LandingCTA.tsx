import React from 'react';

export const LandingCTA: React.FC = () => {
  return (
    <section className="relative overflow-hidden py-24 sm:py-28 bg-[#032313] text-white">
      {/* Background with lush water-droplet leaf texture */}
      <div className="absolute inset-0 z-0">
        <img
          src="/cta-lush-leaf.jpg"
          alt="Lush green leaf background"
          className="w-full h-full object-cover object-center filter brightness-[0.45] contrast-[1.1]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#032313]/90 via-[#032313]/60 to-[#032313]/85" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Intro Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs sm:text-sm font-bold tracking-wider mb-6 select-none backdrop-blur-xs">
          <span>🍃</span>
          <span>READY TO BRING NATURE CLOSER?</span>
          <span>🍃</span>
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white font-['Outfit'] drop-shadow-sm">
          Start Your Talking Plant Journey Today
        </h2>

        {/* Supporting text */}
        <p className="mt-4 text-emerald-100/90 text-base sm:text-lg font-medium max-w-xl mx-auto">
          Smarter care. Happier plants. A greener tomorrow.
        </p>

        {/* Note: In accordance with specifications, no buttons are added to this section */}
      </div>
    </section>
  );
};
