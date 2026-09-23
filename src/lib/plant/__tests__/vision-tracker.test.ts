import { describe, it, expect, vi } from 'vitest';
import {
  createInitialTrackerState,
  processProtectionFrame,
  detectPlantCandidateFromImageData,
  evaluatePlantStability,
  calculateFingertipsToPlant,
  REQUIRED_HOLD_FRAMES,
  REQUIRED_EXIT_MS,
  SESSION_RESET_MS,
} from '../vision-tracker';

describe('Protection Mode Tracking State Machine', () => {
  it('confirms initial touch after REQUIRED_HOLD_FRAMES (5 frames)', () => {
    const state = createInitialTrackerState();
    const callbacks = {
      onConfirmedTouch: vi.fn(),
      incrementInteraction: vi.fn(),
      resetInteractionCount: vi.fn(),
    };

    let time = 10000;

    // First 4 frames: accumulating frames
    for (let i = 1; i < REQUIRED_HOLD_FRAMES; i++) {
      time += 60;
      processProtectionFrame(state, true, time, callbacks);
      expect(state.touchFramesCount).toBe(i);
      expect(state.isCurrentlyTouching).toBe(false);
      expect(callbacks.incrementInteraction).not.toHaveBeenCalled();
      expect(callbacks.onConfirmedTouch).not.toHaveBeenCalled();
    }

    // 5th frame: confirmed touch!
    time += 60;
    processProtectionFrame(state, true, time, callbacks);
    expect(state.touchFramesCount).toBe(REQUIRED_HOLD_FRAMES);
    expect(state.isCurrentlyTouching).toBe(true);
    expect(callbacks.incrementInteraction).toHaveBeenCalledTimes(1);
    expect(callbacks.onConfirmedTouch).toHaveBeenCalledWith('initial');
  });

  it('filters out brief transient glitches (< 5 frames)', () => {
    const state = createInitialTrackerState();
    const callbacks = {
      onConfirmedTouch: vi.fn(),
      incrementInteraction: vi.fn(),
      resetInteractionCount: vi.fn(),
    };

    let time = 10000;
    // 2 frames in zone
    processProtectionFrame(state, true, time, callbacks);
    processProtectionFrame(state, true, time + 60, callbacks);
    expect(state.touchFramesCount).toBe(2);

    // Hand leaves
    processProtectionFrame(state, false, time + 120, callbacks);
    expect(state.touchFramesCount).toBe(0);
    expect(state.isCurrentlyTouching).toBe(false);
    expect(callbacks.incrementInteraction).not.toHaveBeenCalled();
  });

  it('tolerates up to 2 dropped detection frames during an active hold without dropping touch', () => {
    const state = createInitialTrackerState();
    const callbacks = {
      onConfirmedTouch: vi.fn(),
      incrementInteraction: vi.fn(),
      resetInteractionCount: vi.fn(),
    };

    let time = 10000;
    // 5 frames to confirm touch
    for (let i = 0; i < REQUIRED_HOLD_FRAMES; i++) {
      time += 60;
      processProtectionFrame(state, true, time, callbacks);
    }
    expect(state.isCurrentlyTouching).toBe(true);

    // 1 dropped frame (model jitter)
    time += 60;
    processProtectionFrame(state, false, time, callbacks);
    expect(state.isCurrentlyTouching).toBe(true);
    expect(state.missedFramesCount).toBe(1);

    // 2nd dropped frame
    time += 60;
    processProtectionFrame(state, false, time, callbacks);
    expect(state.isCurrentlyTouching).toBe(true);
    expect(state.missedFramesCount).toBe(2);

    // Hand detected again: recovers smoothly
    time += 60;
    processProtectionFrame(state, true, time, callbacks);
    expect(state.isCurrentlyTouching).toBe(true);
    expect(state.missedFramesCount).toBe(0);
  });

  it('escalates to continuous-3s and continuous-6s during prolonged hold', () => {
    const state = createInitialTrackerState();
    const callbacks = {
      onConfirmedTouch: vi.fn(),
      incrementInteraction: vi.fn(),
      resetInteractionCount: vi.fn(),
    };

    let time = 10000;
    // Reach confirmed touch
    for (let i = 0; i < REQUIRED_HOLD_FRAMES; i++) {
      time += 60;
      processProtectionFrame(state, true, time, callbacks);
    }
    expect(callbacks.onConfirmedTouch).toHaveBeenCalledWith('initial');

    // Advance 3100ms
    time += 3100;
    processProtectionFrame(state, true, time, callbacks);
    expect(callbacks.onConfirmedTouch).toHaveBeenCalledWith('continuous-3s');

    // Advance to 6200ms
    time += 3100;
    processProtectionFrame(state, true, time, callbacks);
    expect(callbacks.onConfirmedTouch).toHaveBeenCalledWith('continuous-6s');

    // interactionCount was only incremented once for the initial touch
    expect(callbacks.incrementInteraction).toHaveBeenCalledTimes(1);
  });

  it('enforces exit cooldown before allowing a subsequent touch event', () => {
    const state = createInitialTrackerState();
    const callbacks = {
      onConfirmedTouch: vi.fn(),
      incrementInteraction: vi.fn(),
      resetInteractionCount: vi.fn(),
    };

    let time = 10000;
    // Confirm first touch
    for (let i = 0; i < REQUIRED_HOLD_FRAMES; i++) {
      time += 60;
      processProtectionFrame(state, true, time, callbacks);
    }
    expect(callbacks.incrementInteraction).toHaveBeenCalledTimes(1);

    // Hand leaves zone (exceeding tolerance so exit is registered)
    time += 100;
    processProtectionFrame(state, false, time, callbacks);
    time += 100;
    processProtectionFrame(state, false, time, callbacks);
    time += 100;
    processProtectionFrame(state, false, time, callbacks);
    expect(state.isCurrentlyTouching).toBe(false);
    expect(state.lastExitTime).toBe(time);

    const exitTime = time;

    // Hand re-enters too quickly (e.g. 500ms after exit < REQUIRED_EXIT_MS of 1200ms)
    time = exitTime + 500;
    for (let i = 0; i < REQUIRED_HOLD_FRAMES + 2; i++) {
      time += 60;
      processProtectionFrame(state, true, time, callbacks);
    }
    // Should NOT have confirmed a second touch yet because exit cooldown wasn't met
    expect(callbacks.incrementInteraction).toHaveBeenCalledTimes(1);

    // Hand exits again and waits 1500ms (> REQUIRED_EXIT_MS)
    time += 100;
    processProtectionFrame(state, false, time, callbacks);
    processProtectionFrame(state, false, time + 60, callbacks);
    processProtectionFrame(state, false, time + 120, callbacks);
    const validExitTime = time + 120;

    // Now re-enter after REQUIRED_EXIT_MS has elapsed
    time = validExitTime + REQUIRED_EXIT_MS + 200;
    for (let i = 0; i < REQUIRED_HOLD_FRAMES; i++) {
      time += 60;
      processProtectionFrame(state, true, time, callbacks);
    }

    // Now second touch is confirmed!
    expect(callbacks.incrementInteraction).toHaveBeenCalledTimes(2);
  });

  it('resets session after 10 minutes of inactivity', () => {
    const state = createInitialTrackerState();
    const callbacks = {
      onConfirmedTouch: vi.fn(),
      incrementInteraction: vi.fn(),
      resetInteractionCount: vi.fn(),
    };

    let time = 10000;
    for (let i = 0; i < REQUIRED_HOLD_FRAMES; i++) {
      time += 60;
      processProtectionFrame(state, true, time, callbacks);
    }
    expect(callbacks.incrementInteraction).toHaveBeenCalledTimes(1);

    // Fast forward 11 minutes
    time += SESSION_RESET_MS + 60000;
    processProtectionFrame(state, false, time, callbacks);

    expect(callbacks.resetInteractionCount).toHaveBeenCalledTimes(1);
    expect(state.lastTouchTime).toBe(0);
  });
});

