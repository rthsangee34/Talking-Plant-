import React from 'react';
import { Eye, Activity, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { useObserverStore } from '../../stores/plant/observer-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useExperienceStore } from '../../stores/plant/experience-store';
import { useObservationLoopStore } from '../../stores/plant/observation-loop-store';
import { useSettingsStore } from '../../stores/plant/settings-store';

export const ObservationPanel: React.FC = () => {
  const {
    currentObservation,
    isObserving,
    streamingStatus,
    setCurrentObservation,
    setIsObserving,
    setStreamingStatus,
    addObservation,
  } = useObserverStore();

  const { autoObserveEnabled, intervalMinutes, setAutoObserveEnabled } = useObservationLoopStore();
  const { readings } = useSensorsStore();
  const { lastSnapshot } = useCameraStore();
  const { showToast } = useExperienceStore();
  const { apiKey } = useSettingsStore();

  const handleTriggerObservation = React.useCallback(async () => {
    if (isObserving) return;
    setIsObserving(true);
    setStreamingStatus('Initiating botanical observation stream...');

    try {
      const response = await fetch('/api/observe', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {})
        },
        body: JSON.stringify({
          imageUrl: lastSnapshot,
          moisture: readings.moisture,
          light: readings.light,
          temperature: readings.temperature,
          humidity: readings.humidity,
          co2: readings.co2,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to initiate observation stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'status') {
              setStreamingStatus(event.message);
            } else if (event.type === 'final' && event.data) {
              setCurrentObservation(event.data);
              addObservation(event.data);
              showToast('Observation logged successfully!', 'success');
            } else if (event.type === 'error') {
              throw new Error(event.error);
            }
          } catch (e) {
            console.error('Error parsing NDJSON line:', e);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Observation failed';
      showToast(msg, 'error');
    } finally {
      setIsObserving(false);
      setStreamingStatus(null);
    }
  }, [isObserving, apiKey, lastSnapshot, readings, setCurrentObservation, setIsObserving, setStreamingStatus, addObservation, showToast]);

  React.useEffect(() => {
    if (autoObserveEnabled && lastSnapshot) {
      handleTriggerObservation();
    }
    // We intentionally only want this to run when lastSnapshot or autoObserveEnabled changes,
    // to avoid infinite loops if handleTriggerObservation is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSnapshot, autoObserveEnabled]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col gap-3 text-slate-100 shadow-md h-full min-h-0 overflow-y-auto pr-1 scrollbar-thin">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold uppercase tracking-tight text-white">Synthesized Plant Observation</h2>
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
            onClick={handleTriggerObservation}
            disabled={isObserving}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isObserving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
            Trigger Observation
          </button>
        </div>
      </div>

      {streamingStatus && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs p-2.5 rounded-lg flex items-center gap-2 font-medium animate-pulse">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{streamingStatus}</span>
        </div>
      )}

      {!currentObservation && !isObserving && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-6 text-center text-slate-400 text-xs">
          No observation recorded yet in this session. Click "Trigger Observation" above.
        </div>
      )}

      {currentObservation && (
        <div className="flex flex-col gap-3 font-sans">
          {/* Health status banner */}
          <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg text-white">
            <span className="text-xs font-bold text-slate-300">Overall Plant State</span>
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md text-xs font-bold uppercase">
              {currentObservation.healthStatus}
            </span>
          </div>

          {/* Plant's sensory remark */}
          <div className="bg-emerald-950/40 border border-emerald-800/40 p-3 rounded-lg text-emerald-200 text-xs italic font-medium leading-relaxed">
            "{currentObservation.sensoryNote}"
          </div>

          {/* Visual vs Sensor Evidence Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
              <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">Visual Evidence</span>
              <p className="text-slate-300 leading-relaxed">{currentObservation.visualEvidence}</p>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
              <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">Sensor Telemetry Evidence</span>
              <p className="text-slate-300 leading-relaxed">{currentObservation.sensorEvidence}</p>
            </div>
          </div>

          {/* Interpretation */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs">
            <span className="font-bold text-slate-400 uppercase text-[10px] block mb-1">Botanical Interpretation</span>
            <p className="text-slate-300 leading-relaxed">{currentObservation.interpretation}</p>
          </div>
        </div>
      )}
    </div>
  );
};
