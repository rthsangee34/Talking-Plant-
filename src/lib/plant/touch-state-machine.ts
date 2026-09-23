/**
 * Touch Event State Machine for PlantTalk
 * 
 * Implements a strict 6-stage state machine:
 * MONITORING -> TOUCH_CANDIDATE -> TOUCH_CONFIRMED -> WARNING_TRIGGERED -> WAITING_FOR_RELEASE -> RE_ARMED -> MONITORING
 * 
 * Guaranteed properties:
 * 1. Exactly ONE warning per separate touch event.
 * 2. Holding hand on plant remains in WAITING_FOR_RELEASE and NEVER fires duplicate warnings.
 * 3. Moving hand away and waiting for release threshold/debounce safely re-arms for the next touch.
 */

export type TouchState =
  | 'MONITORING'
  | 'TOUCH_CANDIDATE'
  | 'TOUCH_CONFIRMED'
  | 'WARNING_TRIGGERED'
  | 'WAITING_FOR_RELEASE'
  | 'RE_ARMED';

export interface TouchInputSignal {
  /** Level 1: True if any fingertip is intersecting the plant segmentation mask */
  isIntersectingMask: boolean;
  /** Level 2: Distance from closest fingertip to plant contour/boundary (normalized 0..1) */
  contourDistance: number;
  /** True if a hand is detected in the video frame (automatic personal space intrusion detection) */
  handDetected?: boolean;
  /** Proximity threshold for candidate touch consideration (normalized, default: 0.25) */
  candidateProximityThreshold?: number;
  /** Current timestamp (ms) */
  timestamp: number;
  /** Optional metadata: touching fingertips */
  touchingFingertips?: string[];
}

export interface TouchStateMachineConfig {
  /** Consecutive candidate frames needed to confirm a touch (default: 2) */
  confirmationFrames: number;
  /** Consecutive clear frames required to confirm release (default: 2) */
  releaseFrames: number;
  /** Proximity threshold under which a candidate touch is signaled (default: 0.25) */
  candidateDistanceThreshold: number;
  /** Distance (normalized) beyond which hand is considered released (default: 0.35) */
  releaseDistanceThreshold: number;
  /** Debounce delay (ms) in RE_ARMED state before returning to MONITORING (default: 300) */
  debounceMs: number;
}

export const DEFAULT_TOUCH_CONFIG: TouchStateMachineConfig = {
  confirmationFrames: 1,
  releaseFrames: 2,
  candidateDistanceThreshold: 0.08,
  releaseDistanceThreshold: 0.10,
  debounceMs: 300,
};

export interface TouchWarningEvent {
  touchId: string;
  timestamp: number;
  touchingFingertips: string[];
  durationBeforeConfirmationMs: number;
}

export interface TouchStateMachineCallbacks {
  onCandidate?: (framesCount: number) => void;
  onConfirmed?: () => void;
  onWarningTriggered?: (event: TouchWarningEvent) => void;
  onReleased?: () => void;
  onReArmed?: () => void;
  onStateChange?: (previousState: TouchState, newState: TouchState) => void;
}

export class TouchStateMachine {
  private state: TouchState = 'MONITORING';
  private config: TouchStateMachineConfig;
  private candidateFramesCount = 0;
  private releaseFramesCount = 0;
  private candidateStartTime = 0;
  private lastReleaseTime = 0;
  private currentTouchId = '';
  private currentTouchingFingertips: string[] = [];

  constructor(config?: Partial<TouchStateMachineConfig>) {
    this.config = { ...DEFAULT_TOUCH_CONFIG, ...config };
  }

  public getState(): TouchState {
    return this.state;
  }

  public getCandidateFramesCount(): number {
    return this.candidateFramesCount;
  }

  public getReleaseFramesCount(): number {
    return this.releaseFramesCount;
  }

  public reset(): void {
    this.state = 'MONITORING';
    this.candidateFramesCount = 0;
    this.releaseFramesCount = 0;
    this.candidateStartTime = 0;
    this.lastReleaseTime = 0;
    this.currentTouchId = '';
    this.currentTouchingFingertips = [];
  }

