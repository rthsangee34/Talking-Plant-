import { GeminiLiveConnection } from './realtime-connection';
import { useConversationStore } from '../../stores/plant/conversation-store';
import { useSettingsStore } from '../../stores/plant/settings-store';

class LiveVoiceManager {
  private static instance: LiveVoiceManager | null = null;
  private connection: GeminiLiveConnection | null = null;
  private activeTurnId: string | null = null;
  private activeTurnSender: 'user' | 'plant' | null = null;
  private accumulatedText: string = '';
  private turnFinalizeTimer: ReturnType<typeof setTimeout> | null = null;

  public static getInstance(): LiveVoiceManager {
    if (!LiveVoiceManager.instance) {
      LiveVoiceManager.instance = new LiveVoiceManager();
    }
    return LiveVoiceManager.instance;
  }

  private finalizeCurrentTurn(): void {
    if (this.turnFinalizeTimer) {
      clearTimeout(this.turnFinalizeTimer);
      this.turnFinalizeTimer = null;
    }
    this.activeTurnId = null;
    this.activeTurnSender = null;
    this.accumulatedText = '';
  }

  private handleTranscriptChunk(
    chunkText: string,
    sender: 'user' | 'plant',
    language?: 'en' | 'ta' | 'mixed'
  ): void {
    if (!chunkText) return;

    const { addMessage, updateMessageText } = useConversationStore.getState();
    const { preferredLanguage } = useSettingsStore.getState();

    // If speaker switched from previous active turn, finalize previous turn first
    if (this.activeTurnSender && this.activeTurnSender !== sender) {
      this.finalizeCurrentTurn();
    }

    // Reset silence debounce timer: finalize turn after 2.2s of inactivity
    if (this.turnFinalizeTimer) {
      clearTimeout(this.turnFinalizeTimer);
    }
    this.turnFinalizeTimer = setTimeout(() => {
      this.finalizeCurrentTurn();
    }, 2200);

    // If we have an active speaking turn for this sender, append chunk to build complete sentence/paragraph
    if (this.activeTurnId && this.activeTurnSender === sender) {
      let nextText = this.accumulatedText;
      const incoming = chunkText;

      // Add space between words if incoming chunk lacks leading whitespace or punctuation
      if (
        nextText.length > 0 &&
        !nextText.endsWith(' ') &&
        !nextText.endsWith('\n') &&
        !incoming.startsWith(' ') &&
        !incoming.startsWith('\n') &&
        !/^[.,!?;:'")\]}]/.test(incoming)
      ) {
        nextText += ' ';
      }
      nextText += incoming;
      this.accumulatedText = nextText;
      updateMessageText(this.activeTurnId, this.accumulatedText);
    } else {
      // Start a new sentence/paragraph message for this speaker turn
      const turnId = `live-${sender}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.activeTurnId = turnId;
      this.activeTurnSender = sender;
      this.accumulatedText = chunkText.trimStart();

      addMessage({
        id: turnId,
        sender,
        text: this.accumulatedText,
        isVoice: true,
        timestamp: formattedTime,
        language: language || preferredLanguage || 'mixed',
      });
    }
  }

  public async startLiveSpeaking(): Promise<void> {
    const { setLiveStatus, addMessage, setAudioLevel } = useConversationStore.getState();

    // If already active, return
    if (this.connection) {
      return;
    }

    try {
      setLiveStatus('connecting');

      this.connection = new GeminiLiveConnection({
        onStatusChange: (status, errorMsg) => {
          setLiveStatus(status, errorMsg);
          if (status === 'disconnected') {
            this.finalizeCurrentTurn();
            this.connection = null;
            setAudioLevel(0);
          } else if (status === 'listening' && this.activeTurnSender === 'plant') {
            this.finalizeCurrentTurn();
          }
        },
        onAudioLevel: (level) => {
          setAudioLevel(level);
        },
        onTranscript: (text, sender, language) => {
          this.handleTranscriptChunk(text, sender, language);
        },
        onTurnComplete: () => {
          this.finalizeCurrentTurn();
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

      await this.connection.connect();
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to start Live Speaking.';
      setLiveStatus('error', errMsg);
      this.finalizeCurrentTurn();
      this.connection = null;
      setAudioLevel(0);
    }
  }

  public stopLiveSpeaking(): void {
    this.finalizeCurrentTurn();
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }
    useConversationStore.getState().setLiveStatus('disconnected');
    useConversationStore.getState().setAudioLevel(0);
  }

  public async toggleLiveSpeaking(): Promise<void> {
    const { liveStatus } = useConversationStore.getState();
    if (liveStatus === 'listening' || liveStatus === 'speaking' || liveStatus === 'connecting') {
      this.stopLiveSpeaking();
    } else {
      await this.startLiveSpeaking();
    }
  }

  public isLiveActive(): boolean {
    const { liveStatus } = useConversationStore.getState();
    return liveStatus === 'listening' || liveStatus === 'speaking' || liveStatus === 'connecting';
  }

  public toggleMute(): void {
    const currentMute = useConversationStore.getState().isMuted;
    const nextMute = !currentMute;
    useConversationStore.getState().setIsMuted(nextMute);
    if (this.connection) {
      this.connection.setMuted(nextMute);
    }
  }

  public setMuted(muted: boolean): void {
    useConversationStore.getState().setIsMuted(muted);
    if (this.connection) {
      this.connection.setMuted(muted);
    }
  }
}

export const liveVoiceManager = LiveVoiceManager.getInstance();

export function useLiveVoiceSession() {
  const { liveStatus, activeError, audioLevel, isMuted } = useConversationStore();

  const isLiveActive =
    liveStatus === 'listening' || liveStatus === 'speaking' || liveStatus === 'connecting';

  return {
    liveStatus,
    activeError,
    audioLevel,
    isMuted,
    isLiveActive,
    startLiveSpeaking: () => liveVoiceManager.startLiveSpeaking(),
    stopLiveSpeaking: () => liveVoiceManager.stopLiveSpeaking(),
    toggleLiveSpeaking: () => liveVoiceManager.toggleLiveSpeaking(),
    toggleMute: () => liveVoiceManager.toggleMute(),
    setMuted: (muted: boolean) => liveVoiceManager.setMuted(muted),
  };
}
