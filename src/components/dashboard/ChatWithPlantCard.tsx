import React, { useState, useRef, useEffect } from 'react';
import {
  Sprout,
  User,
  CheckCheck,
  Paperclip,
  Mic,
  Send,
  Volume2,
  VolumeX,
  Radio,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useConversationStore } from '../../stores/plant/conversation-store';
import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { defaultAIProvider } from '../../services/ai/gemini-provider';
import { useLiveVoiceSession } from '../../lib/plant/live-voice-manager';
import { getFemaleVoice, getAllVoices } from '../../lib/plant/warning-voice-system';

export const ChatWithPlantCard: React.FC = () => {
  const {
    messages,
    addMessage,
    isVoiceMode,
    toggleVoiceMode,
    isTyping,
    setIsTyping,
    setLiveStatus,
  } = useConversationStore();

  const { readings } = useSensorsStore();
  const { apiKey } = useSettingsStore();
  const { liveStatus, activeError, toggleLiveSpeaking } = useLiveVoiceSession();

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (textToSend?: string, wasSpoken = false) => {
    const message = (textToSend || inputText).trim();
    if (!message) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add user message to state
    addMessage({
      id: `user-${Date.now()}`,
      sender: 'user',
      text: message,
      isVoice: wasSpoken,
      timestamp: userTime,
    });

    if (!textToSend) {
      setInputText('');
    }

    setIsTyping(true);

    try {
      const resp = await defaultAIProvider.chat(
        message,
        apiKey,
        {
          soilMoisture: Math.round(readings.moisture || 58),
          lightIntensity: Math.round(readings.light || 65),
          temperature: Math.round(readings.temperature || 26),
          humidity: Math.round(readings.humidity || 62),
        },
        messages.map((m) => ({
          sender: m.sender,
          text: m.text,
          timestamp: m.timestamp,
        }))
      );

      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      addMessage({
        id: `plant-${Date.now()}`,
        sender: 'plant',
        text: resp.reply,
        timestamp: aiTime,
      });

      // Voice Mode audio playback with female voice
      if (isVoiceMode && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(resp.reply);
        const isTamil = /[\u0B80-\u0BFF]/.test(resp.reply) || resp.reply.toLowerCase().includes('vanakkam');
        utterance.lang = isTamil ? 'ta-IN' : 'en-US';
        utterance.pitch = 1.2;
        utterance.rate = 1.0;

        const voices = getAllVoices();
        const femaleVoice = getFemaleVoice(voices, isTamil ? 'ta' : 'en');
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }

        window.speechSynthesis.speak(utterance);
      }
    } catch (err: any) {
      addMessage({
        id: `err-${Date.now()}`,
        sender: 'plant',
        text: err?.message || 'I could not connect to my AI companion brain. Please verify your API key.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      handleSendMessage('I just uploaded a fresh leaf photo of you! How do you look?');
    };
    reader.readAsDataURL(file);
  };

  // Helper for Section 8.3 button states
  const getLiveButtonProps = () => {
    switch (liveStatus) {
      case 'connecting':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />,
          label: 'Connecting...',
          tooltip: 'Connecting...',
          className:
            'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-wait active:scale-90 shrink-0 bg-emerald-50 border border-emerald-300 text-emerald-600',
        };
      case 'listening':
        return {
          icon: <Radio className="w-4 h-4 text-white animate-pulse" />,
          label: 'Listening — click to stop',
          tooltip: 'Listening — click to stop',
          className:
            'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-xs border border-rose-500',
        };
      case 'speaking':
        return {
          icon: <Volume2 className="w-4 h-4 text-white animate-bounce" />,
          label: 'PlantTalk is speaking — click to stop',
          tooltip: 'PlantTalk is speaking — click to stop',
          className:
            'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse shadow-xs border border-emerald-500',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-white" />,
          label: activeError || 'Connection error — click to retry',
          tooltip: activeError || 'Connection error — click to retry',
          className:
            'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 bg-amber-600 hover:bg-amber-700 text-white border border-amber-500',
        };
      case 'disconnected':
      default:
        return {
          icon: <Mic className="w-4 h-4 text-emerald-700" />,
          label: 'Start Live Speaking',
          tooltip: 'Start Live Speaking',
          className:
            'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 shrink-0 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 text-emerald-700',
        };
    }
  };

  return (
    <div className="w-full flex-1 min-h-[380px] sm:min-h-[440px] lg:min-h-0 lg:h-full bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-stone-200/80 shadow-xs flex flex-col justify-between overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────
          HEADER ROW: CHAT TITLE & VOICE MODE TOGGLE
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-2.5 border-b border-stone-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-xs">
            <Sprout className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight font-['Outfit']">
              Chat with Your Plant
            </h2>
            <p className="text-[11px] sm:text-xs text-stone-500 font-medium">Ask anything about your plant</p>
          </div>
        </div>

        {/* Voice Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleVoiceMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
            isVoiceMode
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
              : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
          }`}
          title={isVoiceMode ? 'Voice Mode Active — Plant will speak responses aloud' : 'Enable Voice Mode Audio'}
        >
          {isVoiceMode ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Voice Mode</span>
              <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-stone-400" />
              <span>Voice Mode</span>
            </>
          )}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          UNIFIED CONVERSATION MESSAGE LIST (TEXT + VOICE)
          ───────────────────────────────────────────────────────────── */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden my-2 sm:my-3 pr-1 space-y-3 scrollbar-thin">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Plant avatar (left) */}
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 mb-1">
                  <Sprout className="w-4 h-4" />
                </div>
              )}

              {/* Message bubble */}
              <div
                className={`max-w-[82%] sm:max-w-[78%] rounded-2xl px-4 py-2.5 shadow-2xs text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-[#d1fae5] text-emerald-950 rounded-br-xs border border-emerald-200/80'
                    : 'bg-white text-stone-800 rounded-bl-xs border border-stone-200/90'
                }`}
              >
                {/* Spoken voice message badge */}
                {msg.isVoice && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 mb-1">
                    <Mic className="w-3 h-3" />
                    <span>Voice Message</span>
                  </div>
                )}

                {/* Message text content */}
                <div className="whitespace-pre-line">{msg.text}</div>

                {/* Timestamp & checkmark footer */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isUser ? 'text-emerald-700' : 'text-stone-400'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {isUser && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
              </div>

              {/* User avatar (right) */}
              {isUser && (
                <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 mb-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator when AI is generating reply */}
        {isTyping && (
          <div className="flex items-end gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Sprout className="w-4 h-4" />
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-xs px-4 py-3 shadow-2xs flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          CHAT INPUT BAR (ATTACHMENT, TEXT, LIVE MIC, SEND)
          ───────────────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-stone-100 shrink-0">
        {/* Subtle non-breaking error notification if mic permission or connection fails */}
        {activeError && (
          <div className="flex items-center justify-between text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1 mb-1.5">
            <span>{activeError}</span>
            <button
              type="button"
              onClick={() => setLiveStatus('disconnected')}
              className="text-rose-500 hover:text-rose-800 text-xs font-bold ml-2 cursor-pointer"
              title="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200/90 rounded-full px-3 py-1.5 focus-within:border-emerald-500 focus-within:bg-white transition-all shadow-2xs">
          {/* File Attachment Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-colors cursor-pointer"
            title="Attach plant image"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              liveStatus === 'listening'
                ? 'Listening to your voice... (Live Speaking active)'
                : liveStatus === 'speaking'
                ? 'PlantTalk is speaking...'
                : 'Type your message or speak...'
            }
            className="flex-1 bg-transparent text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-hidden px-1"
          />

          {/* ONE LIVE SPEAKING BUTTON (Section 8.1 - 8.3) */}
          {(() => {
            const btn = getLiveButtonProps();
            return (
              <button
                type="button"
                onClick={toggleLiveSpeaking}
                aria-label={btn.label}
                title={btn.tooltip}
                className={btn.className}
              >
                {btn.icon}
              </button>
            );
          })()}

          {/* Send Button (Dedicated text message submit) */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim()}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white transition-all cursor-pointer active:scale-90 shrink-0 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Send Message"
            aria-label="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
