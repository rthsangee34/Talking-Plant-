import { useEffect, useCallback } from 'react';
import { geminiLiveService } from '../services/geminiLiveService';
import { useConversationStore } from '../stores/plant/conversation-store';
import { LiveVoiceState } from '../types/liveVoice';

/**
 * useGeminiLive
 * React hook connecting components to the real-time Gemini Live Voice Service.
 * Manages Start Speak button states, user/plant streaming transcripts,
 * barge-in interruption, and automatic unmount cleanup.
 */
export function useGeminiLive() {
  const {
    liveStatus,
    activeError,
    isMuted,
    setLiveStatus,
    updateLiveTranscriptMessage,
    addMessage,
  } = useConversationStore();

  const isLiveActive =
    liveStatus === 'connecting' ||
    liveStatus === 'listening' ||
    liveStatus === 'speaking';

  // Synchronize callbacks from geminiLiveService into conversation store
  useEffect(() => {
    geminiLiveService.setCallbacks({
      onStateChange: (state: LiveVoiceState, errorMessage?: string) => {
        setLiveStatus(state, errorMessage);
      },

      onUserTranscript: (text: string, isFinal: boolean, language?: 'en' | 'ta' | 'mixed') => {
        updateLiveTranscriptMessage('user', text, isFinal, language);
      },

      onAssistantTranscript: (text: string, isFinal: boolean, language?: 'en' | 'ta' | 'mixed') => {
        updateLiveTranscriptMessage('plant', text, isFinal, language);
      },

      onToolCall: (name: string, args: Record<string, unknown>, result: Record<string, unknown>) => {
        const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        addMessage({
          id: `tool-${Date.now()}`,
          sender: 'system',
          text: `Plant accessed telemetry '${name}'`,
          timestamp: formattedTime,
          toolCalls: [
            {
              id: `tc-${Date.now()}`,
              name,
              args,
              result,
              timestamp: formattedTime,
            },
          ],
        });
      },
    });

    // Cleanup on page / component unmount: release microphone and disconnect
    return () => {
      if (geminiLiveService.isLiveActive()) {
        geminiLiveService.disconnect();
      }
    };
  }, [setLiveStatus, updateLiveTranscriptMessage, addMessage]);

  const startLiveSpeaking = useCallback(async () => {
    try {
      await geminiLiveService.connect();
    } catch {
      // Handled via onStateChange error callback
    }
  }, []);

  const stopLiveSpeaking = useCallback(() => {
    geminiLiveService.disconnect();
  }, []);

  const toggleLiveSpeaking = useCallback(async () => {
    if (geminiLiveService.isLiveActive()) {
      stopLiveSpeaking();
    } else {
      await startLiveSpeaking();
    }
  }, [startLiveSpeaking, stopLiveSpeaking]);

  const interrupt = useCallback(() => {
    geminiLiveService.interrupt();
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    geminiLiveService.setMuted(muted);
    useConversationStore.getState().setIsMuted(muted);
  }, []);

  return {
    liveStatus,
    activeError,
    isMuted,
    isLiveActive,
    startLiveSpeaking,
    stopLiveSpeaking,
    toggleLiveSpeaking,
    interrupt,
    setMuted,
  };
}
