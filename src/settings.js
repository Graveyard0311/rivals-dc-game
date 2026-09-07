const STORAGE_KEY = 'rivals-collision-settings-v1';

export const DEFAULT_SETTINGS = {
  fov: 70,
  sensitivity: 1,
  masterVolume: 0.7,
  showHealthBars: true,
  bindings: {
    forward: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    ability: 'ShiftLeft',
    ultimate: 'KeyQ'
  }
};

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

export function loadSettings() {
  const fallback = cloneDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      bindings: {
        ...fallback.bindings,
        ...(parsed.bindings || {})
      }
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetSettings() {
  const fresh = cloneDefaults();
  saveSettings(fresh);
  return fresh;
}

export function humanizeCode(code) {
  const map = {
    Space: 'SPACE',
    ShiftLeft: 'L-SHIFT',
    ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL',
    ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT',
    AltRight: 'R-ALT'
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code.toUpperCase();
}
