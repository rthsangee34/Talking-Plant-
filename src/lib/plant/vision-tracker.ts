import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl'; // Ensure webgl backend is loaded
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useObserverStore } from '../../stores/plant/observer-store';
import {
  TouchStateMachine,
  TouchInputSignal,
  TouchState,
  TouchWarningEvent,
} from './touch-state-machine';
import {
  PlantTracker,
  detectPlantCandidatesFromImage,
  isPointInPlantMask,
  calculateDistanceToPlantMask,
  DetectedPlant,
  PlantBoundingBox,
  PlantMaskData,
} from './plant-detector';
import {
  speakTouchWarning,
  playPlantAlertChime,
  getRandomWarningPhrase,
  triggerBackgroundAIVariation,
} from './warning-voice-system';

export type { PlantBoundingBox, PlantMaskData, DetectedPlant, TouchState };

export const REQUIRED_HOLD_FRAMES = 4;       // ~200ms confirmed presence at ~20fps
export const REQUIRED_EXIT_MS = 1200;        // 1.2s clear exit before allowing next touch event
export const SESSION_RESET_MS = 10 * 60 * 1000; // 10 minutes inactivity reset
export const INFERENCE_THROTTLE_MS = 45;     // Run detection at ~22fps (45ms interval)
export const MISSED_FRAMES_TOLERANCE = 2;    // Grace period for momentary tracking drops

// MediaPipe Hand 21 keypoint connections for skeleton rendering
export const HAND_CONNECTIONS: Array<[number, number]> = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [17, 18], [18, 19], [19, 20],
  // Palm base
  [0, 17],
];

export interface TargetPlantLock {
  isLocked: boolean;
  stabilityScore: number; // 0..100
  stabilityFrames: number;
  bounds: PlantBoundingBox;
  label: string;
}

export interface TrackedFingertip {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  name: string;
  isTouching: boolean;
  distance: number;
}

export interface HandKeypoint {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  name?: string;
}

export interface ProtectionTrackerState {
  touchFramesCount: number;
  missedFramesCount: number;
  lastTouchTime: number;
  lastExitTime: number;
  isCurrentlyTouching: boolean;
  handInZone: boolean;
  holdDuration: number;
  continuousTouchLevel: 0 | 1 | 2;
}

export function createInitialTrackerState(): ProtectionTrackerState {
  return {
    touchFramesCount: 0,
    missedFramesCount: 0,
    lastTouchTime: 0,
    lastExitTime: 0,
    isCurrentlyTouching: false,
    handInZone: false,
    holdDuration: 0,
    continuousTouchLevel: 0,
  };
}

/**
 * Plant Object Detector: detects vegetation/foliage pixels in normalized coordinates.
 * Preserved for backward-compatibility.
 */
export function detectPlantCandidateFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): PlantBoundingBox | null {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let plantPixelCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const isGreen = g > 40 && g > r * 0.90 && g > b * 1.05 && (g - b) >= 4;
    const isVariegated = r > 70 && g > 35 && b > 30 && r > g && r > b && (r - b) >= 12 && (r - g) <= 110;

    if (isGreen || isVariegated) {
      const pixelIdx = i / 4;
      const x = pixelIdx % width;
      const y = Math.floor(pixelIdx / width);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      plantPixelCount++;
    }
  }

  const totalPixels = width * height;
  if (plantPixelCount / totalPixels < 0.02 || minX >= maxX || minY >= maxY) {
    return null;
  }

  return {
    xMin: Math.max(0.03, (minX / width) - 0.03),
    xMax: Math.min(0.97, (maxX / width) + 0.03),
    yMin: Math.max(0.03, (minY / height) - 0.03),
    yMax: Math.min(0.97, (maxY / height) + 0.03),
  };
}

/**
 * Multi-frame stability check and target lock.
 * Preserved for backward-compatibility.
 */
