import { describe, it, expect } from 'vitest';
import {
  isFoliagePixel,
  extractPlantMask,
  isPointInPlantMask,
  calculateDistanceToPlantMask,
  PlantTracker,
  DetectedPlant,
} from '../plant-detector';

describe('Plant Detector & Segmentation Mask', () => {
  it('identifies chlorophyll green and variegated houseplant colors', () => {
    // Green chlorophyll leaf (R: 30, G: 120, B: 40)
    expect(isFoliagePixel(30, 120, 40)).toBe(true);

    // Variegated Aglaonema pink leaf (R: 180, G: 80, B: 90)
    expect(isFoliagePixel(180, 80, 90)).toBe(true);

    // Golden pothos lime leaf (R: 110, G: 140, B: 50)
    expect(isFoliagePixel(110, 140, 50)).toBe(true);

    // Human skin tone / wall / brown desk (R: 200, G: 160, B: 130)
    expect(isFoliagePixel(200, 160, 130)).toBe(false);

    // White background (255, 255, 255)
    expect(isFoliagePixel(255, 255, 255)).toBe(false);
  });

  it('generates binary mask and prevents false positive touch in empty bounding box spaces', () => {
    // Synthetic 10x10 image with a 4x4 green square in the center (from y=3..6, x=3..6)
    const w = 10;
    const h = 10;
    const data = new Uint8ClampedArray(w * h * 4);

    for (let y = 3; y <= 6; y++) {
      for (let x = 3; x <= 6; x++) {
        const idx = (y * w + x) * 4;
        data[idx] = 20;     // R
        data[idx + 1] = 150; // G
        data[idx + 2] = 30;  // B
        data[idx + 3] = 255; // A
      }
    }

    const bounds = { xMin: 0.1, xMax: 0.9, yMin: 0.1, yMax: 0.9 };
    const mask = extractPlantMask(data, w, h, bounds, 10, 10);
    const plant = { bounds, mask };

    // Point in the center (where green leaf exists) -> should be inside mask!
    expect(isPointInPlantMask(0.5, 0.5, plant)).toBe(true);
    expect(calculateDistanceToPlantMask(0.5, 0.5, plant)).toBe(0);

    // Point in the corner of the bounding box (empty air between leaves)
    // Inside bounding box, but NOT on foliage!
    expect(isPointInPlantMask(0.15, 0.15, plant)).toBe(false);
    expect(calculateDistanceToPlantMask(0.15, 0.15, plant)).toBeGreaterThan(0);
  });

  it('locks onto plant target after 5 stable consecutive frames', () => {
    const tracker = new PlantTracker({ lockThresholdFrames: 5 });

    const mockPlant: DetectedPlant = {
      id: 'plant-1',
      label: 'Main Plant',
      confidence: 0.9,
      bounds: { xMin: 0.2, xMax: 0.8, yMin: 0.2, yMax: 0.8 },
      center: { x: 0.5, y: 0.5 },
      area: 0.36,
      mask: { maskWidth: 4, maskHeight: 4, data: new Uint8Array(16).fill(1) },
      contourPoints: [],
      firstSeen: 1000,
      lastSeen: 1000,
      consecutiveFrames: 1,
      isLocked: false,
    };

    let time = 1000;

    // First 4 frames: ACQUIRING
    for (let i = 1; i <= 4; i++) {
      time += 50;
      const state = tracker.update([mockPlant], time);
      expect(state.lockStatus).toBe('ACQUIRING');
      expect(state.stabilityFrames).toBe(i);
      expect(state.targetPlant?.isLocked).toBe(false);
    }

    // 5th frame: LOCKED!
    time += 50;
    const state = tracker.update([mockPlant], time);
    expect(state.lockStatus).toBe('LOCKED');
    expect(state.targetPlant?.isLocked).toBe(true);
    expect(state.stabilityScore).toBeGreaterThanOrEqual(75);
  });

  it('maintains target during occlusion grace period (< 1s) and unlocks after > 2s', () => {
    const tracker = new PlantTracker({ lockThresholdFrames: 3, gracePeriodMs: 1000, unlockTimeoutMs: 2000 });

    const mockPlant: DetectedPlant = {
      id: 'plant-1',
      label: 'Main Plant',
      confidence: 0.9,
      bounds: { xMin: 0.2, xMax: 0.8, yMin: 0.2, yMax: 0.8 },
      center: { x: 0.5, y: 0.5 },
      area: 0.36,
      mask: { maskWidth: 4, maskHeight: 4, data: new Uint8Array(16).fill(1) },
      contourPoints: [],
      firstSeen: 1000,
      lastSeen: 1000,
      consecutiveFrames: 1,
      isLocked: false,
    };

    let time = 1000;
    // Lock it with 3 frames
    tracker.update([mockPlant], time);
    tracker.update([mockPlant], time + 50);
    const lockedState = tracker.update([mockPlant], time + 100);
    expect(lockedState.lockStatus).toBe('LOCKED');

    // Plant temporarily occluded / missed for 500ms (< 1000ms grace period)
    const graceState = tracker.update([], time + 600);
    expect(graceState.lockStatus).toBe('LOST');
    expect(graceState.targetPlant).not.toBeNull(); // Still tracking last known position!

    // Missing for 2500ms (> 2000ms timeout) -> completely unlocked
    const unlockState = tracker.update([], time + 2600);
    expect(unlockState.lockStatus).toBe('SEARCHING');
    expect(unlockState.targetPlant).toBeNull();
  });

  it('supports manual selection of target plant when multiple candidates exist', () => {
    const tracker = new PlantTracker();

    const plantA: DetectedPlant = {
      id: 'plant-left',
      label: 'Left Plant',
      confidence: 0.9,
      bounds: { xMin: 0.05, xMax: 0.45, yMin: 0.2, yMax: 0.8 },
      center: { x: 0.25, y: 0.5 },
      area: 0.24,
      mask: { maskWidth: 4, maskHeight: 4, data: new Uint8Array(16).fill(1) },
      contourPoints: [],
      firstSeen: 1000,
      lastSeen: 1000,
      consecutiveFrames: 1,
      isLocked: false,
    };

    const plantB: DetectedPlant = {
      id: 'plant-right',
      label: 'Right Plant',
      confidence: 0.9,
      bounds: { xMin: 0.55, xMax: 0.95, yMin: 0.2, yMax: 0.8 },
      center: { x: 0.75, y: 0.5 },
      area: 0.24,
      mask: { maskWidth: 4, maskHeight: 4, data: new Uint8Array(16).fill(1) },
      contourPoints: [],
      firstSeen: 1000,
      lastSeen: 1000,
      consecutiveFrames: 1,
      isLocked: false,
    };

    // User explicitly selects 'plant-right'
    tracker.setManualTarget('plant-right');
    const state = tracker.update([plantA, plantB], 1000);
    expect(state.targetPlant?.id).toBe('plant-right');
  });
});
