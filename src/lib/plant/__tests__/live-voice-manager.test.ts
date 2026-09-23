import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { liveVoiceManager } from '../live-voice-manager';
import { useConversationStore } from '../../../stores/plant/conversation-store';
import { DEFAULT_GEMINI_FEMALE_VOICE, ALTERNATIVE_GEMINI_FEMALE_VOICE } from '../realtime-config';

describe('Gemini Live Voice Manager & Single Speaking Button System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useConversationStore.getState().clearMessages();
    useConversationStore.getState().setLiveStatus('disconnected');
  });

  afterEach(() => {
    liveVoiceManager.stopLiveSpeaking();
  });

  it('centralizes female voice configuration with Aoede as primary and Kore as alternative', () => {
    expect(DEFAULT_GEMINI_FEMALE_VOICE).toBe('Aoede');
    expect(ALTERNATIVE_GEMINI_FEMALE_VOICE).toBe('Kore');
  });

  it('starts in IDLE (disconnected) state', () => {
    const { liveStatus } = useConversationStore.getState();
    expect(liveStatus).toBe('disconnected');
    expect(liveVoiceManager.isLiveActive()).toBe(false);
  });

  it('handles microphone permission denial gracefully without crashing', async () => {
    // Mock navigator.mediaDevices.getUserMedia rejection
    const mockGetUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'));
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
      },
    });

    await liveVoiceManager.startLiveSpeaking();

    const { liveStatus, activeError } = useConversationStore.getState();
    expect(liveStatus).toBe('error');
    expect(activeError).toBe('Microphone permission is required for Live Speaking.');
    expect(liveVoiceManager.isLiveActive()).toBe(false);
  });

  it('stops live speaking and returns to disconnected state', () => {
    useConversationStore.getState().setLiveStatus('listening');
    expect(liveVoiceManager.isLiveActive()).toBe(true);

    liveVoiceManager.stopLiveSpeaking();
    expect(useConversationStore.getState().liveStatus).toBe('disconnected');
    expect(liveVoiceManager.isLiveActive()).toBe(false);
  });

  it('adds user voice transcript and plant response to unified conversation', () => {
    const { addMessage } = useConversationStore.getState();

    // Simulate user speaking in Tamil
    addMessage({
      id: 'voice-user-1',
      sender: 'user',
      text: 'வணக்கம், செடி எப்படி இருக்கு?',
      isVoice: true,
      timestamp: '10:30 AM',
      language: 'ta',
    });

    // Simulate plant responding in spoken Tamil
    addMessage({
      id: 'voice-plant-1',
      sender: 'plant',
      text: 'வணக்கம்! நான் நலமாக இருக்கிறேன். என் இலைகள் பசுமையாக இருக்கின்றன! 🌱',
      timestamp: '10:30 AM',
      language: 'ta',
    });

    const messages = useConversationStore.getState().messages;
    expect(messages.length).toBe(2);
    expect(messages[0].isVoice).toBe(true);
    expect(messages[0].text).toContain('வணக்கம்');
    expect(messages[1].sender).toBe('plant');
  });

  it('supports all required button states: IDLE, CONNECTING, LISTENING, SPEAKING, ERROR', () => {
    const { setLiveStatus } = useConversationStore.getState();

    // 1. IDLE
    setLiveStatus('disconnected');
    expect(useConversationStore.getState().liveStatus).toBe('disconnected');

    // 2. CONNECTING
    setLiveStatus('connecting');
    expect(useConversationStore.getState().liveStatus).toBe('connecting');

    // 3. LISTENING
    setLiveStatus('listening');
    expect(useConversationStore.getState().liveStatus).toBe('listening');

    // 4. SPEAKING
    setLiveStatus('speaking');
    expect(useConversationStore.getState().liveStatus).toBe('speaking');

    // 5. ERROR
    setLiveStatus('error', 'Microphone permission is required for Live Speaking.');
    expect(useConversationStore.getState().liveStatus).toBe('error');
    expect(useConversationStore.getState().activeError).toBe('Microphone permission is required for Live Speaking.');
  });
});
