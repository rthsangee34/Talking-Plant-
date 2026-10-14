import React, { useRef } from 'react';
import { 
  Camera, 
  Maximize2, 
  UploadCloud, 
  Settings2, 
  Leaf, 
  Thermometer, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import plantHeroImage from '../assets/plant-hero.jpg';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useCameraStore } from '../../stores/plant/camera-store';

interface PlantHeroProps {
  onStartCamera: () => void;
  onCapture: () => void;
  onUpload: (file?: File) => void;
  onOpenSettings: () => void;
  onSelectAction?: (actionId: string) => void;
}

export const PlantHero: React.FC<PlantHeroProps> = ({
  onStartCamera,
  onCapture,
  onUpload,
  onOpenSettings,
  onSelectAction,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { readings } = useSensorsStore();
  const { streamInfo } = useCameraStore();

  const tempStr = readings.temperature != null ? `${readings.temperature}°C` : '--°C';
  const moistureStr = `${readings.moisture}%`;
  const humStr = readings.humidity != null ? `${readings.humidity}%` : '--%';
  const lightStr = `${readings.light}%`;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full animate-in fade-in zoom-in-95 duration-400">
      {/* Hidden file input for Upload Photo */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Plant View Card */}
      <div className="flex-1 min-h-0 flex flex-col liquid-glass rounded-3xl p-3 sm:p-4 border border-white/75 shadow-md relative overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 mb-2.5 px-1 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-800">
              <Camera className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-emerald-950 tracking-tight">
              Plant View
            </h2>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/70 backdrop-blur-md border border-white/80 text-[11px] font-semibold text-emerald-900/80">
            <span>{streamInfo ? `${streamInfo.width} × ${streamInfo.height}` : '1920 × 1080'}</span>
            <span className="text-emerald-900/30">|</span>
            <span className="text-emerald-700">{streamInfo?.frameRate ? `${Math.round(streamInfo.frameRate)} FPS` : '30 FPS'}</span>
          </div>
        </div>

        {/* Plant Image Container */}
        <div className="relative flex-1 min-h-0 w-full rounded-2xl overflow-hidden shadow-inner border border-white/60 bg-emerald-950/10 group">
          <img
            src={plantHeroImage}
            alt="Your Plant — Healthy Golden Pothos in Greenhouse"
            className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-103"
            loading="eager"
          />

          {/* Subtle natural glass reflections over image */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/10 pointer-events-none" />

          {/* Top-Right FPS Overlay Pill */}
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md border border-white/20 text-white text-[11px] font-mono font-medium shadow-xs">
            30 FPS
          </div>

          {/* Bottom-Left: Touch Status Badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/75 backdrop-blur-md border border-emerald-500/30 text-emerald-200 text-xs font-semibold shadow-md">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ready for vision</span>
          </div>

          {/* Bottom-Right Expand Button */}
          <button
            type="button"
            onClick={onStartCamera}
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 text-white/90 flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Expand / Start Camera"
            aria-label="Expand / Start Camera"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Camera Action Buttons Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 shrink-0">
          <button
            type="button"
            onClick={onCapture}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl liquid-glass-interactive text-emerald-950 text-xs font-bold cursor-pointer"
          >
            <Camera className="w-4 h-4 text-emerald-700" />
            <span>Capture</span>
          </button>

          <button
            type="button"
            onClick={onStartCamera}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl btn-liquid-emerald text-xs font-bold cursor-pointer shadow-md"
          >
            <Camera className="w-4 h-4" />
            <span>Start Camera</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl liquid-glass-interactive text-emerald-950 text-xs font-bold cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-emerald-700" />
            <span>Upload Photo</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl liquid-glass-interactive text-emerald-950 text-xs font-bold cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-emerald-700" />
            <span>Camera Settings</span>
          </button>
        </div>
      </div>

      {/* Secondary Bottom Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
        {/* Card 1: Healthy Growth */}
        <div 
          onClick={() => onSelectAction && onSelectAction('growth')}
          className="flex items-center justify-between p-3 rounded-2xl liquid-glass-card cursor-pointer border border-white/70 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/80 shrink-0 shadow-xs">
              <img src={plantHeroImage} alt="Thumbnail" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-emerald-950">Healthy Growth</span>
                <Sparkles className="w-3 h-3 text-emerald-600" />
              </div>
              <p className="text-[11px] text-emerald-800/70 font-medium">Your plant is doing well!</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-800/50 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-all" />
        </div>

        {/* Card 2: Environment Summary */}
        <div className="flex items-center justify-between p-3 rounded-2xl liquid-glass-card border border-white/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-800 shrink-0">
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-950">Environment Summary</span>
              <p className="text-[11px] font-mono text-emerald-800/80 font-medium tracking-tight">
                {tempStr} • {moistureStr} • {humStr} • {lightStr}
              </p>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
        </div>
      </div>
    </div>
  );
};
