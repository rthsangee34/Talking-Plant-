import { describe, it, expect, vi } from 'vitest';
import { TouchStateMachine, TouchInputSignal } from '../touch-state-machine';

describe('TouchStateMachine (6-Stage)', () => {
  it('transitions MONITORING -> TOUCH_CANDIDATE -> TOUCH_CONFIRMED -> WARNING_TRIGGERED -> WAITING_FOR_RELEASE on 3 consecutive frames', () => {
    const sm = new TouchStateMachine({ confirmationFrames: 3, releaseFrames: 2, debounceMs: 500 });
    const onWarning = vi.fn();
    const onConfirmed = vi.fn();
    const onCandidate = vi.fn();
    const onStateChange = vi.fn();

    expect(sm.getState()).toBe('MONITORING');

    // Frame 1: Candidate touch
    let time = 1000;
    const signal1: TouchInputSignal = {
      isIntersectingMask: true,
      contourDistance: 0,
      timestamp: time,
      touchingFingertips: ['Index'],
    };
    sm.processFrame(signal1, { onWarningTriggered: onWarning, onConfirmed, onCandidate, onStateChange });
    expect(sm.getState()).toBe('TOUCH_CANDIDATE');
    expect(sm.getCandidateFramesCount()).toBe(1);
    expect(onCandidate).toHaveBeenCalledWith(1);
    expect(onWarning).not.toHaveBeenCalled();

    // Frame 2: Still touching
    time += 50;
    const signal2: TouchInputSignal = { ...signal1, timestamp: time };
    sm.processFrame(signal2, { onWarningTriggered: onWarning, onConfirmed, onCandidate, onStateChange });
    expect(sm.getState()).toBe('TOUCH_CANDIDATE');
    expect(sm.getCandidateFramesCount()).toBe(2);
    expect(onWarning).not.toHaveBeenCalled();

    // Frame 3: Confirmation threshold reached!
    time += 50;
    const signal3: TouchInputSignal = { ...signal1, timestamp: time };
    sm.processFrame(signal3, { onWarningTriggered: onWarning, onConfirmed, onCandidate, onStateChange });
    
    // Should have triggered confirmed & warning, ending in WAITING_FOR_RELEASE
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(onWarning).toHaveBeenCalledTimes(1);
    const warningEvent = onWarning.mock.calls[0][0];
    expect(warningEvent.touchingFingertips).toEqual(['Index']);
    expect(warningEvent.touchId).toContain('touch_');
    expect(sm.getState()).toBe('WAITING_FOR_RELEASE');
  });

  it('rejects transient detection glitches (< confirmationFrames) and reverts to MONITORING', () => {
    const sm = new TouchStateMachine({ confirmationFrames: 3 });
    const onWarning = vi.fn();

    // Frame 1: touch
    sm.processFrame({ isIntersectingMask: true, contourDistance: 0, timestamp: 1000 }, { onWarningTriggered: onWarning });
    expect(sm.getState()).toBe('TOUCH_CANDIDATE');

    // Frame 2: touch
    sm.processFrame({ isIntersectingMask: true, contourDistance: 0, timestamp: 1050 }, { onWarningTriggered: onWarning });
    expect(sm.getState()).toBe('TOUCH_CANDIDATE');

    // Frame 3: dropped before confirmation
    sm.processFrame({ isIntersectingMask: false, contourDistance: 0.15, timestamp: 1100 }, { onWarningTriggered: onWarning });
    expect(sm.getState()).toBe('MONITORING');
    expect(sm.getCandidateFramesCount()).toBe(0);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('CRITICAL RULE: Holding hand on plant for 50 frames triggers EXACTLY ONE warning', () => {
    const sm = new TouchStateMachine({ confirmationFrames: 3, releaseFrames: 3, debounceMs: 500 });
    const onWarning = vi.fn();

    let time = 1000;
    // 3 frames to confirm
    for (let i = 0; i < 3; i++) {
      time += 50;
      sm.processFrame({ isIntersectingMask: true, contourDistance: 0, timestamp: time }, { onWarningTriggered: onWarning });
    }
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(sm.getState()).toBe('WAITING_FOR_RELEASE');

    // Hand stays on plant for 50 more frames (~2.5 seconds)
    for (let i = 0; i < 50; i++) {
      time += 50;
      sm.processFrame({ isIntersectingMask: true, contourDistance: 0, timestamp: time }, { onWarningTriggered: onWarning });
      expect(sm.getState()).toBe('WAITING_FOR_RELEASE');
    }

    // Still exactly one warning!
    expect(onWarning).toHaveBeenCalledTimes(1);
  });

  it('safely re-arms after hand releases for releaseFrames and debounce period passes', () => {
    const sm = new TouchStateMachine({ confirmationFrames: 3, releaseFrames: 2, releaseDistanceThreshold: 0.08, debounceMs: 400 });
    const onWarning = vi.fn();
    const onReleased = vi.fn();
    const onReArmed = vi.fn();

    let time = 1000;
    // Touch confirmation
    for (let i = 0; i < 3; i++) {
      time += 50;
      sm.processFrame({ isIntersectingMask: true, contourDistance: 0, timestamp: time }, { onWarningTriggered: onWarning });
    }
    expect(sm.getState()).toBe('WAITING_FOR_RELEASE');

    // Release Frame 1 (clear exit)
    time += 50;
    sm.processFrame({ isIntersectingMask: false, contourDistance: 0.12, timestamp: time }, { onReleased });
    expect(sm.getState()).toBe('WAITING_FOR_RELEASE');
    expect(sm.getReleaseFramesCount()).toBe(1);

    // Release Frame 2 (release confirmed -> RE_ARMED)
    time += 50;
    sm.processFrame({ isIntersectingMask: false, contourDistance: 0.12, timestamp: time }, { onReleased });
    expect(sm.getState()).toBe('RE_ARMED');
    expect(onReleased).toHaveBeenCalledTimes(1);

    // During debounce (e.g. 200ms elapsed < 400ms debounce)
    time += 200;
    sm.processFrame({ isIntersectingMask: false, contourDistance: 0.12, timestamp: time });
    expect(sm.getState()).toBe('RE_ARMED');

    // After debounce (450ms elapsed >= 400ms debounce)
    time += 250;
    sm.processFrame({ isIntersectingMask: false, contourDistance: 0.12, timestamp: time }, { onReArmed });
    expect(sm.getState()).toBe('MONITORING');
    expect(onReArmed).toHaveBeenCalledTimes(1);
  });

  it('triggers a second warning on a distinct second touch after complete release and re-arm', () => {
    const sm = new TouchStateMachine({ confirmationFrames: 3, releaseFrames: 2, debounceMs: 300 });
    const onWarning = vi.fn();

    let time = 1000;
    // Touch 1
    for (let i = 0; i < 3; i++) {
      time += 50;
      sm.processFrame({ isIntersectingMask: true, contourDistance: 0, timestamp: time }, { onWarningTriggered: onWarning });
    }
    expect(onWarning).toHaveBeenCalledTimes(1);

    // Release 1
    time += 50;
    sm.processFrame({ isIntersectingMask: false, contourDistance: 0.15, timestamp: time });
    time += 50;
    sm.processFrame({ isIntersectingMask: false, contourDistance: 0.15, timestamp: time });
    expect(sm.getState()).toBe('RE_ARMED');

    // Wait debounce
    time += 400;
    sm.processFrame({ isIntersectingMask: false, contourDistance: 0.15, timestamp: time });
    expect(sm.getState()).toBe('MONITORING');

    // Touch 2
    for (let i = 0; i < 3; i++) {
      time += 50;
      sm.processFrame({ isIntersectingMask: true, contourDistance: 0, timestamp: time }, { onWarningTriggered: onWarning });
    }
    // Now exactly 2 warnings fired across 2 distinct touch events
    expect(onWarning).toHaveBeenCalledTimes(2);
  });

  it('triggers a warning on every single distinct touch (Touches 1 through 5) and zero warnings while holding', () => {
    const sm = new TouchStateMachine({ confirmationFrames: 1, releaseFrames: 2, debounceMs: 200 });
    const onWarning = vi.fn();
    let time = 1000;

    for (let touchNum = 1; touchNum <= 5; touchNum++) {
      // 1. Touch starts -> exactly ONE warning
      time += 50;
      sm.processFrame({ isIntersectingMask: true, contourDistance: 0, timestamp: time }, { onWarningTriggered: onWarning });
      expect(onWarning).toHaveBeenCalledTimes(touchNum);
      expect(sm.getState()).toBe('WAITING_FOR_RELEASE');

      // 2. Hand remains held for multiple frames -> NO MORE WARNINGS
      for (let f = 0; f < 10; f++) {
        time += 50;
        sm.processFrame({ isIntersectingMask: true, contourDistance: 0, timestamp: time }, { onWarningTriggered: onWarning });
        expect(onWarning).toHaveBeenCalledTimes(touchNum);
        expect(sm.getState()).toBe('WAITING_FOR_RELEASE');
      }

      // 3. Hand removed -> transitions to RE_ARMED then back to MONITORING
      time += 50;
      sm.processFrame({ isIntersectingMask: false, contourDistance: 0.20, timestamp: time }, { onWarningTriggered: onWarning });
      time += 50;
      sm.processFrame({ isIntersectingMask: false, contourDistance: 0.20, timestamp: time }, { onWarningTriggered: onWarning });
      expect(sm.getState()).toBe('RE_ARMED');

      time += 250; // debounce elapsed
      sm.processFrame({ isIntersectingMask: false, contourDistance: 0.20, timestamp: time }, { onWarningTriggered: onWarning });
      expect(sm.getState()).toBe('MONITORING');
    }

    // Exactly 5 warnings for 5 touches
    expect(onWarning).toHaveBeenCalledTimes(5);
  });
});