describe('Plant Object Detection & Target Lock', () => {
  it('detects plant candidate bounding box from green foliage pixels', () => {
    // 100x100 canvas (10,000 pixels = 40,000 bytes)
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);

    // Paint a 40x40 green block in the center (x: 30..70, y: 30..70)
    for (let y = 30; y < 70; y++) {
      for (let x = 30; x < 70; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 30;     // R
        data[idx + 1] = 160; // G (chlorophyll green)
        data[idx + 2] = 40;  // B
        data[idx + 3] = 255; // A
      }
    }

    const candidate = detectPlantCandidateFromImageData(data, width, height);
    expect(candidate).not.toBeNull();
    if (candidate) {
      // Bounding box should span approximately around 0.30 to 0.70 with padding
      expect(candidate.xMin).toBeLessThanOrEqual(0.30);
      expect(candidate.xMax).toBeGreaterThanOrEqual(0.67);
      expect(candidate.yMin).toBeLessThanOrEqual(0.30);
      expect(candidate.yMax).toBeGreaterThanOrEqual(0.67);
    }
  });

  it('detects variegated pink/red foliage (e.g. Aglaonema / Caladium)', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);

    // Paint variegated red/pink foliage (x: 20..60, y: 20..60)
    for (let y = 20; y < 60; y++) {
      for (let x = 20; x < 60; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = 160;    // R > 70
        data[idx + 1] = 65; // G > 35
        data[idx + 2] = 50; // B > 30
        data[idx + 3] = 255;
      }
    }

    const candidate = detectPlantCandidateFromImageData(data, width, height);
    expect(candidate).not.toBeNull();
  });

  it('returns null if foliage pixels are below the 2% threshold', () => {
    const width = 100;
    const height = 100;
    const data = new Uint8ClampedArray(width * height * 4);

    // Only 10 green pixels (< 0.1% of image)
    for (let i = 0; i < 10; i++) {
      data[i * 4] = 20;
      data[i * 4 + 1] = 180;
      data[i * 4 + 2] = 30;
      data[i * 4 + 3] = 255;
    }

    const candidate = detectPlantCandidateFromImageData(data, width, height);
    expect(candidate).toBeNull();
  });

  it('evaluates multi-frame stability and locks target plant when stable', () => {
    const history: Array<{ xMin: number; xMax: number; yMin: number; yMax: number }> = [
      { xMin: 0.10, xMax: 0.90, yMin: 0.10, yMax: 0.90 },
      { xMin: 0.11, xMax: 0.89, yMin: 0.11, yMax: 0.89 },
      { xMin: 0.10, xMax: 0.90, yMin: 0.10, yMax: 0.90 },
      { xMin: 0.10, xMax: 0.91, yMin: 0.10, yMax: 0.90 },
    ];

    const newCandidate = { xMin: 0.10, xMax: 0.90, yMin: 0.10, yMax: 0.90 };
    const result = evaluatePlantStability(history, newCandidate);

    expect(result.isLocked).toBe(true);
    expect(result.stabilityScore).toBeGreaterThanOrEqual(85);
    expect(result.stableBounds.xMin).toBeCloseTo(0.10, 2);
    expect(result.stableBounds.xMax).toBeCloseTo(0.90, 2);
  });

  it('falls back gracefully to previous bounds when a candidate frame is null', () => {
    const history = [
      { xMin: 0.15, xMax: 0.85, yMin: 0.15, yMax: 0.85 },
      { xMin: 0.15, xMax: 0.85, yMin: 0.15, yMax: 0.85 },
      { xMin: 0.15, xMax: 0.85, yMin: 0.15, yMax: 0.85 },
      { xMin: 0.15, xMax: 0.85, yMin: 0.15, yMax: 0.85 },
    ];

    const result = evaluatePlantStability(history, null);
    expect(result.isLocked).toBe(true);
    expect(result.stableBounds.xMin).toBe(0.15);
    expect(result.stableBounds.xMax).toBe(0.85);
  });
});