export function evaluatePlantStability(
  history: PlantBoundingBox[],
  newCandidate: PlantBoundingBox | null
): { isLocked: boolean; stabilityScore: number; stableBounds: PlantBoundingBox } {
  if (!newCandidate) {
    const fallbackBounds = history[history.length - 1] || { xMin: 0.05, xMax: 0.95, yMin: 0.05, yMax: 0.95 };
    return {
      isLocked: history.length >= 4,
      stabilityScore: Math.max(60, history.length * 15),
      stableBounds: fallbackBounds,
    };
  }

  const nextHistory = [...history.slice(-7), newCandidate];

  const avgBounds = {
    xMin: nextHistory.reduce((s, b) => s + b.xMin, 0) / nextHistory.length,
    xMax: nextHistory.reduce((s, b) => s + b.xMax, 0) / nextHistory.length,
    yMin: nextHistory.reduce((s, b) => s + b.yMin, 0) / nextHistory.length,
    yMax: nextHistory.reduce((s, b) => s + b.yMax, 0) / nextHistory.length,
  };

  let maxDrift = 0;
  for (const b of nextHistory) {
    const drift = Math.max(
      Math.abs(b.xMin - avgBounds.xMin),
      Math.abs(b.xMax - avgBounds.xMax),
      Math.abs(b.yMin - avgBounds.yMin),
      Math.abs(b.yMax - avgBounds.yMax)
    );
    if (drift > maxDrift) maxDrift = drift;
  }

  const isStable = maxDrift < 0.12 && nextHistory.length >= 4;
  const score = isStable ? Math.min(100, Math.floor((1 - maxDrift) * 100)) : Math.min(90, nextHistory.length * 18);

  return {
    isLocked: isStable || nextHistory.length >= 5,
    stabilityScore: Math.max(75, score),
    stableBounds: avgBounds,
  };
}

/**
 * Calculate fingertip positions and distance/intersection to plant boundary.
 * Preserved for backward-compatibility.
 */
export function calculateFingertipsToPlant(
  hands: handPoseDetection.Hand[],
  videoW: number,
  videoH: number,
  plantBounds: PlantBoundingBox
): {
  fingertips: TrackedFingertip[];
  isAnyTouching: boolean;
  minDistance: number;
} {
  const FINGERTIP_INDICES = [
    { idx: 4, name: 'Thumb' },
    { idx: 8, name: 'Index' },
    { idx: 12, name: 'Middle' },
    { idx: 16, name: 'Ring' },
    { idx: 20, name: 'Pinky' },
  ];

  const fingertips: TrackedFingertip[] = [];
  let isAnyTouching = false;
  let minDistance = Infinity;

  for (const hand of hands) {
    if (hand.score != null && hand.score < 0.15) continue;

    for (const item of FINGERTIP_INDICES) {
      const kp = hand.keypoints[item.idx];
      if (!kp) continue;

      const normX = kp.x / videoW;
      const normY = kp.y / videoH;

      const isInside =
        normX >= plantBounds.xMin &&
        normX <= plantBounds.xMax &&
        normY >= plantBounds.yMin &&
        normY <= plantBounds.yMax;

      const dx = Math.max(0, plantBounds.xMin - normX, normX - plantBounds.xMax);
      const dy = Math.max(0, plantBounds.yMin - normY, normY - plantBounds.yMax);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (isInside) {
        isAnyTouching = true;
        minDistance = 0;
      } else if (distance < minDistance) {
        minDistance = distance;
      }

      fingertips.push({
        x: normX,
        y: normY,
        name: item.name,
        isTouching: isInside,
        distance,
      });
    }
  }

  return {
    fingertips,
    isAnyTouching,
    minDistance: minDistance === Infinity ? 1 : minDistance,
  };
}

/**
 * Advanced Level 1 & Level 2 Fingertip to Plant Mask analyzer.
 * Uses pixel-level botanical mask to prevent false triggers in empty spaces between leaves.
 */
