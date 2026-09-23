import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Volume2, Globe, Sparkles, MessageSquare } from 'lucide-react';
import { useConversationStore } from '../../stores/plant/conversation-store';
import { GeminiLiveConnection } from '../../lib/plant/realtime-connection';

export const VoiceConversationPanel: React.FC = () => {
  const { messages, liveStatus, isMuted, activeError, addMessage, setLiveStatus, setIsMuted } =
    useConversationStore();

  const connRef = useRef<GeminiLiveConnection | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleConnection = async () => {
    if (liveStatus === 'connected' || liveStatus === 'speaking' || liveStatus === 'listening') {
      if (connRef.current) {
        connRef.current.disconnect();
        connRef.current = null;
      }
      setLiveStatus('disconnected');
    } else {
      const conn = new GeminiLiveConnection({
        onStatusChange: (status, errorMsg) => {
          setLiveStatus(status, errorMsg);
        },
        onTranscript: (text, sender, language) => {
          addMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sender,
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            language,
          });
        },
        onToolCall: (name, args, result) => {
          addMessage({
            id: `tool-${Date.now()}`,
            sender: 'system',
            text: `Plant accessed telemetry tool '${name}'`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            toolCalls: [
              {
                id: `tc-${Date.now()}`,
                name,
                args,
                result,
                timestamp: new Date().toLocaleTimeString(),
              },
            ],
          });
        },
      });

      connRef.current = conn;
      await conn.connect();
    }
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    if (connRef.current) {
      connRef.current.setMuted(newMuteState);
    }
  };

  const isConnected =
    liveStatus === 'connected' || liveStatus === 'speaking' || liveStatus === 'listening';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col gap-3 text-white shadow-md h-full min-h-0">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight uppercase text-white">Gemini Live Voice Session</h2>
            <p className="text-[11px] text-slate-400 font-medium">Bilingual English & Sri Lankan Tamil Voice Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-[10px] text-slate-300 font-mono">
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>EN / தமிழ்</span>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
              isConnected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {liveStatus}
          </span>
        </div>
      </div>

      {/* Error alert */}
      {activeError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-lg">
          {activeError}
        </div>
      )}

      {/* Audio Waveform Animation when active */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center justify-center min-h-[70px] relative overflow-hidden">
        {isConnected ? (
          <div className="flex items-center gap-1.5 h-12">
            <div className="w-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.4s] h-6" />
            <div className="w-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.2s] h-10" />
            <div className="w-1.5 bg-emerald-300 rounded-full animate-bounce h-12" />
            <div className="w-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s] h-8" />
            <div className="w-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.1s] h-11" />
            <div className="w-1.5 bg-emerald-300 rounded-full animate-bounce [animation-delay:-0.5s] h-7" />
          </div>
        ) : (
          <div className="text-slate-500 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500/50" />
            <span>Click "Start Gemini Live" below to speak directly with your plant.</span>
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
                  {msg.sender === 'plant' ? 'Ferny (Plant)' : msg.sender === 'user' ? 'Caregiver' : 'System'}
                </span>
                <span>{msg.timestamp}</span>
              </div>
              <p className="leading-relaxed">{msg.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={toggleConnection}
          className={`flex-1 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isConnected
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
          }`}
        >
          {isConnected ? (
            <>
              <PhoneOff className="w-4 h-4" /> End Live Session
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Start Gemini Live
            </>
          )}
        </button>

        {isConnected && (
          <button
            onClick={toggleMute}
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
