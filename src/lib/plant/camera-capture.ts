export async function captureCameraFrame(videoElement: HTMLVideoElement): Promise<string | null> {
  if (!videoElement) {
    console.warn('captureCameraFrame: videoElement is null');
    return null;
  }

  // Wait briefly if videoElement data is loading or dimensions are not available yet
  if (videoElement.readyState < 2 || videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
    await new Promise<void>((resolve) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if ((videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) || attempts >= 20) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  const width = videoElement.videoWidth || 1280;
  const height = videoElement.videoHeight || 720;

  if (width <= 0 || height <= 0) {
    console.warn('captureCameraFrame: Invalid video dimensions', { width, height });
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.92);
  } catch (err) {
    console.error('captureCameraFrame error:', err);
    return null;
  }
}

/**
 * Captures a frame using native video dimensions (preserving aspect ratio).
 * When isFrontCamera is true, the image is un-mirrored so the AI receives
 * correctly oriented data even though the preview may be mirrored for UX.
 *
 * @param microscopeMode When true, uses higher JPEG quality (0.95) to
 *   preserve fine detail from USB microscope cameras.
 */
export async function captureCameraFrameUnmirrored(
  videoElement: HTMLVideoElement,
  isFrontCamera = false,
  microscopeMode = false
): Promise<string | null> {
  if (!videoElement) {
    console.warn('captureCameraFrameUnmirrored: videoElement is null');
    return null;
  }

  // Wait for video dimensions to be available
  if (videoElement.readyState < 2 || videoElement.videoWidth <= 0 || videoElement.videoHeight <= 0) {
    await new Promise<void>((resolve) => {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (
          (videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) ||
          attempts >= 30
        ) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  const width = videoElement.videoWidth;
  const height = videoElement.videoHeight;

  if (width <= 0 || height <= 0) {
    console.warn('captureCameraFrameUnmirrored: Invalid video dimensions', { width, height });
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (isFrontCamera) {
      // Un-mirror: flip horizontally so AI gets correct orientation
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(videoElement, 0, 0, width, height);

    const quality = microscopeMode ? 0.95 : 0.92;
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (!dataUrl || dataUrl === 'data:,') {
      return null;
    }
    return dataUrl;
  } catch (err) {
    console.error('captureCameraFrameUnmirrored error:', err);
    return null;
  }
}

export async function captureMultiFrames(
  videoElement: HTMLVideoElement,
  count = 3,
  delayMs = 300
): Promise<string[]> {
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const frame = await captureCameraFrame(videoElement);
    if (frame) frames.push(frame);
    if (i < count - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return frames;
}

export function createDefaultPlantSampleDataUrl(variation = 0): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 1280, 720);
  bg.addColorStop(0, '#062016');
  bg.addColorStop(0.5, '#0a2e1f');
  bg.addColorStop(1, '#02120b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1280, 720);

  // Soft glow
  const glow = ctx.createRadialGradient(640, 360, 50, 640, 360, 450);
  glow.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1280, 720);

  // Pot
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.moveTo(520, 500);
  ctx.lineTo(760, 500);
  ctx.lineTo(720, 680);
  ctx.lineTo(560, 680);
  ctx.closePath();
  ctx.fill();

  // Stem
  ctx.strokeStyle = '#15803d';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(640, 510);
  ctx.quadraticCurveTo(630 + variation * 10, 350, 640 + variation * 5, 200);
  ctx.stroke();

  // Leaves
  const drawLeaf = (cx: number, cy: number, rx: number, ry: number, angle: number, color: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-rx + 5, 0);
    ctx.lineTo(rx - 5, 0);
    ctx.stroke();
    ctx.restore();
  };

  drawLeaf(530, 320, 110 + variation * 5, 60, -0.4, '#16a34a');
  drawLeaf(750, 340, 120, 65 + variation * 3, 0.35, '#15803d');
  drawLeaf(580, 240, 100, 55, -0.2, '#22c55e');
  drawLeaf(700, 220, 95, 50, 0.25, '#16a34a');
  drawLeaf(640, 160, 85, 45, -0.05, '#4ade80');

  // Flower bloom
  const flowerX = 640 + variation * 5;
  const flowerY = 190;
  ctx.fillStyle = '#f43f5e';
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + variation * 0.1;
    ctx.beginPath();
    ctx.arc(flowerX + Math.cos(a) * 25, flowerY + Math.sin(a) * 25, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(flowerX, flowerY, 15, 0, Math.PI * 2);
  ctx.fill();

  // Text tag
  ctx.font = '600 20px sans-serif';
  ctx.fillStyle = '#6ee7b7';
  ctx.textAlign = 'center';
  ctx.fillText(`Botanical Vision Scan Frame ${variation + 1} of 3`, 640, 60);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function createFrameVariationsFromSnapshot(baseDataUrl: string, count = 3): Promise<string[]> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = baseDataUrl;
  await new Promise<void>((resolve) => {
    if (img.complete) resolve();
    else {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    }
  });

  if (!img.width || !img.height) {
    return Array(count).fill(baseDataUrl);
  }

  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.015 * i})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.92));
    } else {
      frames.push(baseDataUrl);
    }
  }
  return frames;
}

