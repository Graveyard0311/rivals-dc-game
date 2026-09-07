export const DEFAULT_SETTINGS = Object.freeze({
  mouseSensitivity: 0.0022,
  fov: 70,
  masterVolume: 0.65,
  reducedCameraShake: false,
  showHealthBars: true,
  graphicsQuality: 'high',
  keybinds: {
    forward: 'KeyW',
    backward: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    jump: 'Space',
    ability: 'ShiftLeft',
    ultimate: 'KeyQ'
  }
});

const STORAGE_KEY = 'rivals-collision-settings-v1';

const validNumber = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function loadSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {}

  return {
    mouseSensitivity: validNumber(saved.mouseSensitivity, 0.0008, 0.006, DEFAULT_SETTINGS.mouseSensitivity),
    fov: validNumber(saved.fov, 70, 110, DEFAULT_SETTINGS.fov),
    masterVolume: validNumber(saved.masterVolume, 0, 1, DEFAULT_SETTINGS.masterVolume),
    reducedCameraShake: Boolean(saved.reducedCameraShake),
    showHealthBars: saved.showHealthBars !== false,
    graphicsQuality: ['low', 'medium', 'high', 'ultra'].includes(saved.graphicsQuality) ? saved.graphicsQuality : DEFAULT_SETTINGS.graphicsQuality,
    keybinds: {
      ...DEFAULT_SETTINGS.keybinds,
      ...(saved.keybinds || {})
    }
  };
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetSettings() {
  localStorage.removeItem(STORAGE_KEY);
  return loadSettings();
}

export function keyLabel(code) {
  if (!code) return 'UNBOUND';
  const labels = {
    Space: 'SPACE',
    ShiftLeft: 'L SHIFT',
    ShiftRight: 'R SHIFT',
    ControlLeft: 'L CTRL',
    ControlRight: 'R CTRL',
    AltLeft: 'L ALT',
    AltRight: 'R ALT',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→'
  };
  if (labels[code]) return labels[code];
  return code.replace(/^Key/, '').replace(/^Digit/, '');
}
