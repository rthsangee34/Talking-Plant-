import React from 'react';
import { Droplet, Thermometer, CloudRain, Sun } from 'lucide-react';
import { PlantMetrics } from '../types';
import { useSensorsStore } from '../../stores/plant/sensors-store';

interface EnvironmentMetricsProps {
  metrics?: PlantMetrics;
}

export const EnvironmentMetrics: React.FC<EnvironmentMetricsProps> = ({ metrics: propMetrics }) => {
  const { readings } = useSensorsStore();

  const moistureVal = propMetrics?.moisture ?? readings.moisture;
  const tempVal = propMetrics?.temperature ?? (readings.temperature ?? 24.5);
  const humVal = propMetrics?.humidity ?? (readings.humidity ?? 55);
  const lightVal = propMetrics?.light ?? readings.light;

  const items = [
    {
      id: 'moisture',
      label: 'Moisture',
      value: `${moistureVal}%`,
      icon: Droplet,
      iconColor: 'text-sky-600',
      barColor: 'bg-sky-500',
      percent: Math.min(100, Math.max(0, moistureVal)),
    },
    {
      id: 'temperature',
      label: 'Temperature',
      value: `${tempVal}°C`,
      icon: Thermometer,
      iconColor: 'text-rose-500',
      barColor: 'bg-rose-500',
      percent: Math.min(100, Math.max(0, Math.round((tempVal / 45) * 100))),
    },
    {
      id: 'humidity',
      label: 'Humidity',
      value: `${humVal}%`,
      icon: CloudRain,
      iconColor: 'text-indigo-500',
      barColor: 'bg-indigo-500',
      percent: Math.min(100, Math.max(0, humVal)),
    },
    {
      id: 'light',
      label: 'Light',
      value: `${lightVal}%`,
      icon: Sun,
      iconColor: 'text-amber-500',
      barColor: 'bg-amber-500',
      percent: Math.min(100, Math.max(0, lightVal)),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="flex flex-col items-center justify-between p-2.5 rounded-2xl bg-white/60 hover:bg-white/80 border border-white/75 shadow-xs transition-all duration-200 text-center group"
          >
            {/* Metric Icon */}
            <div className={`p-1.5 rounded-xl bg-white/70 shadow-xs mb-1.5 ${item.iconColor}`}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Label */}
            <span className="text-[11px] font-semibold text-emerald-950/70">
              {item.label}
            </span>

            {/* Value */}
            <span className="text-sm font-black text-emerald-950 tracking-tight my-1">
              {item.value}
            </span>

            {/* Accent Progress Indicator */}
            <div className="w-full h-1.5 rounded-full bg-black/5 overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all duration-700 ${item.barColor}`}
                style={{ width: `${item.percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