export function calculateFingertipsToPlantWithMask(
  hands: handPoseDetection.Hand[],
  videoW: number,
  videoH: number,
  plant: { bounds: PlantBoundingBox; mask?: PlantMaskData }
): {
  fingertips: TrackedFingertip[];
  isAnyTouching: boolean;
  minDistance: number;
  touchingFingertips: string[];
  handKeypoints: HandKeypoint[][];
} {
  const FINGERTIP_INDICES = [
    { idx: 4, name: 'Thumb' },
    { idx: 8, name: 'Index' },
    { idx: 12, name: 'Middle' },
    { idx: 16, name: 'Ring' },
    { idx: 20, name: 'Pinky' },
  ];

  const fingertips: TrackedFingertip[] = [];
  const touchingFingertips: string[] = [];
  const allHandsKeypoints: HandKeypoint[][] = [];
  let isAnyTouching = false;
  let minDistance = Infinity;

  for (const hand of hands) {
    if (hand.score != null && hand.score < 0.15) continue;

    // Collect all 21 keypoints for skeleton rendering
    const kps: HandKeypoint[] = hand.keypoints.map((kp) => ({
      x: kp.x / videoW,
      y: kp.y / videoH,
      name: kp.name,
    }));
    allHandsKeypoints.push(kps);

    // Analyze all 5 fingertips
    for (const item of FINGERTIP_INDICES) {
      const kp = hand.keypoints[item.idx];
      if (!kp) continue;

      const normX = kp.x / videoW;
      const normY = kp.y / videoH;

      // Level 1: Botanical Mask intersection
      const isInsideMask = isPointInPlantMask(normX, normY, plant);

      // Level 2: Distance to nearest plant mask pixel
      const dist = calculateDistanceToPlantMask(normX, normY, plant);

      if (isInsideMask || dist <= 0.15) {
        isAnyTouching = true;
        if (!touchingFingertips.includes(item.name)) {
          touchingFingertips.push(item.name);
        }
        minDistance = 0;
      } else if (dist < minDistance) {
        minDistance = dist;
      }

      fingertips.push({
        x: normX,
        y: normY,
        name: item.name,
        isTouching: isInsideMask,
        distance: dist,
      });
    }

    // Also check palm and all keypoints so touching with any part of the hand is recognized
    for (const kp of hand.keypoints) {
      if (!kp) continue;
      const normX = kp.x / videoW;
      const normY = kp.y / videoH;
      const isInside = isPointInPlantMask(normX, normY, plant);
      const dist = calculateDistanceToPlantMask(normX, normY, plant);
      if (isInside || dist <= 0.15) {
        isAnyTouching = true;
        minDistance = 0;
        const name = kp.name || 'Hand';
        if (!touchingFingertips.includes(name)) {
          touchingFingertips.push(name);
        }
      } else if (dist < minDistance) {
        minDistance = dist;
      }
    }
  }

  return {
    fingertips,
    isAnyTouching,
    minDistance: minDistance === Infinity ? 1 : minDistance,
    touchingFingertips,
    handKeypoints: allHandsKeypoints,
  };
}

/**
 * Pure state machine transition function for protection touch tracking.
 * Preserved for backward-compatibility.
 */
export function processProtectionFrame(
  state: ProtectionTrackerState,
  handInZone: boolean,
  now: number,
  callbacks: {
    onConfirmedTouch: (type: 'initial' | 'continuous-3s' | 'continuous-6s') => void;
    incrementInteraction: () => void;
    resetInteractionCount: () => void;
  }
): void {
  if (state.lastTouchTime > 0 && now - state.lastTouchTime > SESSION_RESET_MS) {
    callbacks.resetInteractionCount();
    state.lastTouchTime = 0;
    state.continuousTouchLevel = 0;
  }

  state.handInZone = handInZone;

  if (handInZone) {
    state.missedFramesCount = 0;

    if (!state.isCurrentlyTouching) {
      const timeSinceLastExit = state.lastExitTime > 0 ? now - state.lastExitTime : Infinity;

      if (timeSinceLastExit >= REQUIRED_EXIT_MS) {
        state.touchFramesCount++;

        if (state.touchFramesCount >= REQUIRED_HOLD_FRAMES) {
          state.isCurrentlyTouching = true;
          state.lastTouchTime = now;
          state.holdDuration = 0;
          state.continuousTouchLevel = 0;
          callbacks.incrementInteraction();
          callbacks.onConfirmedTouch('initial');
        }
      }
    } else {
      const holdDuration = now - state.lastTouchTime;
      state.holdDuration = holdDuration;

      if (holdDuration >= 6000 && state.continuousTouchLevel < 2) {
        state.continuousTouchLevel = 2;
        callbacks.onConfirmedTouch('continuous-6s');
      } else if (holdDuration >= 3000 && state.continuousTouchLevel < 1) {
        state.continuousTouchLevel = 1;
        callbacks.onConfirmedTouch('continuous-3s');
      }
    }
  } else {
    if (state.isCurrentlyTouching) {
      state.missedFramesCount++;
      if (state.missedFramesCount <= MISSED_FRAMES_TOLERANCE) {
        state.holdDuration = now - state.lastTouchTime;
        return;
      }

      state.isCurrentlyTouching = false;
      state.continuousTouchLevel = 0;
      state.holdDuration = 0;
      state.lastExitTime = now;
      state.touchFramesCount = 0;
      state.missedFramesCount = 0;
    } else {
      state.touchFramesCount = 0;
      state.missedFramesCount = 0;
    }
  }
}

