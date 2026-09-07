import assert from 'node:assert/strict';
import { HEROES } from '../src/heroes.js';
import { TEAM_UPS, availableTeamUps, preferredTeamUp } from '../src/teamups.js';

const heroIds = new Set(HEROES.map(h => h.id));
const teamUpIds = new Set();

for (const teamUp of TEAM_UPS) {
  assert.ok(teamUp.id);
  assert.ok(teamUp.name);
  assert.ok(Array.isArray(teamUp.members));
  assert.equal(teamUp.members.length, 2);
  assert.ok(teamUp.cooldown > 0);
  assert.ok(!teamUpIds.has(teamUp.id), `duplicate team-up id: ${teamUp.id}`);
  teamUpIds.add(teamUp.id);
  for (const member of teamUp.members) {
    assert.ok(heroIds.has(member), `unknown hero in team-up ${teamUp.id}: ${member}`);
  }
}

assert.equal(preferredTeamUp('batman', ['batman', 'nightwing'])?.id, 'gotham-knights');
assert.equal(preferredTeamUp('superman', ['superman', 'wonder-woman'])?.id, 'worlds-finest');
assert.equal(preferredTeamUp('flash', ['flash', 'green-lantern'])?.id, 'emerald-velocity');
assert.equal(preferredTeamUp('raven', ['raven', 'starfire'])?.id, 'titan-bond');
assert.equal(preferredTeamUp('cyborg', ['batman', 'cyborg'])?.id, 'network-override');
assert.equal(preferredTeamUp('gorr', ['gorr', 'thanos']), null);

const batmanOptions = availableTeamUps('batman', ['batman', 'nightwing', 'cyborg']);
assert.deepEqual(batmanOptions.map(x => x.id), ['gotham-knights', 'network-override']);

console.log('team-up registry: PASS');
