import assert from 'node:assert/strict';
import { BOT_DIFFICULTIES, getBotDifficulty } from '../src/bot-difficulty.js';

assert.deepEqual(Object.keys(BOT_DIFFICULTIES), ['easy', 'normal', 'hard', 'expert']);
assert.equal(getBotDifficulty('unknown').id, 'normal');
assert.ok(BOT_DIFFICULTIES.easy.speedMultiplier < BOT_DIFFICULTIES.normal.speedMultiplier);
assert.ok(BOT_DIFFICULTIES.hard.speedMultiplier > BOT_DIFFICULTIES.normal.speedMultiplier);
assert.ok(BOT_DIFFICULTIES.expert.accuracyModifier > BOT_DIFFICULTIES.hard.accuracyModifier);
assert.ok(BOT_DIFFICULTIES.expert.damageMultiplier > BOT_DIFFICULTIES.normal.damageMultiplier);
assert.ok(BOT_DIFFICULTIES.expert.cooldownMultiplier < BOT_DIFFICULTIES.normal.cooldownMultiplier);

for (const profile of Object.values(BOT_DIFFICULTIES)) {
  assert.ok(profile.speedMultiplier > 0);
  assert.ok(profile.damageMultiplier > 0);
  assert.ok(profile.cooldownMultiplier > 0);
  assert.ok(profile.accuracyModifier > -1 && profile.accuracyModifier < 1);
}

console.log('bot difficulty profiles: PASS');
