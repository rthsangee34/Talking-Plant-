import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useConversationStore } from '../../../stores/plant/conversation-store';
import { liveVoiceManager } from '../live-voice-manager';

describe('Start Speak Button State Machine & Live Voice Session', () => {
  beforeEach(() => {
    useConversationStore.setState({
      liveStatus: 'disconnected',
      activeError: null,
      messages: [],
    });
  });

  afterEach(() => {
    liveVoiceManager.stopLiveSpeaking();
    vi.clearAllMocks();
  });

  it('initial state is idle / disconnected', () => {
    const { liveStatus } = useConversationStore.getState();
    expect(liveStatus).toBe('disconnected');
  });

  it('updates state machine through all voice phases: connecting -> listening -> speaking -> stopping -> disconnected', () => {
    const { setLiveStatus } = useConversationStore.getState();

    // 1. User clicks Start Speak -> Connecting
    setLiveStatus('connecting');
    expect(useConversationStore.getState().liveStatus).toBe('connecting');
    expect(useConversationStore.getState().isVoiceMode).toBe(true);

    // 2. Gemini Live connects -> Listening
    setLiveStatus('listening');
    expect(useConversationStore.getState().liveStatus).toBe('listening');
    expect(useConversationStore.getState().isListening).toBe(true);

    // 3. Plant speaks -> Speaking
    setLiveStatus('speaking');
    expect(useConversationStore.getState().liveStatus).toBe('speaking');

    // 4. Plant finishes speaking -> Returns to Listening
    setLiveStatus('listening');
    expect(useConversationStore.getState().liveStatus).toBe('listening');

    // 5. User clicks Stop -> Stopping
    setLiveStatus('stopping');
    expect(useConversationStore.getState().liveStatus).toBe('stopping');

    // 6. Complete cleanup -> Disconnected (Idle)
    setLiveStatus('disconnected');
    expect(useConversationStore.getState().liveStatus).toBe('disconnected');
    expect(useConversationStore.getState().isVoiceMode).toBe(false);
  });

  it('streams partial transcripts without creating duplicate messages', () => {
    const { updateLiveTranscriptMessage } = useConversationStore.getState();

    // Step 1: User starts speaking
    updateLiveTranscriptMessage('user', 'Should I water', false, 'en');
    let messages = useConversationStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe('Should I water');
    expect(messages[0].id).toBe('live-stream-user');

    // Step 2: User continues speaking
    updateLiveTranscriptMessage('user', 'Should I water my plant now?', false, 'en');
    messages = useConversationStore.getState().messages;
    expect(messages).toHaveLength(1); // STILL ONE MESSAGE!
    expect(messages[0].text).toBe('Should I water my plant now?');

    // Step 3: Turn finishes and commits final user transcript
    updateLiveTranscriptMessage('user', 'Should I water my plant now?', true, 'en');
    messages = useConversationStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).not.toBe('live-stream-user'); // Committed permanent ID

    // Step 4: Assistant responds with stream
    updateLiveTranscriptMessage('plant', 'No, the soil', false, 'en');
    messages = useConversationStore.getState().messages;
    expect(messages).toHaveLength(2); // 1 user + 1 streaming plant
    expect(messages[1].text).toBe('No, the soil');
    expect(messages[1].id).toBe('live-stream-plant');

    // Step 5: Assistant finishes and commits
    updateLiveTranscriptMessage('plant', 'No, the soil moisture is currently healthy.', true, 'en');
    messages = useConversationStore.getState().messages;
    expect(messages).toHaveLength(2);
    expect(messages[1].text).toBe('No, the soil moisture is currently healthy.');
    expect(messages[1].id).not.toBe('live-stream-plant');
  });

  it('stores friendly error message when microphone is denied without crashing', () => {
    const { setLiveStatus } = useConversationStore.getState();
    setLiveStatus('error', 'Microphone permission is required for voice mode.');

    const state = useConversationStore.getState();
    expect(state.liveStatus).toBe('error');
    expect(state.activeError).toBe('Microphone permission is required for voice mode.');
  });
});