  /**
   * Process an incoming frame signal.
   * Returns current state after transition.
   */
  public processFrame(
    signal: TouchInputSignal,
    callbacks?: TouchStateMachineCallbacks
  ): TouchState {
    const prev = this.state;
    const now = signal.timestamp || Date.now();

    // Determine if candidate criteria are met (Level 1: mask intersection OR Level 2: contour distance < threshold OR hand detected)
    const candThreshold = signal.candidateProximityThreshold ?? this.config.candidateDistanceThreshold;
    const isTouchConditionMet =
      signal.handDetected === true ||
      signal.isIntersectingMask ||
      signal.contourDistance <= candThreshold;

    switch (this.state) {
      case 'MONITORING': {
        if (isTouchConditionMet) {
          this.state = 'TOUCH_CANDIDATE';
          this.candidateFramesCount = 1;
          this.candidateStartTime = now;
          this.currentTouchingFingertips = signal.touchingFingertips || [];
          callbacks?.onCandidate?.(this.candidateFramesCount);
          callbacks?.onStateChange?.(prev, this.state);

          // If threshold is 1 frame, confirm and trigger warning immediately
          if (this.candidateFramesCount >= this.config.confirmationFrames) {
            const candState = this.state;
            this.state = 'TOUCH_CONFIRMED';
            callbacks?.onStateChange?.(candState, this.state);
            callbacks?.onConfirmed?.();

            const confirmedState = this.state;
            this.state = 'WARNING_TRIGGERED';
            this.currentTouchId = `touch_${now}_${Math.random().toString(36).substring(2, 7)}`;
            callbacks?.onStateChange?.(confirmedState, this.state);

            const warningEvent: TouchWarningEvent = {
              touchId: this.currentTouchId,
              timestamp: now,
              touchingFingertips: [...this.currentTouchingFingertips],
              durationBeforeConfirmationMs: 0,
            };
            callbacks?.onWarningTriggered?.(warningEvent);

            const warningState = this.state;
            this.state = 'WAITING_FOR_RELEASE';
            this.releaseFramesCount = 0;
            callbacks?.onStateChange?.(warningState, this.state);
          }
        }
        break;
      }

      case 'TOUCH_CANDIDATE': {
        if (isTouchConditionMet) {
          this.candidateFramesCount++;
          if (signal.touchingFingertips && signal.touchingFingertips.length > 0) {
            this.currentTouchingFingertips = signal.touchingFingertips;
          }
          callbacks?.onCandidate?.(this.candidateFramesCount);

          // Check if candidate frames reached confirmation threshold
          if (this.candidateFramesCount >= this.config.confirmationFrames) {
            this.state = 'TOUCH_CONFIRMED';
            callbacks?.onStateChange?.(prev, this.state);
            callbacks?.onConfirmed?.();

            // Immediately transition to WARNING_TRIGGERED
            const confirmedState = this.state;
            this.state = 'WARNING_TRIGGERED';
            this.currentTouchId = `touch_${now}_${Math.random().toString(36).substring(2, 7)}`;
            callbacks?.onStateChange?.(confirmedState, this.state);

            const warningEvent: TouchWarningEvent = {
              touchId: this.currentTouchId,
              timestamp: now,
              touchingFingertips: [...this.currentTouchingFingertips],
              durationBeforeConfirmationMs: now - this.candidateStartTime,
            };
            callbacks?.onWarningTriggered?.(warningEvent);

            // Automatically transition into WAITING_FOR_RELEASE so warning never repeats for this touch
            const warningState = this.state;
            this.state = 'WAITING_FOR_RELEASE';
            this.releaseFramesCount = 0;
            callbacks?.onStateChange?.(warningState, this.state);
          }
        } else {
          // Touch dropped before confirmation threshold -> revert to MONITORING
          this.state = 'MONITORING';
          this.candidateFramesCount = 0;
          this.currentTouchingFingertips = [];
          callbacks?.onStateChange?.(prev, this.state);
        }
        break;
      }

      case 'TOUCH_CONFIRMED':
      case 'WARNING_TRIGGERED': {
        // Immediate transient state guard: ensure we move to WAITING_FOR_RELEASE
        this.state = 'WAITING_FOR_RELEASE';
        this.releaseFramesCount = 0;
        callbacks?.onStateChange?.(prev, this.state);
        break;
      }

      case 'WAITING_FOR_RELEASE': {
        // In WAITING_FOR_RELEASE, hand is still touching or near plant.
        // DO NOT TRIGGER REPEATED WARNINGS!
        const isHandClearlyReleased =
          !signal.handDetected &&
          !signal.isIntersectingMask &&
          signal.contourDistance > this.config.releaseDistanceThreshold;

        if (isHandClearlyReleased) {
          this.releaseFramesCount++;
          if (this.releaseFramesCount >= this.config.releaseFrames) {
            this.state = 'RE_ARMED';
            this.lastReleaseTime = now;
            callbacks?.onStateChange?.(prev, this.state);
            callbacks?.onReleased?.();
          }
        } else {
          // Hand is still touching or close, reset release counter
          this.releaseFramesCount = 0;
        }
        break;
      }

      case 'RE_ARMED': {
        // Debounce window before transitioning back to MONITORING
        // If hand suddenly touches again within debounce, stay guarded or evaluate
        if (isTouchConditionMet) {
          // Sudden re-touch right as releasing: wait for clean release
          this.state = 'WAITING_FOR_RELEASE';
          this.releaseFramesCount = 0;
          callbacks?.onStateChange?.(prev, this.state);
        } else if (now - this.lastReleaseTime >= this.config.debounceMs) {
          this.state = 'MONITORING';
          this.candidateFramesCount = 0;
          this.releaseFramesCount = 0;
          this.currentTouchId = '';
          callbacks?.onReArmed?.();
          callbacks?.onStateChange?.(prev, this.state);
        }
        break;
      }
    }

    return this.state;
  }
}