export function useHandTracker(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onConfirmedTouch: (type: 'initial' | 'continuous-3s' | 'continuous-6s') => void
): {
  isModelLoading: boolean;
  modelError: string | null;
  isHandInZone: boolean;
  targetLock: TargetPlantLock;
  targetPlant: DetectedPlant | null;
  candidates: DetectedPlant[];
  trackedFingertips: TrackedFingertip[];
  handKeypoints: HandKeypoint[][];
  minFingertipDistance: number;
  touchState: TouchState;
  activeWarningText: string | null;
  debugRefs: {
    touchFramesCount: React.MutableRefObject<number>;
    lastTouchTime: React.MutableRefObject<number>;
    lastExitTime: React.MutableRefObject<number>;
    isCurrentlyTouching: React.MutableRefObject<boolean>;
    handInZone: React.MutableRefObject<boolean>;
    holdDuration: React.MutableRefObject<number>;
  };
} {
  const {
    protectionEnabled,
    interactionCount,
    incrementInteraction,
    resetInteractionCount,
    touchLanguage,
    selectedTargetPlantId,
    setActiveWarningText,
    setTouchTelemetry,
  } = useCameraStore();
  const { lastAnalysis } = useObserverStore();

  const handDetectorRef = useRef<handPoseDetection.HandDetector | null>(null);
  const cocoDetectorRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const rafId = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const lastInferenceTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());
  const fpsRef = useRef(20);

  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [isHandInZone, setIsHandInZone] = useState(false);
  const isHandInZoneRef = useRef(false);

  // Multi-plant tracker & Touch state machine instances
  const plantTrackerRef = useRef<PlantTracker>(new PlantTracker({ lockThresholdFrames: 5, gracePeriodMs: 1000, unlockTimeoutMs: 2000 }));
  const touchStateMachineRef = useRef<TouchStateMachine>(
    new TouchStateMachine({
      confirmationFrames: 1, // Instant 1-frame trigger so it speaks automatically when hand detected!
      releaseFrames: 2,
      candidateDistanceThreshold: 0.25,
      releaseDistanceThreshold: 0.35,
      debounceMs: 300,
    })
  );

  const [targetPlant, setTargetPlant] = useState<DetectedPlant | null>(null);
  const [candidates, setCandidates] = useState<DetectedPlant[]>([]);
  const [touchState, setTouchState] = useState<TouchState>('MONITORING');
  const [trackedFingertips, setTrackedFingertips] = useState<TrackedFingertip[]>([]);
  const [handKeypoints, setHandKeypoints] = useState<HandKeypoint[][]>([]);
  const [minFingertipDistance, setMinFingertipDistance] = useState(1);
  const [activeWarning, setActiveWarning] = useState<string | null>(null);

  const [targetLock, setTargetLock] = useState<TargetPlantLock>({
    isLocked: false,
    stabilityScore: 0,
    stabilityFrames: 0,
    bounds: { xMin: 0.04, xMax: 0.96, yMin: 0.04, yMax: 0.96 },
    label: 'Target Plant',
  });

  // Backward compatibility state machine ref
  const stateRef = useRef<ProtectionTrackerState>(createInitialTrackerState());

  // Debug refs
  const touchFramesCount = useRef(0);
  const lastTouchTime = useRef<number>(0);
  const lastExitTime = useRef<number>(0);
  const isCurrentlyTouching = useRef(false);
  const handInZoneRef = useRef(false);
  const holdDurationRef = useRef(0);

  const syncDebugRefs = () => {
    touchFramesCount.current = stateRef.current.touchFramesCount;
    lastTouchTime.current = stateRef.current.lastTouchTime;
    lastExitTime.current = stateRef.current.lastExitTime;
    isCurrentlyTouching.current = stateRef.current.isCurrentlyTouching;
    handInZoneRef.current = stateRef.current.handInZone;
    holdDurationRef.current = stateRef.current.holdDuration;
  };

  // Sync manual target selection from store into plant tracker
  useEffect(() => {
    plantTrackerRef.current.setManualTarget(selectedTargetPlantId);
  }, [selectedTargetPlantId]);

  // Reset internal tracker if interactionCount reset externally
  useEffect(() => {
    if (interactionCount === 0) {
      stateRef.current.touchFramesCount = 0;
      stateRef.current.isCurrentlyTouching = false;
      stateRef.current.holdDuration = 0;
      stateRef.current.continuousTouchLevel = 0;
      stateRef.current.lastExitTime = 0;
      touchStateMachineRef.current.reset();
      syncDebugRefs();
    }
  }, [interactionCount]);

  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const handCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize MediaPipe Hands & COCO-SSD
  useEffect(() => {
    let active = true;

    async function initModels() {
      if (!protectionEnabled) return;
      if (handDetectorRef.current) return;

      setIsModelLoading(true);
      setModelError(null);
      try {
        await tf.setBackend('webgl');
        await tf.ready();

        // 1. MediaPipe Hands
        const handModel = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig: handPoseDetection.MediaPipeHandsTfjsModelConfig = {
          runtime: 'tfjs',
          modelType: 'lite',
          maxHands: 2,
        };
        const handDetector = await handPoseDetection.createDetector(handModel, detectorConfig);

        if (active) {
          handDetectorRef.current = handDetector;
          setIsModelLoading(false);
        } else {
          handDetector.dispose();
        }

        // 2. COCO-SSD for AI-assisted potted plant detection (asynchronous, non-blocking)
        cocoSsd.load({ base: 'lite_mobilenet_v2' }).then((coco) => {
          if (active) {
            cocoDetectorRef.current = coco;
          }
        }).catch((cocoErr) => {
          console.warn('[VISION-TRACKER] COCO-SSD model skipped, using botanical saliency:', cocoErr);
        });

      } catch (err) {
        console.error('Failed to initialize vision tracking model:', err);
        if (active) {
          setModelError('Failed to load tracking model');
          setIsModelLoading(false);
        }
      }
    }

    initModels();

    return () => {
      active = false;
      if (handDetectorRef.current) {
        handDetectorRef.current.dispose();
        handDetectorRef.current = null;
      }
    };
  }, [protectionEnabled]);

  // Main Detection Loop
  const detectHands = useCallback(async () => {
    if (!protectionEnabled || !handDetectorRef.current || !videoRef.current) {
      rafId.current = requestAnimationFrame(detectHands);
      return;
    }

    const video = videoRef.current;
    const now = Date.now();

    // FPS estimation
    const deltaMs = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    if (deltaMs > 0) {
      fpsRef.current = Math.round(1000 / deltaMs);
    }

    if (now - lastInferenceTimeRef.current >= INFERENCE_THROTTLE_MS && !isProcessingRef.current) {
      if (video.readyState >= 2 && !video.paused && !video.ended && video.videoWidth > 0) {
        isProcessingRef.current = true;
        lastInferenceTimeRef.current = now;

        try {
          const videoW = video.videoWidth;
          const videoH = video.videoHeight;

          // Step 1: Draw video to offscreen canvas
          if (!analysisCanvasRef.current) {
            analysisCanvasRef.current = document.createElement('canvas');
            analysisCanvasRef.current.width = 160;
            analysisCanvasRef.current.height = 120;
          }
          const canvas = analysisCanvasRef.current;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          let neuralBoxes: PlantBoundingBox[] | undefined = undefined;

          // Optional COCO-SSD neural inference (runs every ~12 frames)
          if (cocoDetectorRef.current && (Math.random() < 0.1 || !targetPlant)) {
            try {
              const predictions = await cocoDetectorRef.current.detect(video);
              const plantPreds = predictions.filter(
                (p) => p.class === 'potted plant' || p.class === 'plant' || p.class === 'vase'
              );
              if (plantPreds.length > 0) {
                neuralBoxes = plantPreds.map((p) => ({
                  xMin: Math.max(0.01, p.bbox[0] / videoW),
                  yMin: Math.max(0.01, p.bbox[1] / videoH),
                  xMax: Math.min(0.99, (p.bbox[0] + p.bbox[2]) / videoW),
                  yMax: Math.min(0.99, (p.bbox[1] + p.bbox[3]) / videoH),
                }));
              }
            } catch {
              // Neural prediction failed, botanical clustering handles it seamlessly
            }
          }

          let activePlant: DetectedPlant | null = null;
          let currentBounds: PlantBoundingBox = { xMin: 0.04, xMax: 0.96, yMin: 0.04, yMax: 0.96 };

          if (ctx) {
            ctx.drawImage(video, 0, 0, 160, 120);
            const imgData = ctx.getImageData(0, 0, 160, 120);

            // Step 2: Multi-Plant Candidates & Botanical Segmentation Mask
            const detectedCandidates = detectPlantCandidatesFromImage(imgData.data, 160, 120, neuralBoxes);
            const trackerState = plantTrackerRef.current.update(detectedCandidates, now);

            setCandidates(trackerState.candidates);
            activePlant = trackerState.targetPlant;
            setTargetPlant(activePlant);

            if (activePlant) {
              currentBounds = activePlant.bounds;
              const plantName =
                lastAnalysis?.plants?.[0]?.displayName ||
                lastAnalysis?.plants?.[0]?.commonName ||
                activePlant.label;

              setTargetLock({
                isLocked: trackerState.lockStatus === 'LOCKED',
                stabilityScore: trackerState.stabilityScore,
                stabilityFrames: trackerState.stabilityFrames,
                bounds: activePlant.bounds,
                label: plantName,
              });
            }
          }

          // Step 3: MediaPipe Hands Landmarker (fast video tracking mode)
          let hands: handPoseDetection.Hand[] = [];
          try {
            let detectionTarget: HTMLVideoElement | HTMLCanvasElement = video;
            let scaleX = 1;
            let scaleY = 1;

            if (videoW > 640) {
              if (!handCanvasRef.current) {
                handCanvasRef.current = document.createElement('canvas');
              }
              const hc = handCanvasRef.current;
              hc.width = 640;
              hc.height = Math.max(1, Math.round((640 / videoW) * videoH));
              const hctx = hc.getContext('2d', { willReadFrequently: true });
              if (hctx) {
                hctx.drawImage(video, 0, 0, hc.width, hc.height);
                detectionTarget = hc;
                scaleX = videoW / hc.width;
                scaleY = videoH / hc.height;
              }
            }

            const rawHands = await handDetectorRef.current.estimateHands(detectionTarget, {
              flipHorizontal: false,
              staticImageMode: false,
            });

            if (scaleX !== 1 || scaleY !== 1) {
              hands = rawHands.map((h) => ({
                ...h,
                keypoints: h.keypoints.map((kp) => ({
                  ...kp,
                  x: kp.x * scaleX,
                  y: kp.y * scaleY,
                })),
              }));
            } else {
              hands = rawHands;
            }
          } catch (handErr) {
            console.warn('[VISION-TRACKER] Hands estimation error:', handErr);
          }

          // Step 4: Level 1 & Level 2 Fingertip to Plant Mask Analysis
          const hasHands = hands.length > 0;
          const fingertipCalc = calculateFingertipsToPlantWithMask(
            hands,
            videoW,
            videoH,
            activePlant ? { bounds: activePlant.bounds, mask: activePlant.mask } : { bounds: currentBounds }
          );

          setTrackedFingertips(fingertipCalc.fingertips);
          setHandKeypoints(fingertipCalc.handKeypoints);
          setMinFingertipDistance(hasHands ? fingertipCalc.minDistance : 1);

          // Touch is true when hand is detected in the protected space
          const isTouching = hasHands;

          if (isTouching !== isHandInZoneRef.current) {
            isHandInZoneRef.current = isTouching;
            setIsHandInZone(isTouching);
          }

          // Step 5: Strict 6-Stage Touch State Machine
          // Triggers automatically whenever hands are detected in frame
          const touchSignal: TouchInputSignal = {
            isIntersectingMask: fingertipCalc.isAnyTouching,
            contourDistance: fingertipCalc.minDistance,
            handDetected: hasHands,
            candidateProximityThreshold: 0.35,
            timestamp: now,
            touchingFingertips: fingertipCalc.touchingFingertips.length > 0
              ? fingertipCalc.touchingFingertips
              : (hasHands ? ['Hand'] : []),
          };

          const currentTouchState = touchStateMachineRef.current.processFrame(touchSignal, {
            onWarningTriggered: (event: TouchWarningEvent) => {
              // 1. Instant auditory chime feedback (<10ms)
              playPlantAlertChime();

              // 2. Increment interaction counter on confirmed touch
              incrementInteraction();

              // 3. Dispatch confirmed touch callback to trigger Gemini progressive alert & speech
              onConfirmedTouch('initial');

              // 4. Trigger background AI phrase generation to replenish variety
              triggerBackgroundAIVariation(touchLanguage).catch(() => {});
            },
          });

          setTouchState(currentTouchState);

          // Update store telemetry for HUD
          setTouchTelemetry({
            targetLockStatus: plantTrackerRef.current.getState().lockStatus,
            stabilityScore: plantTrackerRef.current.getState().stabilityScore,
            minDistancePx: Math.round(fingertipCalc.minDistance * videoW),
            handDetected: hands.length > 0,
            touchState: currentTouchState,
            candidateFrames: touchStateMachineRef.current.getCandidateFramesCount(),
            touchingFingertips: fingertipCalc.touchingFingertips,
            fps: fpsRef.current,
          });

          // Step 6: Maintain backward-compatible protection state (hold metrics & debug telemetry)
          // Hand remains touching produces 0 additional warnings per user specification
          processProtectionFrame(
            stateRef.current,
            isTouching,
            now,
            {
              onConfirmedTouch: () => {}, // Zero duplicate warnings while hand remains held
              incrementInteraction: () => {},
              resetInteractionCount,
            }
          );

          syncDebugRefs();
        } catch (err) {
          console.warn('[VISION-TRACKER] Detection loop error:', err);
        } finally {
          isProcessingRef.current = false;
        }
      }
    }

    rafId.current = requestAnimationFrame(detectHands);
  }, [
    protectionEnabled,
    videoRef,
    touchLanguage,
    onConfirmedTouch,
    incrementInteraction,
    resetInteractionCount,
    lastAnalysis,
    setActiveWarningText,
    setTouchTelemetry,
    targetPlant,
  ]);

  // Start/Stop RAF Loop
  useEffect(() => {
    if (protectionEnabled && handDetectorRef.current) {
      rafId.current = requestAnimationFrame(detectHands);
    } else {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    }

    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [protectionEnabled, detectHands, isModelLoading]);

  return {
    isModelLoading,
    modelError,
    isHandInZone,
    targetLock,
    targetPlant,
    candidates,
    trackedFingertips,
    handKeypoints,
    minFingertipDistance,
    touchState,
    activeWarningText: activeWarning,
    debugRefs: {
      touchFramesCount,
      lastTouchTime,
      lastExitTime,
      isCurrentlyTouching,
      handInZone: handInZoneRef,
      holdDuration: holdDurationRef,
    },
  };
}
