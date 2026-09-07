import assert from 'node:assert/strict';
import { GRAPHICS_PROFILES, getGraphicsProfile } from '../src/graphics-quality.js';

assert.deepEqual(Object.keys(GRAPHICS_PROFILES), ['low', 'medium', 'high', 'ultra']);
assert.equal(getGraphicsProfile('unknown').id, 'high');

const ordered = ['low', 'medium', 'high', 'ultra'].map(id => GRAPHICS_PROFILES[id]);
for (const profile of ordered) {
  assert.ok(profile.maxPixelRatio >= 1);
  assert.ok(profile.maxPixelRatio <= 2);
  assert.ok(profile.fogFar >= 70);
}
assert.ok(GRAPHICS_PROFILES.low.maxPixelRatio < GRAPHICS_PROFILES.medium.maxPixelRatio);
assert.ok(GRAPHICS_PROFILES.medium.maxPixelRatio < GRAPHICS_PROFILES.high.maxPixelRatio);
assert.ok(GRAPHICS_PROFILES.high.maxPixelRatio < GRAPHICS_PROFILES.ultra.maxPixelRatio);
assert.equal(GRAPHICS_PROFILES.low.shadows, false);
assert.equal(GRAPHICS_PROFILES.ultra.shadows, true);

console.log('graphics profiles: PASS');
