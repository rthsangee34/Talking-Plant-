import { useSensorsStore } from '../../stores/plant/sensors-store';
import { useObserverStore } from '../../stores/plant/observer-store';
import { useCameraStore } from '../../stores/plant/camera-store';
import { DEFAULT_PLANT_PROFILE } from './plants';
import { calculatePhotosynthesisAnalysis } from '../plantAnalysis/photosynthesisEngine';

export async function executePlantToolCall(toolName: string, _args: Record<string, unknown>): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'getSensorData':
    case 'get_sensor_readings': {
      const sensors = useSensorsStore.getState().readings;
      const isEspConnected = useSensorsStore.getState().isEspConnected;
      const isManualMode = useSensorsStore.getState().isManualOverride;
      return {
        sensors,
        hardwareConnected: isEspConnected,
        manualOverride: isManualMode,
      };
    }

    case 'getPlantHealth': {
      const latest = useObserverStore.getState().currentObservation;
      const analysis = useObserverStore.getState().lastAnalysis;
      const mainPlant = analysis?.plants?.find(p => p.role === 'main') || analysis?.plants?.[0];
      const sensors = useSensorsStore.getState().readings;
      return {
        healthStatus: latest?.healthStatus || 'Good',
        visibleCondition: mainPlant?.visibleCondition || 'Healthy and vibrant',
        sensoryNote: latest?.sensoryNote || 'I feel comfortable and well cared for.',
        actionRequired: latest?.actionRequired || false,
        urgentNeeds: latest?.urgentNeeds || [],
        soilMoisture: sensors.moisture ? Math.round(sensors.moisture) : undefined,
        lightIntensity: sensors.light ? Math.round(sensors.light) : undefined,
        temperature: sensors.temperature ? Math.round(sensors.temperature) : undefined,
        humidity: sensors.humidity ? Math.round(sensors.humidity) : undefined,
      };
    }

    case 'getCurrentPlant': {
      const analysis = useObserverStore.getState().lastAnalysis;
      const mainPlant = analysis?.plants?.find(p => p.role === 'main') || analysis?.plants?.[0];
      return {
        plantName: mainPlant?.displayName || DEFAULT_PLANT_PROFILE.name,
        commonName: mainPlant?.commonName || DEFAULT_PLANT_PROFILE.species,
        scientificName: mainPlant?.scientificName || 'Epipremnum aureum',
        identificationConfidence: mainPlant?.identificationConfidence || 'confirmed',
        targetMoistureRange: `${DEFAULT_PLANT_PROFILE.targetMoistureMin}% - ${DEFAULT_PLANT_PROFILE.targetMoistureMax}%`,
        targetLightRange: `${DEFAULT_PLANT_PROFILE.targetLightMin}% - ${DEFAULT_PLANT_PROFILE.targetLightMax}%`,
      };
    }

    case 'getCameraAnalysis':

    case 'get_latest_observation': {
      const latest = useObserverStore.getState().currentObservation;
      if (!latest) {
        return {
          status: 'No visual observation recorded yet in this session.',
        };
      }
      return {
        latestObservation: latest,
      };
    }

    case 'get_latest_plant_analysis': {
      const analysis = useObserverStore.getState().lastAnalysis;
      if (!analysis) {
        return {
          status: 'No vision analysis run yet in this session.',
        };
      }
      const mainPlant = analysis.plants?.find(p => p.role === 'main') || analysis.plants?.[0];
      return {
        plantDetected: analysis.totalPlantsDetected > 0,
        plantType: mainPlant?.commonName || 'Unknown',
        scientificName: mainPlant?.scientificName || 'Unknown',
        speciesConfidence: mainPlant?.identificationConfidence || 'Unknown',
        flowerStatusState: mainPlant?.flowers?.status || 'not-visible',
        flowerDetected: mainPlant?.flowers?.status === 'confirmed' || mainPlant?.flowers?.status === 'likely',
        flowerEvidence: mainPlant?.flowers?.details || '',
        requiresCloserView: false,
        budDetected: mainPlant?.buds?.status === 'confirmed' || mainPlant?.buds?.status === 'likely',
        budCount: mainPlant?.buds?.countEstimate || null,
        imageQuality: analysis.imageQuality,
        friendlyResponse: mainPlant?.plantMessage || '',
        overallHealth: mainPlant?.visibleCondition || '',
      };
    }

    case 'get_plant_history': {
      const history = useObserverStore.getState().history;
      return {
        totalObservations: history.length,
        recentObservations: history.slice(0, 5),
      };
    }

    case 'get_hardware_status': {
      const cameraActive = useCameraStore.getState().isActive;
      const espConnected = useSensorsStore.getState().isEspConnected;
      return {
        cameraActive,
        espConnected,
        webcamDevice: useCameraStore.getState().selectedDeviceId || 'Default Browser Webcam',
      };
    }

    case 'get_plant_profile': {
      return {
        profile: DEFAULT_PLANT_PROFILE,
      };
    }

    case 'get_photosynthesis_analysis': {
      const { readings, isEspConnected, isManualOverride } = useSensorsStore.getState();
      const lastAnalysis = useObserverStore.getState().lastAnalysis;
      const profile = DEFAULT_PLANT_PROFILE;

      const activeReadings = isEspConnected || isManualOverride ? readings : null;
      const photosynthesis = calculatePhotosynthesisAnalysis(activeReadings, lastAnalysis, {
        speciesProfile: {
          speciesName: profile.species,
          targetLightMin: profile.targetLightMin,
          targetLightMax: profile.targetLightMax,
          targetMoistureMin: profile.targetMoistureMin,
          targetMoistureMax: profile.targetMoistureMax,
        },
      });

      return {
        estimatedCondition: photosynthesis.statusLabel,
        overallScore: `${photosynthesis.overallScore}%`,
        confidence: photosynthesis.confidence,
        factors: {
          light: `${photosynthesis.factors.light.score}% (${photosynthesis.factors.light.label})`,
          water: `${photosynthesis.factors.water.score}% (${photosynthesis.factors.water.label})`,
          co2: photosynthesis.factors.co2.available ? `${photosynthesis.factors.co2.value} ppm (${photosynthesis.factors.co2.label})` : 'Unavailable',
          temperature: photosynthesis.factors.temperature.available ? `${photosynthesis.factors.temperature.value}°C (${photosynthesis.factors.temperature.label})` : 'Unavailable',
          leafHealth: photosynthesis.factors.leafHealth.available ? photosynthesis.factors.leafHealth.label : 'Not Scanned',
        },
        mainLimitingFactor: photosynthesis.limitingFactor.factorName,
        limitingExplanation: photosynthesis.limitingFactor.explanation,
        careRecommendation: photosynthesis.limitingFactor.recommendedAction,
        firstPersonPlantNote: photosynthesis.explanation,
        isEstimateOnly: true,
      };
    }

    default:
      return { error: `Unknown tool name: ${toolName}` };
  }
}