describe('MediaPipe Fingertip to Plant Distance & Overlap Calculation', () => {
  const plantBounds = {
    xMin: 0.20,
    xMax: 0.80,
    yMin: 0.20,
    yMax: 0.80,
  };
  const videoW = 640;
  const videoH = 480;

  it('detects when an index fingertip enters the plant bounding box', () => {
    // MediaPipe keypoint 8 is index_finger_tip
    const keypoints = Array(21).fill(null).map(() => ({ x: 0, y: 0 }));
    // Place index fingertip inside plant (x: 50% = 320, y: 50% = 240)
    keypoints[8] = { x: 320, y: 240 };

    const hands = [
      {
        score: 0.92,
        keypoints,
      } as any,
    ];

    const result = calculateFingertipsToPlant(hands, videoW, videoH, plantBounds);

    expect(result.isAnyTouching).toBe(true);
    expect(result.minDistance).toBe(0);
    const indexTip = result.fingertips.find(f => f.name === 'Index');
    expect(indexTip).toBeDefined();
    expect(indexTip?.isTouching).toBe(true);
    expect(indexTip?.distance).toBe(0);
  });

  it('calculates distance accurately when fingertip is outside the plant region', () => {
    const keypoints = Array(21).fill(null).map(() => ({ x: 0, y: 0 }));
    // Place index fingertip to the left of the plant (x: 64 = 10%, y: 240 = 50%)
    keypoints[8] = { x: 64, y: 240 };

    const hands = [
      {
        score: 0.85,
        keypoints,
      } as any,
    ];

    const result = calculateFingertipsToPlant(hands, videoW, videoH, plantBounds);

    expect(result.isAnyTouching).toBe(false);
    // Plant starts at 0.20, fingertip is at 0.10 -> distance should be 0.10
    expect(result.minDistance).toBeCloseTo(0.10, 2);
    const indexTip = result.fingertips.find(f => f.name === 'Index');
    expect(indexTip?.isTouching).toBe(false);
    expect(indexTip?.distance).toBeCloseTo(0.10, 2);
  });

  it('ignores hands with detection confidence score < 0.15', () => {
    const keypoints = Array(21).fill(null).map(() => ({ x: 320, y: 240 }));
    const hands = [
      {
        score: 0.10, // low confidence noise
        keypoints,
      } as any,
    ];

    const result = calculateFingertipsToPlant(hands, videoW, videoH, plantBounds);
    expect(result.isAnyTouching).toBe(false);
    expect(result.fingertips.length).toBe(0);
  });
});
