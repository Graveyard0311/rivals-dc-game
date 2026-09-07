export const BOT_DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: 'Easy',
    speedMultiplier: 0.82,
    accuracyModifier: -0.22,
    damageMultiplier: 0.78,
    cooldownMultiplier: 1.25
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    speedMultiplier: 1,
    accuracyModifier: 0,
    damageMultiplier: 1,
    cooldownMultiplier: 1
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    speedMultiplier: 1.1,
    accuracyModifier: 0.1,
    damageMultiplier: 1.08,
    cooldownMultiplier: 0.9
  },
  expert: {
    id: 'expert',
    name: 'Expert',
    speedMultiplier: 1.2,
    accuracyModifier: 0.18,
    damageMultiplier: 1.15,
    cooldownMultiplier: 0.78
  }
};

export function getBotDifficulty(id) {
  return BOT_DIFFICULTIES[id] || BOT_DIFFICULTIES.normal;
}
