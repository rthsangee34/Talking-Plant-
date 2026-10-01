import { LiveVoiceError } from '../types/liveVoice';

export type AudioChunkHandler = (pcm16Chunk: ArrayBuffer, mimeType: string) => void;

/**
 * MicrophoneProcessor
 * Captures live microphone audio, handles device constraints and permissions gracefully,
 * converts samples to PCM 16-bit mono 16 kHz, and streams chunks in real time.
 * Uses AudioWorklet with transparent fallback to ScriptProcessorNode.
 */
export class MicrophoneProcessor {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private silenceGain: GainNode | null = null;
  private workletBlobUrl: string | null = null;

  private isRunning = false;
  private isMuted = false;
  private onAudioChunk: AudioChunkHandler | null = null;

  /**
   * Request microphone permission and start continuous audio capture.
   */
  public async start(onAudioChunk: AudioChunkHandler): Promise<void> {
    if (this.isRunning) {
      this.stop();
    }

    this.onAudioChunk = onAudioChunk;

    // Check browser mediaDevices support
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      const err: LiveVoiceError = {
        code: 'UNSUPPORTED_BROWSER',
        message: 'Browser does not support microphone capture or requires a secure HTTPS connection.',
      };
      throw err;
    }

    // Step 1: Request permission and get MediaStream
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (micErr: any) {
      throw this.normalizeMicrophoneError(micErr);
    }

    // Step 2: Initialize Web Audio Context
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 16000 });

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.isRunning = true;

      // Step 3: Setup AudioWorklet or fallback to ScriptProcessor
      let workletInitialized = false;
      if (typeof this.audioCtx.audioWorklet?.addModule === 'function') {
        try {
          workletInitialized = await this.setupAudioWorklet();
        } catch (workletErr) {
          console.warn('[MicrophoneProcessor] AudioWorklet setup failed, falling back to ScriptProcessor:', workletErr);
          workletInitialized = false;
        }
      }

      if (!workletInitialized) {
        this.setupScriptProcessor();
      }
    } catch (initErr: any) {
      this.stop();
      if (initErr?.code) throw initErr;
      const err: LiveVoiceError = {
        code: 'MICROPHONE_UNAVAILABLE',
        message: initErr?.message || 'Could not initialize microphone audio pipeline.',
        originalError: initErr,
      };
      throw err;
    }
  }

  /**
   * Set up an inline AudioWorkletProcessor for high-performance audio conversion
   */
  private async setupAudioWorklet(): Promise<boolean> {
    if (!this.audioCtx || !this.sourceNode) return false;

    const workletCode = `
      class PlantTalkMicProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = 2048;
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;
        }

        process(inputs) {
          const input = inputs[0];
          if (!input || !input[0]) return true;
          const channelData = input[0];

          for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i];
            if (this.bufferIndex >= this.bufferSize) {
              const pcm16 = new Int16Array(this.bufferSize);
              for (let j = 0; j < this.bufferSize; j++) {
                const s = Math.max(-1, Math.min(1, this.buffer[j]));
                pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
              }
              this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
              this.bufferIndex = 0;
            }
          }
          return true;
        }
      }
      registerProcessor('plant-talk-mic-processor', PlantTalkMicProcessor);
    `;

    const blob = new Blob([workletCode], { type: 'application/javascript' });
    this.workletBlobUrl = URL.createObjectURL(blob);
    await this.audioCtx.audioWorklet.addModule(this.workletBlobUrl);

    this.workletNode = new AudioWorkletNode(this.audioCtx, 'plant-talk-mic-processor');
    const mimeType = 'audio/pcm;rate=' + this.audioCtx.sampleRate;

    this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (!this.isRunning || this.isMuted) return;
      this.onAudioChunk?.(event.data, mimeType);
    };

    this.silenceGain = this.audioCtx.createGain();
    this.silenceGain.gain.value = 0;

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.silenceGain);
    this.silenceGain.connect(this.audioCtx.destination);

    return true;
  }

  /**
   * Fallback using ScriptProcessorNode for environments without AudioWorklet
   */
  private setupScriptProcessor(): void {
    if (!this.audioCtx || !this.sourceNode) return;

    this.scriptProcessor = this.audioCtx.createScriptProcessor(2048, 1, 1);
    this.silenceGain = this.audioCtx.createGain();
    this.silenceGain.gain.value = 0;

    const mimeType = 'audio/pcm;rate=' + this.audioCtx.sampleRate;

    this.scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.isRunning || this.isMuted) return;
      const channelData = event.inputBuffer.getChannelData(0);
      const pcm16Buffer = this.convertFloat32ToPCM16(channelData);
      this.onAudioChunk?.(pcm16Buffer, mimeType);
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.silenceGain);
    this.silenceGain.connect(this.audioCtx.destination);
  }

  /**
   * Convert Float32 audio samples (-1.0 to 1.0) into 16-bit signed PCM ArrayBuffer
   */
  public convertFloat32ToPCM16(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  /**
   * Normalize WebRTC MediaDevices getUserMedia errors into user-friendly LiveVoiceError
   */
  public normalizeMicrophoneError(error: any): LiveVoiceError {
    const name = error?.name || '';
    const message = error?.message || '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || message.includes('denied')) {
      return {
        code: 'PERMISSION_DENIED',
        message: 'Microphone permission is required for voice mode. Please allow microphone access in your browser.',
        originalError: error,
      };
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || message.includes('not found')) {
      return {
        code: 'MICROPHONE_UNAVAILABLE',
        message: 'Microphone unavailable. No input audio device detected.',
        originalError: error,
      };
    }

    if (name === 'NotReadableError' || name === 'TrackStartError' || message.includes('in use')) {
      return {
        code: 'MICROPHONE_IN_USE',
        message: 'Microphone is already in use by another application or browser tab.',
        originalError: error,
      };
    }

    if (name === 'NotSupportedError') {
      return {
        code: 'UNSUPPORTED_BROWSER',
        message: 'Browser does not support microphone capture or requires HTTPS.',
        originalError: error,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error?.message || 'Unable to access microphone. Please check your browser audio settings.',
      originalError: error,
    };
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getSampleRate(): number {
    return this.audioCtx?.sampleRate || 16000;
  }

  /**
   * Stop audio capture and release all hardware and audio nodes completely
   */
  public stop(): void {
    this.isRunning = false;

    if (this.scriptProcessor) {
      this.scriptProcessor.onaudioprocess = null;
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      try {
        this.workletNode.disconnect();
      } catch {}
      this.workletNode = null;
    }

    if (this.silenceGain) {
      try {
        this.silenceGain.disconnect();
      } catch {}
      this.silenceGain = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }

    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    if (this.workletBlobUrl) {
      try {
        URL.revokeObjectURL(this.workletBlobUrl);
      } catch {}
      this.workletBlobUrl = null;
    }

    this.onAudioChunk = null;
  }
}
