import { useObserverStore } from '../../stores/plant/observer-store';
import { useCameraStore } from '../../stores/plant/camera-store';
import { useExperienceStore } from '../../stores/plant/experience-store';
import { useSettingsStore } from '../../stores/plant/settings-store';
import { useApiUsageStore } from '../../stores/plant/api-usage-store';

const FRONTEND_ERROR_MESSAGES: Record<string, string> = {
  CAMERA_NOT_READY: 'The live view is not ready yet. Please wait a moment.',
  EMPTY_FRAME: 'No usable picture was captured.',
  INVALID_IMAGE: 'The captured picture format is not supported.',
  API_KEY_MISSING: 'Gemini API configuration is missing on the server.',
  GEMINI_AUTH_ERROR: 'Gemini authentication failed. Check the server API key.',
  MODEL_NOT_SUPPORTED: 'The configured Gemini model does not support image analysis.',
  RATE_LIMIT: 'The analysis service is temporarily busy. Please try again shortly.',
  INVALID_MODEL_RESPONSE: 'The analysis response could not be understood.',
  NETWORK_ERROR: 'The server could not reach Gemini.',
};

export async function executePlantAnalysis(
  useMulti = false,
  overrideImageUrl?: string | null,
  overrideImages?: string[] | null
) {
  const { lastSnapshot, lastMultiSnapshots } = useCameraStore.getState();
  const { isAnalyzing, setLastAnalysis, setIsAnalyzing } = useObserverStore.getState();
  const { showToast } = useExperienceStore.getState();

  if (isAnalyzing) {
    return; // Prevent duplicate requests
  }

  const singleImg = overrideImageUrl || lastSnapshot;
  const multiImgs = overrideImages || (lastMultiSnapshots.length > 0 ? lastMultiSnapshots : singleImg ? [singleImg] : []);

  const payload =
    useMulti && multiImgs.length > 0
      ? { images: multiImgs }
      : { imageUrl: singleImg };

  if (!payload.imageUrl && (!payload.images || payload.images.length === 0)) {
    showToast(FRONTEND_ERROR_MESSAGES.EMPTY_FRAME, 'warning');
    return;
  }

  setIsAnalyzing(true);
  try {
    const { apiKey } = useSettingsStore.getState();
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-Gemini-API-Key': apiKey } : {}),
      },
      body: JSON.stringify(payload),
    });

    let data: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    }

    // If backend is not available (e.g. Firebase Hosting static serving), perform direct client-side analysis
    if ((!data || !res.ok) && apiKey) {
      try {
        const parts: any[] = [
          {
            text: `Analyze this plant photo. Return a JSON object with:
{
  "totalPlantsDetected": 1,
  "sceneSummary": "Plant observed in frame.",
  "plants": [{
    "role": "main",
    "commonName": "Houseplant",
    "scientificName": "Plantae",
    "visibleCondition": "Healthy green foliage",
    "recommendation": "Provide bright, indirect sunlight and check soil moisture regularly.",
    "needsAttention": false,
    "leaves": { "condition": "healthy", "issues": [] },
    "damage": { "detected": false },
    "pests": { "detected": false }
  }]
}`,
          },
        ];

        const img = payload.imageUrl || (payload.images && payload.images[0]);
        if (img && img.startsWith('data:image/')) {
          const m = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (m) {
            parts.push({
              inline_data: {
                mime_type: m[1],
                data: m[2],
              },
            });
          }
        }

        const directRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              generationConfig: { response_mime_type: 'application/json' },
              contents: [{ parts }],
            }),
          }
        );

        if (directRes.ok) {
          const directJson = await directRes.json();
          const txt = directJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) {
            data = JSON.parse(txt);
          }
        }
      } catch (directErr) {
        console.warn('Direct vision fallback notice:', directErr);
      }
    }

    useApiUsageStore.getState().recordApiCall('vision', '/api/analyze', data ? 'success' : 'error');

    if (!data) {
      let userMsg = 'Unable to connect to the analysis service.';
      if (res.status === 400) userMsg = 'The captured image could not be analysed.';
      else if (res.status === 401 || res.status === 403) userMsg = 'Gemini API key is invalid or unauthorized.';
      else if (res.status === 429) userMsg = 'Gemini request limit reached. Please wait and retry.';
      else if (res.status === 500 || res.status === 503) userMsg = 'Gemini is temporarily unavailable.';
      throw new Error(userMsg);
    }

    setLastAnalysis(data);
    const plantName = data.speciesIdentification?.commonName || data.plantType || 'Plant';
    const flowerText = data.flowers?.statusState === 'confirmed' ? ' 🌸' : '';
    showToast(`Vision Analysis Complete: ${plantName}${flowerText}`, 'success');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'The server could not reach Gemini.';
    showToast(msg, 'error');
  } finally {
    setIsAnalyzing(false);
  }
}
