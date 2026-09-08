import assert from 'node:assert/strict';
import { HEROES, getHero } from '../src/heroes.js';

const roles = new Set(['Vanguard', 'Duelist', 'Strategist']);
const attackTypes = new Set(['beam', 'projectile', 'melee']);
const abilityKinds = new Set(['dash', 'blink', 'shield', 'teamShield', 'heal', 'burst']);
const secondaryKinds = new Set(['slowBurst', 'heavyProjectile', 'phase', 'rootBurst', 'knockbackBurst', 'heavyBeam', 'selfHaste']);
const ultKinds = new Set(['slam', 'empower', 'stun', 'teamHeal']);
const resourceKinds = new Set(['momentum', 'hatred', 'speedForce', 'arcaneCharge', 'temporalCharge', 'powerCosmic']);

assert.ok(HEROES.length >= 30, 'expected at least 30 playable prototype heroes');

const ids = new Set();
for (const hero of HEROES) {
  assert.ok(hero.id && typeof hero.id === 'string', 'hero id required');
  assert.ok(!ids.has(hero.id), `duplicate hero id: ${hero.id}`);
  ids.add(hero.id);

  assert.ok(hero.name && typeof hero.name === 'string', `${hero.id}: name required`);
  assert.ok(hero.universe === 'DC' || hero.universe === 'Marvel', `${hero.id}: invalid universe`);
  assert.ok(roles.has(hero.role), `${hero.id}: invalid role`);
  assert.ok(attackTypes.has(hero.attackType), `${hero.id}: invalid attackType`);
  assert.ok(Number.isFinite(hero.hp) && hero.hp > 0, `${hero.id}: invalid hp`);
  assert.ok(Number.isFinite(hero.speed) && hero.speed > 0, `${hero.id}: invalid speed`);
  assert.ok(Number.isFinite(hero.damage) && hero.damage > 0, `${hero.id}: invalid damage`);
  assert.ok(Number.isFinite(hero.fireRate) && hero.fireRate > 0, `${hero.id}: invalid fireRate`);
  assert.ok(Number.isFinite(hero.range) && hero.range > 0, `${hero.id}: invalid range`);

  if (hero.attackType === 'projectile') {
    assert.ok(Number.isFinite(hero.projectileSpeed) && hero.projectileSpeed > 0, `${hero.id}: projectileSpeed required`);
  }
  if (hero.attackType === 'melee') {
    assert.ok(Number.isFinite(hero.meleeRadius) && hero.meleeRadius > 0, `${hero.id}: meleeRadius required`);
  }

  assert.ok(hero.primary, `${hero.id}: primary required`);
  assert.ok(hero.secondary, `${hero.id}: secondary required`);
  assert.ok(secondaryKinds.has(hero.secondaryKind), `${hero.id}: invalid secondaryKind`);
  assert.ok(Number.isFinite(hero.secondaryCooldown) && hero.secondaryCooldown > 0, `${hero.id}: invalid secondaryCooldown`);
  assert.ok(hero.ability, `${hero.id}: ability required`);
  assert.ok(abilityKinds.has(hero.abilityKind), `${hero.id}: invalid abilityKind`);
  assert.ok(Number.isFinite(hero.abilityCooldown) && hero.abilityCooldown > 0, `${hero.id}: invalid abilityCooldown`);
  assert.ok(hero.ultimate, `${hero.id}: ultimate required`);
  assert.ok(ultKinds.has(hero.ultKind), `${hero.id}: invalid ultKind`);
  if (hero.resourceKind) {
    assert.ok(resourceKinds.has(hero.resourceKind), `${hero.id}: invalid resourceKind`);
    assert.ok(hero.resourceLabel, `${hero.id}: resourceLabel required`);
  }
}

assert.equal(getHero('juggernaut').resourceKind, 'momentum');
assert.equal(getHero('gorr').resourceKind, 'hatred');
assert.equal(getHero('flash').resourceKind, 'speedForce');
assert.equal(getHero('doctor-doom').resourceKind, 'arcaneCharge');
assert.equal(getHero('kang').resourceKind, 'temporalCharge');
assert.equal(getHero('silver-surfer').resourceKind, 'powerCosmic');

for (const hero of HEROES) assert.equal(getHero(hero.id), hero);
assert.equal(getHero('__missing__'), HEROES[0]);

console.log(`hero definitions: PASS (${HEROES.length} heroes)`);
