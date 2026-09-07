export const GRAPHICS_PROFILES = {
  low: {
    id: 'low',
    name: 'Low',
    maxPixelRatio: 1,
    shadows: false,
    fogFar: 88
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    maxPixelRatio: 1.25,
    shadows: false,
    fogFar: 100
  },
  high: {
    id: 'high',
    name: 'High',
    maxPixelRatio: 1.6,
    shadows: true,
    fogFar: 115
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    maxPixelRatio: 2,
    shadows: true,
    fogFar: 135
  }
};

export function getGraphicsProfile(id) {
  return GRAPHICS_PROFILES[id] || GRAPHICS_PROFILES.high;
}
