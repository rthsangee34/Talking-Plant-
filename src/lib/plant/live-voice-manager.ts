import { GeminiLiveConnection } from './realtime-connection';
import { useConversationStore } from '../../stores/plant/conversation-store';
import { useSettingsStore } from '../../stores/plant/settings-store';

class LiveVoiceManager {
  private static instance: LiveVoiceManager | null = null;
  private connection: GeminiLiveConnection | null = null;

  public static getInstance(): LiveVoiceManager {
    if (!LiveVoiceManager.instance) {
      LiveVoiceManager.instance = new LiveVoiceManager();
    }
    return LiveVoiceManager.instance;
  }

  public async startLiveSpeaking(): Promise<void> {
    const { preferredLanguage } = useSettingsStore.getState();
    const { setLiveStatus, addMessage } = useConversationStore.getState();

    // If already active, return
    if (this.connection) {
      return;
    }

    try {
      setLiveStatus('connecting');

      const connection = new GeminiLiveConnection({
        onStatusChange: (status, errorMsg) => {
          if (this.connection !== connection) return;
          setLiveStatus(status, errorMsg);
          if (status === 'disconnected' || status === 'error') {
            this.connection = null;
          }
        },
        onStreamingTranscript: (text, sender, isFinal, language) => {
          const { updateLiveTranscriptMessage } = useConversationStore.getState();
          updateLiveTranscriptMessage(sender, text, isFinal, language || preferredLanguage || 'mixed');
        },
        onTranscript: (text, sender, language) => {
          const { messages, addMessage } = useConversationStore.getState();
          const hasStream = messages.some((m) => m.id === `live-stream-${sender}`);
          if (!hasStream) {
            const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            addMessage({
              id: `live-${sender}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              sender,
              text,
              isVoice: true,
              timestamp: formattedTime,
              language: language || preferredLanguage || 'mixed',
            });
          }
        },
        onToolCall: (name, args, result) => {
          const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          addMessage({
            id: `tool-${Date.now()}`,
            sender: 'system',
            text: `Plant accessed telemetry tool '${name}'`,
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

      this.connection = connection;
      connection.setMuted(useConversationStore.getState().isMuted);
      await connection.connect();
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to start Live Speaking.';
      setLiveStatus('error', errMsg);
      this.connection = null;
    }
  }

  public stopLiveSpeaking(): void {
    if (this.connection) {
      useConversationStore.getState().setLiveStatus('stopping');
      this.connection.disconnect();
      this.connection = null;
    }
    useConversationStore.getState().setLiveStatus('disconnected');
  }

  public setMuted(muted: boolean): void {
    if (this.connection) {
      this.connection.setMuted(muted);
    }
    useConversationStore.getState().setIsMuted(muted);
  }

  public async toggleLiveSpeaking(): Promise<void> {
    const { liveStatus } = useConversationStore.getState();
    if (liveStatus === 'stopping') return;
    if (liveStatus === 'listening' || liveStatus === 'speaking' || liveStatus === 'connecting') {
      this.stopLiveSpeaking();
    } else {
      await this.startLiveSpeaking();
    }
  }

  public interrupt(): void {
    if (this.connection) {
      this.connection.interrupt();
    }
  }

  public isLiveActive(): boolean {
    const { liveStatus } = useConversationStore.getState();
    return liveStatus === 'listening' || liveStatus === 'speaking' || liveStatus === 'connecting';
  }
}

export const liveVoiceManager = LiveVoiceManager.getInstance();

export function useLiveVoiceSession() {
  const { liveStatus, activeError, isMuted } = useConversationStore();

  const isLiveActive =
    liveStatus === 'listening' || liveStatus === 'speaking' || liveStatus === 'connecting';

  return {
    liveStatus,
    activeError,
    isMuted,
    isLiveActive,
    startLiveSpeaking: () => liveVoiceManager.startLiveSpeaking(),
    stopLiveSpeaking: () => liveVoiceManager.stopLiveSpeaking(),
    toggleLiveSpeaking: () => liveVoiceManager.toggleLiveSpeaking(),
    setMuted: (muted: boolean) => liveVoiceManager.setMuted(muted),
    interrupt: () => liveVoiceManager.interrupt(),
  };
}
