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
  assert.equal(arena.destructibles.length, 6);
  for (const prop of arena.destructibles) {
    assert.equal(prop.length, 8);
    assert.equal(typeof prop[0], 'string');
    prop.slice(1, 6).forEach(value => assert.ok(Number.isFinite(value)));
    assert.equal(typeof prop[6], 'number');
    assert.ok(Number.isFinite(prop[7]) && prop[7] > 0);
    assert.ok(prop[3] > 0 && prop[4] > 0 && prop[5] > 0);
  }
  for (const structure of arena.structures) {
    assert.equal(structure.length, 5);
    structure.slice(0, 4).forEach(value => assert.ok(Number.isFinite(value)));
    assert.equal(typeof structure[4], 'number');
    assert.ok(structure[2] > 0);
    assert.ok(structure[3] > 0);
  }
}


const destructibleIds = Object.values(ARENAS).flatMap(arena => arena.destructibles.map(prop => prop[0]));
assert.equal(new Set(destructibleIds).size, destructibleIds.length);

assert.notDeepEqual(ARENAS.nexus.structures, ARENAS.gotham.structures);
assert.notDeepEqual(ARENAS.gotham.structures, ARENAS.themyscira.structures);

console.log('arena presets: PASS');
