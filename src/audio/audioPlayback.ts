/**
 * AudioPlayback
 * Manages native Gemini Live audio queue and scheduled playback using Web Audio API.
 * Ensures chunk order, gapless playback, interruption clearing, and clean resource lifecycle.
 */
export class AudioPlayback {
  private audioCtx: AudioContext | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;
  private isPlaying = false;
  private onPlaybackStateChange: ((isPlaying: boolean) => void) | null = null;

  constructor(onPlaybackStateChange?: (isPlaying: boolean) => void) {
    if (onPlaybackStateChange) {
      this.onPlaybackStateChange = onPlaybackStateChange;
    }
  }

  /**
   * Ensure AudioContext is initialized and resumed (must be called during/after user gesture)
   */
  public async ensureAudioContext(): Promise<AudioContext> {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    return this.audioCtx;
  }

  /**
   * Enqueue a PCM 16-bit audio chunk (either base64 string or ArrayBuffer) for seamless scheduled playback.
   */
  public async playChunk(chunk: string | ArrayBuffer): Promise<void> {
    const context = await this.ensureAudioContext();

    let bytes: Uint8Array;
    if (typeof chunk === 'string') {
      const binaryString = atob(chunk);
      bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } else {
      bytes = new Uint8Array(chunk);
    }

    if (bytes.length < 2) return;

    const sampleCount = Math.floor(bytes.length / 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const audioBuffer = context.createBuffer(1, sampleCount, 24000);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < sampleCount; i++) {
      channelData[i] = view.getInt16(i * 2, true) / 32768;
    }

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);

    this.activeSources.push(source);

    // Track playback state
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.onPlaybackStateChange?.(true);
    }

    source.onended = () => {
      try {
        source.disconnect();
      } catch {}
      this.activeSources = this.activeSources.filter((s) => s !== source);

      if (this.activeSources.length === 0) {
        this.isPlaying = false;
        this.onPlaybackStateChange?.(false);
      }
    };

    // Calculate gapless scheduled start time
    const currentTime = context.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
  }

  /**
   * Immediately stops all currently playing and queued audio (Barge-in / Interruption).
   */
  public stop(): void {
    for (const source of this.activeSources) {
      source.onended = null;
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }

    this.activeSources = [];
    this.nextStartTime = this.audioCtx ? this.audioCtx.currentTime : 0;

    if (this.isPlaying) {
      this.isPlaying = false;
      this.onPlaybackStateChange?.(false);
    }
  }

  /**
   * Returns whether audio is currently playing or queued.
   */
  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Release Web Audio Context and all queued resources.
   */
  public close(): void {
    this.stop();
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.onPlaybackStateChange = null;
  }
}
