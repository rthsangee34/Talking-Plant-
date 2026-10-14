import React from 'react';
import { Mic, Leaf, Bell, Heart } from 'lucide-react';

export const LandingFeatures: React.FC = () => {
  const features = [
    {
      id: 'voice-interaction',
      title: 'Voice Interaction',
      description: 'Talk to your plant and get friendly responses.',
      icon: Mic,
      circleBg: 'bg-[#bbf7d0]/50 text-[#15803d]',
    },
    {
      id: 'health-monitoring',
      title: 'Health Monitoring',
      description: 'Tracks soil moisture, light, temperature and more.',
      icon: Leaf,
      circleBg: 'bg-[#dcfce7] text-[#16a34a]',
    },
    {
      id: 'smart-alerts',
      title: 'Smart Alerts',
      description: 'Notifies you when your plant needs water, light or care.',
      icon: Bell,
      circleBg: 'bg-[#fef3c7] text-[#d97706]',
    },
    {
      id: 'builds-connection',
      title: 'Builds Connection',
      description: 'Spend time, get answers, and enjoy a greener, happier space.',
      icon: Heart,
      circleBg: 'bg-[#ffe4e6] text-[#e11d48]',
    },
  ];

  return (
    <section id="features" className="py-20 bg-gradient-to-b from-transparent via-[#f0f7f2] to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Section Label */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 mb-4 text-emerald-800 text-xs sm:text-sm font-bold tracking-wide select-none">
          <span className="text-emerald-600 text-base">🍃</span>
          <span>KEY FEATURES —</span>
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-emerald-950 font-['Outfit'] tracking-tight">
          More Than Just a Plant
        </h2>

        {/* Description */}
        <p className="mt-4 text-stone-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Talking Plant combines smart technology with nature to give your plants the care and attention they deserve.
        </p>

        {/* 4 Feature Items Grid */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className="group flex flex-col items-center text-center p-6 rounded-3xl bg-white/70 backdrop-blur-sm border border-stone-200/50 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Circular Icon Container matching reference design */}
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform ${feature.circleBg}`}
                >
                  <Icon className="w-9 h-9 stroke-[2.2]" />
                </div>

                {/* Feature Title */}
                <h3 className="text-lg font-bold text-stone-900 tracking-tight mb-2">
                  {feature.title}
                </h3>

                {/* Feature Description */}
                <p className="text-sm text-stone-600 leading-relaxed font-normal">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
