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
];

// Centralized Gemini Female Plant Voice Configuration (Section 8.7)
export const DEFAULT_GEMINI_FEMALE_VOICE = 'Aoede';
export const ALTERNATIVE_GEMINI_FEMALE_VOICE = 'Kore';

