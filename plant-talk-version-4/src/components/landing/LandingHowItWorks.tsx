import React from 'react';

export const LandingHowItWorks: React.FC = () => {
  const steps = [
    {
      number: '1',
      title: 'Set Up',
      description: 'Connect your plant and power on the device.',
      badgeBg: 'bg-[#16a34a] text-white',
    },
    {
      number: '2',
      title: 'Let It Learn',
      description: 'It senses your plant\'s environment and starts understanding.',
      badgeBg: 'bg-[#0284c7] text-white',
    },
    {
      number: '3',
      title: 'Talk & Care',
      description: 'Have a conversation and get helpful advice in real time.',
      badgeBg: 'bg-[#9333ea] text-white',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mb-14 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 mb-4 text-emerald-800 text-xs sm:text-sm font-bold tracking-wide select-none">
            <span className="text-emerald-600 text-base">🍃</span>
            <span>HOW IT WORKS —</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-emerald-950 font-['Outfit'] tracking-tight">
            Simple Steps, Happy Plants
          </h2>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: 3 Steps */}
          <div className="lg:col-span-6 space-y-8">
            {steps.map((step) => (
              <div 
                key={step.number} 
                className="flex items-start gap-5 p-4 sm:p-5 rounded-2xl bg-white/60 backdrop-blur-xs border border-stone-200/50 hover:bg-white hover:shadow-md transition-all"
              >
                {/* Number Circle Badge */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 shadow-sm ${step.badgeBg}`}
                >
                  {step.number}
                </div>

                {/* Step content */}
                <div>
                  <h3 className="text-lg font-bold text-stone-900 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-stone-600 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Plant status illustration matching design */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-full max-w-md rounded-3xl overflow-hidden bg-emerald-50/40 p-4 border border-stone-200/60 shadow-xl shadow-emerald-950/5">
              <img
                src="/how-plant-full.png"
                alt="How it works - Happy plant with live telemetry badges"
                className="w-full h-auto object-contain rounded-2xl"
                loading="lazy"
              />
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
