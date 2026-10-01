export const PLANT_LIVE_TOOLS = [
  {
    name: 'get_sensor_readings',
    description: 'Retrieve current soil moisture %, light %, temperature °C, humidity %, and CO2 ppm readings.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_latest_observation',
    description: 'Retrieve the most recent visual observation and health assessment performed by the vision camera.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_latest_plant_analysis',
    description: 'Retrieve detailed botanical vision analysis including species identification, image quality, non-binary flower status (confirmed, likely, uncertain, not-visible), and friendly bilingual remarks.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_plant_history',
    description: 'Retrieve recent observation history and health trends over past sessions.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_hardware_status',
    description: 'Check connection status of webcam camera and Arduino/ESP32 hardware sensors.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_plant_profile',
    description: 'Retrieve plant name, species, target soil moisture range, and light preferences.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_photosynthesis_analysis',
    description: 'Retrieve estimated photosynthesis condition, efficiency score, factor breakdowns (light, water, CO2, temperature, leaf health), and main limiting factor based on real-time environmental conditions.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'getPlantHealth',
    description: 'Retrieve overall plant health status, visible condition, and recent observation note.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'getSensorData',
    description: 'Retrieve current real-time sensor telemetry including soil moisture, light, temperature, and humidity.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'getCurrentPlant',
    description: 'Retrieve the currently detected plant species, name, and care requirements.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'getCameraAnalysis',
    description: 'Retrieve latest vision camera analysis including detected plants, flowers, buds, and visible condition.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

// Centralized Gemini Female Plant Voice Configuration (Section 8.7)
export const DEFAULT_GEMINI_FEMALE_VOICE = 'Aoede';
export const ALTERNATIVE_GEMINI_FEMALE_VOICE = 'Kore';

export const DEFAULT_GEMINI_LIVE_MODEL = 'gemini-3.8-live';

// Older installations persisted a text-only Flash model in the Live setting.
export function resolveLiveModel(model?: string): string {
  const name = model?.trim().replace(/^models\//, '');
  return name?.includes('live') ? name : DEFAULT_GEMINI_LIVE_MODEL;
}

