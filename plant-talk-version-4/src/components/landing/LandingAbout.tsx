import React from 'react';
import { Cpu, ShieldCheck, HeartHandshake, Award } from 'lucide-react';

export const LandingAbout: React.FC = () => {
  return (
    <section id="about" className="py-20 bg-emerald-950/5 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/70 border border-emerald-300 mb-4 text-emerald-900 text-xs sm:text-sm font-bold tracking-wide select-none">
            <span className="text-emerald-700 text-base">🍃</span>
            <span>ABOUT THE PROJECT —</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-emerald-950 font-['Outfit'] tracking-tight">
            Rooted in Science & Passion
          </h2>

          <p className="mt-4 text-stone-600 text-base sm:text-lg leading-relaxed">
            Talking Plant was developed at <strong>Vivekananda College of Technology (VCOT)</strong> under the 
            Smart Agriculture Project initiative. Our goal is to transform passive plant care into an active, empathetic partnership.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="p-7 rounded-3xl bg-white border border-stone-200/70 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-5">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-2">Smart IoT Telemetry</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Equipped with real-time sensors measuring soil moisture, illumination, and temperature to track your plant&apos;s true biological needs.
            </p>
          </div>

          <div className="p-7 rounded-3xl bg-white border border-stone-200/70 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-5">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-2">Google Gemini AI</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              Powered by advanced generative models to understand botanical health, diagnose symptoms, and converse in friendly first-person dialogue.
            </p>
          </div>

          <div className="p-7 rounded-3xl bg-white border border-stone-200/70 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-5">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 mb-2">VCOT Smart Agriculture</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              A pioneering educational initiative demonstrating how computer engineering, IoT, and environmental science come together for a greener tomorrow.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
};
