import React, { useRef } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useExperienceStore } from '../../stores/plant/experience-store';
import { executePlantAnalysis } from '../../lib/plant/run-analysis';

export const PlantUploadPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { setLastSnapshot, setLastMultiSnapshots } = useCameraStore();
  const { showToast } = useExperienceStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('Image size exceeds maximum limit of 10MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLastSnapshot(reader.result);
        setLastMultiSnapshots([reader.result]);
        showToast('Plant photo uploaded successfully!', 'success');
        executePlantAnalysis(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Upload className="w-5 h-5 text-emerald-600" />
        <h2 className="text-base font-bold text-slate-800">Upload Plant Snapshot</h2>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-emerald-50/50"
      >
        <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
        <p className="text-xs font-semibold text-slate-700">Click or drag & drop to upload plant image</p>
        <p className="text-[10px] text-slate-400 mt-1">JPEG, PNG, WebP up to 10MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};
