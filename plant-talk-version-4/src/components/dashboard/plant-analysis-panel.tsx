import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Sparkles, Flower2, Leaf, Bug, CheckCircle2, RefreshCw, Eye, AlertTriangle, Users, Volume2, VolumeX, MessageSquare } from 'lucide-react';
import { useObserverStore } from '../../stores/plant/observer-store';
import { useCameraStore } from '../../stores/plant/camera-store';
import { executePlantAnalysis } from '../../lib/plant/run-analysis';
import { useObservationLoopStore } from '../../stores/plant/observation-loop-store';

export const PlantAnalysisPanel: React.FC = () => {
  const { lastAnalysis, isAnalyzing } = useObserverStore();
  const { lastMultiSnapshots } = useCameraStore();
  const { autoObserveEnabled, intervalMinutes, setAutoObserveEnabled } = useObservationLoopStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handleRunAnalysis = useCallback(async (useMulti = false) => {
    if (isAnalyzing) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setCurrentSpeakerIndex(null);
    await executePlantAnalysis(useMulti);
  }, [isAnalyzing]);

  const { lastSnapshot } = useCameraStore();

  useEffect(() => {
    if (autoObserveEnabled && lastSnapshot) {
      handleRunAnalysis(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSnapshot, autoObserveEnabled]);

  const playConversation = () => {
    if (!lastAnalysis?.conversation || lastAnalysis.conversation.length === 0) return;
    
    window.speechSynthesis.cancel();
    setIsPlaying(true);
    
    let currentIdx = 0;
    
    const speakNext = () => {
      if (currentIdx >= lastAnalysis.conversation.length) {
        setIsPlaying(false);
        setCurrentSpeakerIndex(null);
        return;
      }
      
      setCurrentSpeakerIndex(currentIdx);
      const turn = lastAnalysis.conversation[currentIdx];
      
      const utterance = new SpeechSynthesisUtterance(turn.text);
      utteranceRef.current = utterance; // Prevent garbage collection
      
      const voices = window.speechSynthesis.getVoices();
      
      // Auto-detect language based on Tamil unicode range
      if (/[\u0B80-\u0BFF]/.test(turn.text)) {
        utterance.lang = 'ta-IN';
        const tamilVoice = voices.find(v => v.lang.includes('ta') || v.name.toLowerCase().includes('tamil'));
        if (tamilVoice) {
          utterance.voice = tamilVoice;
        } else if (voices.length > 0) {
          // If no Tamil voice is found, browser might fail. Warn the user in console.
          if (currentIdx === 0) {
            console.warn("No Tamil voice found on this device. The audio might be silent.");
          }
          utterance.voice = voices[0]; // fallback
        }
      } else {
        utterance.lang = 'en-US';
        const englishVoice = voices.find(v => v.lang.includes('en'));
        if (englishVoice) utterance.voice = englishVoice;
      }

      utterance.onend = () => {
        currentIdx++;
        speakNext();
      };
      
      utterance.onerror = (e) => {
        console.error('SpeechSynthesis error:', e);
        setIsPlaying(false);
        setCurrentSpeakerIndex(null);
      };
      
      window.speechSynthesis.speak(utterance);
    };
    
    // Slight delay after cancel() to prevent Chrome from skipping the utterance
    setTimeout(() => {
      speakNext();
    }, 50);
  };
  
  const stopConversation = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setCurrentSpeakerIndex(null);
  };
  
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm shadow-md flex flex-col gap-3 h-full min-h-0 overflow-y-auto pr-1 scrollbar-thin">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold tracking-tight text-white uppercase">Multi-Plant Vision AI</h2>
        </div>

        <div className="flex items-center gap-2">
          {lastMultiSnapshots.length > 1 && (
            <button
              onClick={() => handleRunAnalysis(true)}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
              Scan 3 Frames
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
            <span className="text-xs font-bold text-slate-300">Auto:</span>
            <div className="relative inline-block w-7 h-3.5">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={autoObserveEnabled}
                onChange={(e) => setAutoObserveEnabled(e.target.checked)}
              />
              <div className="w-7 h-3.5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
            </div>
          </label>

          <button
            onClick={() => handleRunAnalysis(false)}
            disabled={isAnalyzing}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
            Scan Frame
          </button>
        </div>
      </div>

      {/* Empty State */}
      {!lastAnalysis && !isAnalyzing && (
        <div className="bg-slate-900/60 border border-emerald-900/30 rounded-xl p-8 text-center text-slate-400 flex flex-col items-center gap-3">
          <Flower2 className="w-12 h-12 text-emerald-500/40" />
          <p className="text-sm font-medium">
            No vision scan conducted yet. Capture a photo with your camera and click "Run Vision Scan".
          </p>
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing && (
        <div className="bg-slate-900/60 border border-emerald-500/30 rounded-xl p-8 text-center text-emerald-300 flex flex-col items-center gap-3">
          <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
          <p className="text-sm font-semibold animate-pulse">
            Scanning for multiple plants...
          </p>
        </div>
      )}

      {/* Analysis Results */}
      {lastAnalysis && !isAnalyzing && (
        <div className="flex flex-col gap-4">
          
          {/* Scene Summary */}
          <div className="bg-slate-900/90 border border-emerald-800/40 rounded-xl p-4 flex flex-col gap-2 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Scene Summary</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-700/50 rounded-full font-mono">
                {lastAnalysis.totalPlantsDetected} Plant{lastAnalysis.totalPlantsDetected !== 1 ? 's' : ''} Detected
              </span>
            </div>
            <p className="text-sm text-emerald-100/90">{lastAnalysis.sceneSummary}</p>
          </div>

          {/* Plant Individuals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lastAnalysis.plants.map((plant) => (
              <div key={plant.plantId} className="bg-slate-900/70 border border-emerald-900/30 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-emerald-100">{plant.displayName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        plant.role === 'main' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {plant.role}
                      </span>
                    </div>
                    {plant.commonName && <div className="text-emerald-200/80 text-xs mt-0.5 line-clamp-2" title={`${plant.commonName} (${plant.scientificName})`}>{plant.commonName} <span className="italic">({plant.scientificName})</span></div>}
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">{plant.position}</span>
                </div>
                
                <div className="text-xs text-slate-300 mb-1">
                  Condition: <span className="text-emerald-300 font-semibold">{plant.visibleCondition}</span>
                </div>
                
                <div className="flex flex-col gap-2 text-xs">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="font-bold text-amber-300 mb-1 flex items-center gap-1.5"><Flower2 className="w-3.5 h-3.5"/> Flowers / Buds</div>
                    <div className="text-slate-300">{plant.flowers.status !== 'not-visible' ? plant.flowers.details : 'No flowers visible.'}</div>
                  </div>
                  
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5"><Leaf className="w-3.5 h-3.5"/> Foliage</div>
                    <div className="text-slate-300">{plant.leaves.condition}</div>
                  </div>
                  
                  {(plant.pests.detected || plant.damage.detected) && (
                    <div className="bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/40">
                       <div className="font-bold text-rose-400 mb-1 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5"/> Issues</div>
                       {plant.pests.detected && <div className="text-rose-300/90 mb-1">• {plant.pests.details}</div>}
                       {plant.damage.detected && <div className="text-orange-300/90">• {plant.damage.details}</div>}
                    </div>
                  )}
                </div>
                
                <div className="bg-teal-950/30 p-2.5 rounded-lg border border-teal-900/40 text-xs text-teal-200/90 mt-1">
                  <span className="font-bold text-teal-400 flex items-center gap-1.5 mb-1"><CheckCircle2 className="w-3.5 h-3.5"/> Care Recommendation</span>
                  {plant.recommendation}
                </div>
              </div>
            ))}
          </div>

          {/* Conversation Player */}
          {lastAnalysis.conversation && lastAnalysis.conversation.length > 0 && (
            <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-4 flex flex-col gap-3 shadow-inner">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-300 text-sm font-bold uppercase tracking-wider">
                    <MessageSquare className="w-4 h-4 text-indigo-400" /> Plant Conversation
                  </div>
                  <button
                    onClick={isPlaying ? stopConversation : playConversation}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    {isPlaying ? <><VolumeX className="w-4 h-4"/> Stop</> : <><Volume2 className="w-4 h-4"/> Play Voices</>}
                  </button>
               </div>
               
               <div className="flex flex-col gap-2.5">
                 {lastAnalysis.conversation.map((turn, idx) => {
                   const plant = lastAnalysis.plants.find(p => p.plantId === turn.speakerId);
                   const isSpeaking = currentSpeakerIndex === idx;
                   return (
                     <div key={idx} className={`p-3 rounded-lg border transition-all duration-300 ${
                       isSpeaking 
                         ? 'bg-indigo-900/60 border-indigo-400 shadow-md shadow-indigo-900/50 scale-[1.01]' 
                         : 'bg-indigo-950/40 border-indigo-900/50'
                     }`}>
                        <div className="text-[11px] font-bold text-indigo-300 mb-1.5 flex items-center justify-between">
                          <span>{plant?.displayName || turn.speakerId}</span>
                          {isSpeaking && <span className="flex items-center gap-1"><Volume2 className="w-3 h-3 animate-pulse text-indigo-400"/></span>}
                        </div>
                        <div className={`text-sm italic ${isSpeaking ? 'text-white' : 'text-indigo-100/80'}`}>
                          "{turn.text}"
                        </div>
                     </div>
                   )
                 })}
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

