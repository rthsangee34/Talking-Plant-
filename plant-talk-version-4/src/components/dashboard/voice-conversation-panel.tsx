import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, Globe, Sparkles, MessageSquare, Loader2, Radio, AlertCircle } from 'lucide-react';
import { useConversationStore } from '../../stores/plant/conversation-store';
import { useLiveVoiceSession } from '../../lib/plant/live-voice-manager';

export const VoiceConversationPanel: React.FC = () => {
  const { messages } = useConversationStore();
  const {
    liveStatus,
    activeError,
    audioLevel,
    isMuted,
    isLiveActive,
    toggleLiveSpeaking,
    toggleMute,
  } = useLiveVoiceSession();

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Section 13: Dynamic waveform heights reflecting real audio activity
  const baseScale = Math.max(0.15, audioLevel);
  const barHeights = [
    Math.round(Math.max(8, baseScale * 32)),
    Math.round(Math.max(8, baseScale * 48)),
    Math.round(Math.max(10, baseScale * 56)),
    Math.round(Math.max(8, baseScale * 50)),
    Math.round(Math.max(8, baseScale * 42)),
    Math.round(Math.max(8, baseScale * 28)),
  ];

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col gap-3 text-white shadow-md h-full min-h-0">
      {/* Top Header — Section 16: "Gemini Live", "Real-time plant conversation", "English / தமிழ்" */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight uppercase text-white font-['Outfit']">Gemini Live</h2>
            <p className="text-[11px] text-slate-400 font-medium">Real-time plant conversation</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-[10px] text-slate-300 font-mono">
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>English / தமிழ்</span>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-colors ${
              liveStatus === 'speaking'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                : liveStatus === 'listening'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                : liveStatus === 'connecting'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : liveStatus === 'error'
                ? 'bg-rose-900/40 text-rose-400 border border-rose-800'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {liveStatus === 'speaking'
              ? 'Speaking'
              : liveStatus === 'listening'
              ? 'Listening'
              : liveStatus === 'connecting'
              ? 'Connecting'
              : liveStatus === 'error'
              ? 'Error'
              : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Error alert */}
      {activeError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{activeError}</span>
        </div>
      )}

      {/* Audio Waveform Animation — Section 13: Responding to real audio activity */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center justify-center min-h-[70px] relative overflow-hidden">
        {isLiveActive ? (
          <div className="flex items-center gap-2 h-14">
            {barHeights.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}px` }}
                className={`w-2 rounded-full transition-all duration-75 ${
                  liveStatus === 'speaking'
                    ? 'bg-gradient-to-t from-emerald-600 to-teal-300'
                    : 'bg-gradient-to-t from-rose-600 to-amber-300'
                }`}
              />
            ))}
          </div>
        ) : (
          <div className="text-slate-500 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500/50" />
            <span>Click "Start Speak" below to speak directly with your plant in English or தமிழ்.</span>
          </div>
        )}
      </div>

      {/* Transcript Stream Log */}
      <div
        ref={scrollRef}
        className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 flex-1 min-h-[140px] overflow-y-auto space-y-2.5 font-sans text-xs scrollbar-thin"
      >
        {messages.length === 0 ? (
          <p className="text-slate-500 text-center py-6 italic">No voice transcripts recorded yet.</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 p-2.5 rounded-lg max-w-[90%] ${
                msg.sender === 'user'
                  ? 'ml-auto bg-slate-800 text-slate-100 border border-slate-700'
                  : msg.sender === 'plant'
                  ? 'bg-emerald-950/50 text-emerald-200 border border-emerald-800/40'
                  : 'bg-slate-900/40 text-slate-400 border border-slate-800 text-[11px]'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span className="capitalize flex items-center gap-1 font-bold">
                  <MessageSquare className="w-3 h-3 text-emerald-400" />
                  {msg.sender === 'plant' ? 'Plant' : msg.sender === 'user' ? 'Caregiver' : 'System'}
                </span>
                <span>{msg.timestamp}</span>
              </div>
              <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Controls — Section 3 */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={toggleLiveSpeaking}
          className={`flex-1 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            liveStatus === 'connecting'
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md'
              : liveStatus === 'speaking'
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
              : liveStatus === 'listening'
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
              : liveStatus === 'error'
              ? 'bg-amber-700 hover:bg-amber-600 text-white shadow-md'
              : 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-md'
          }`}
        >
          {liveStatus === 'connecting' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Connecting...
            </>
          ) : liveStatus === 'speaking' ? (
            <>
              <Volume2 className="w-4 h-4 animate-bounce" /> Plant Speaking... Stop
            </>
          ) : liveStatus === 'listening' ? (
            <>
              <PhoneOff className="w-4 h-4" /> Stop Speaking
            </>
          ) : liveStatus === 'error' ? (
            <>
              <AlertCircle className="w-4 h-4" /> Retry / connection error
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" /> Start Speak
            </>
          )}
        </button>

        {isLiveActive && (
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`px-4 py-2.5 rounded-lg font-bold text-xs transition-all border cursor-pointer ${
              isMuted
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
};
