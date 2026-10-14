import { PlantProfile } from '../../types';

export const DEFAULT_PLANT_PROFILE: PlantProfile = {
  id: 'plant-01',
  name: 'My Plant',
  species: 'Indoor Plant',
  location: 'Living Room Shelf',
  plantedDate: '2024-03-15',
  targetMoistureMin: 40,
  targetMoistureMax: 70,
  targetLightMin: 30,
  targetLightMax: 75,
  description: 'A vibrant plant that thrives with bright indirect sunlight and proper watering.',
  avatarUrl: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=400&q=80',
};

export const PLANT_SPECIES_PRESETS: Partial<PlantProfile>[] = [
  {
    species: 'Boston Fern',
    targetMoistureMin: 40,
    targetMoistureMax: 70,
    targetLightMin: 30,
    targetLightMax: 75,
  },
  {
    species: 'Peace Lily',
    targetMoistureMin: 35,
    targetMoistureMax: 65,
    targetLightMin: 25,
    targetLightMax: 60,
  },
  {
    species: 'Monstera Deliciosa',
    targetMoistureMin: 30,
    targetMoistureMax: 60,
    targetLightMin: 40,
    targetLightMax: 80,
  },
  {
    species: 'Succulent / Cactus',
    targetMoistureMin: 10,
    targetMoistureMax: 30,
    targetLightMin: 60,
    targetLightMax: 100,
  },
];