export function validateImageDataUrl(dataUrl: string): { valid: boolean; error?: string; mimeType?: string } {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return { valid: false, error: 'Image data URL is missing or empty' };
  }

  const matches = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!matches) {
    return { valid: false, error: 'Invalid data URL format. Must be base64 image data URL.' };
  }

  const mimeType = matches[1];
  const base64Data = matches[2];

  const approxSizeBytes = (base64Data.length * 3) / 4;
  if (approxSizeBytes > 10 * 1024 * 1024) {
    return { valid: false, error: 'Image size exceeds maximum limit of 10MB.' };
  }

  return { valid: true, mimeType };
}

// ─── Frame Quality Validation ──────────────────────────────────

export interface FrameQualityResult {
  valid: boolean;
  score: number; // 0–100
  issues: string[];
}

/**
 * Validates a captured frame for basic quality: checks for empty/null,
 * invalid data URL, black frame, extreme darkness, and extreme overexposure.
 * Returns a quality score (0–100) and list of issues.
 */
export async function validateFrameQuality(dataUrl: string): Promise<FrameQualityResult> {
  const issues: string[] = [];

  if (!dataUrl || typeof dataUrl !== 'string') {
    return { valid: false, score: 0, issues: ['Empty frame'] };
  }

  const urlCheck = validateImageDataUrl(dataUrl);
  if (!urlCheck.valid) {
    return { valid: false, score: 0, issues: [urlCheck.error || 'Invalid data URL'] };
  }

  // Decode and sample the image for brightness/contrast/sharpness
  try {
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve) => {
      if (img.complete && img.naturalWidth > 0) resolve();
      else {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      }
    });

    if (!img.naturalWidth || !img.naturalHeight) {
      return { valid: false, score: 0, issues: ['Invalid dimensions'] };
    }

    // Sample at reduced resolution for performance
    const sampleW = Math.min(img.naturalWidth, 320);
    const sampleH = Math.min(img.naturalHeight, 240);
    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      return { valid: false, score: 0, issues: ['Canvas unavailable'] };
    }

    ctx.drawImage(img, 0, 0, sampleW, sampleH);
    const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
    const data = imageData.data;

    const totalPixels = sampleW * sampleH;
    let sumBrightness = 0;
    let sumBrightnessSq = 0;
    let blackPixels = 0;
    let whitePixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sumBrightness += brightness;
      sumBrightnessSq += brightness * brightness;
      if (brightness < 10) blackPixels++;
      if (brightness > 245) whitePixels++;
    }

    const avgBrightness = sumBrightness / totalPixels;
    const variance = sumBrightnessSq / totalPixels - avgBrightness * avgBrightness;
    const contrast = Math.sqrt(Math.max(0, variance));

    let score = 50; // Base score

    // Brightness scoring (ideal: 80–180)
    if (avgBrightness < 20) {
      issues.push('Extreme darkness');
      score -= 40;
    } else if (avgBrightness < 50) {
      issues.push('Dark frame');
      score -= 15;
    } else if (avgBrightness > 240) {
      issues.push('Extreme overexposure');
      score -= 40;
    } else if (avgBrightness > 210) {
      issues.push('Overexposed');
      score -= 10;
    } else {
      // Good brightness range — bonus
      score += 20;
    }

    // Contrast scoring
    if (contrast < 5) {
      issues.push('Black frame');
      score -= 30;
    } else if (contrast < 15) {
      issues.push('Very low contrast');
      score -= 10;
    } else if (contrast > 30) {
      score += 15; // Good contrast
    }

    // Sharpness estimation (Laplacian variance on brightness)
    let laplacianSum = 0;
    let laplacianCount = 0;
    const brightArr: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      brightArr.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    for (let y = 1; y < sampleH - 1; y++) {
      for (let x = 1; x < sampleW - 1; x++) {
        const idx = y * sampleW + x;
        const laplacian =
          -4 * brightArr[idx] +
          brightArr[idx - 1] +
          brightArr[idx + 1] +
          brightArr[idx - sampleW] +
          brightArr[idx + sampleW];
        laplacianSum += laplacian * laplacian;
        laplacianCount++;
      }
    }
    const sharpness = laplacianCount > 0 ? laplacianSum / laplacianCount : 0;

    if (sharpness < 10) {
      issues.push('Severe blur');
      score -= 15;
    } else if (sharpness > 100) {
      score += 15; // Sharp image
    }

    // Black/white pixel ratio
    if (blackPixels / totalPixels > 0.9) {
      if (!issues.includes('Black frame')) issues.push('Black frame');
      score -= 20;
    }
    if (whitePixels / totalPixels > 0.9) {
      if (!issues.includes('Extreme overexposure')) issues.push('Extreme overexposure');
      score -= 20;
    }

    score = Math.max(0, Math.min(100, score));

    // Frame is valid if score >= 20 and no fatal issues
    const fatal = issues.some((i) =>
      ['Extreme darkness', 'Extreme overexposure', 'Black frame', 'Invalid dimensions', 'Empty frame'].includes(i)
    );

    return { valid: !fatal && score >= 20, score, issues };
  } catch (err) {
    console.error('validateFrameQuality error:', err);
    return { valid: false, score: 0, issues: ['Validation error'] };
  }
}

/**
 * Selects the best frame from a set based on quality score.
 * Falls back to the last frame if scoring fails.
 */
export async function selectBestFrame(frames: string[]): Promise<string> {
  if (frames.length === 0) return '';
  if (frames.length === 1) return frames[0];

  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < frames.length; i++) {
    const result = await validateFrameQuality(frames[i]);
    if (result.score > bestScore) {
      bestScore = result.score;
      bestIdx = i;
    }
  }

  return frames[bestIdx];
}

