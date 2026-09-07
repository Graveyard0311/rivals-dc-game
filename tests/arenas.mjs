import assert from 'node:assert/strict';
import { ARENAS, getArena } from '../src/arenas.js';

assert.deepEqual(Object.keys(ARENAS), ['nexus', 'gotham', 'themyscira']);
assert.equal(getArena('unknown').id, 'nexus');

for (const [id, arena] of Object.entries(ARENAS)) {
  assert.equal(arena.id, id);
  assert.ok(arena.name);
  assert.equal(typeof arena.background, 'number');
  assert.equal(typeof arena.ground, 'number');
  assert.equal(arena.structures.length, 15);
  for (const structure of arena.structures) {
    assert.equal(structure.length, 5);
    structure.slice(0, 4).forEach(value => assert.ok(Number.isFinite(value)));
    assert.equal(typeof structure[4], 'number');
    assert.ok(structure[2] > 0);
    assert.ok(structure[3] > 0);
  }
}

assert.notDeepEqual(ARENAS.nexus.structures, ARENAS.gotham.structures);
assert.notDeepEqual(ARENAS.gotham.structures, ARENAS.themyscira.structures);

console.log('arena presets: PASS');
