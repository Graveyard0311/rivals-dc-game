import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';

const PORT = 8899;
const URL = `ws://127.0.0.1:${PORT}`;

function waitForServer(child, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), timeout);
    const onData = chunk => {
      const text = chunk.toString();
      if (text.includes('WebSocket server listening')) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Server exited before startup with code ${code}`));
    });
  });
}

function connectClient() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const timer = setTimeout(() => reject(new Error('Client connection timed out')), 5000);
    ws.once('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.once('error', reject);
  });
}

function nextMessage(ws, predicate = () => true, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('Timed out waiting for WebSocket message'));
    }, timeout);

    const onMessage = raw => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!predicate(msg)) return;
      clearTimeout(timer);
      ws.off('message', onMessage);
      resolve(msg);
    };
    ws.on('message', onMessage);
  });
}

function send(ws, type, payload = {}) {
  ws.send(JSON.stringify({ type, ...payload }));
}

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stderr.on('data', chunk => process.stderr.write(chunk));

let a;
let b;

try {
  await waitForServer(server);

  a = await connectClient();
  const helloA = await nextMessage(a, m => m.type === 'hello');
  assert.ok(helloA.playerId);

  b = await connectClient();
  const helloB = await nextMessage(b, m => m.type === 'hello');
  assert.ok(helloB.playerId);
  assert.notEqual(helloA.playerId, helloB.playerId);

  send(a, 'create-lobby', { name: 'Alpha', heroId: 'superman' });
  const joinedA = await nextMessage(a, m => m.type === 'joined');
  assert.match(joinedA.lobbyCode, /^[A-F0-9]{6}$/);
  assert.equal(joinedA.playerId, helloA.playerId);
  assert.equal(joinedA.hostId, helloA.playerId);
  assert.equal(joinedA.team, 'blue');

  const playerJoinedOnA = nextMessage(a, m => m.type === 'player-joined');
  send(b, 'join-lobby', { lobbyCode: joinedA.lobbyCode, name: 'Bravo', heroId: 'gorr' });
  const joinedB = await nextMessage(b, m => m.type === 'joined');
  const joinedNotice = await playerJoinedOnA;
  assert.equal(joinedB.team, 'red');
  assert.equal(joinedB.players.length, 2);
  assert.equal(joinedNotice.players.length, 2);

  const matchStartB = nextMessage(b, m => m.type === 'match-start');
  send(a, 'start-match', { mode: 'convoy', difficulty: 'hard', arena: 'gotham' });
  const matchStartA = await nextMessage(a, m => m.type === 'match-start');
  const matchStartRemote = await matchStartB;
  assert.equal(matchStartA.players.length, 2);
  assert.equal(matchStartRemote.players.length, 2);
  assert.equal(matchStartA.mode, 'convoy');
  assert.equal(matchStartRemote.mode, 'convoy');
  assert.equal(matchStartA.difficulty, 'hard');
  assert.equal(matchStartRemote.difficulty, 'hard');
  assert.equal(matchStartA.arena, 'gotham');
  assert.equal(matchStartRemote.arena, 'gotham');

  const convergenceStartB = nextMessage(b, m => m.type === 'match-start' && m.mode === 'convergence');
  send(a, 'start-match', { mode: 'convergence', difficulty: 'expert', arena: 'themyscira' });
  const convergenceStartA = await nextMessage(a, m => m.type === 'match-start' && m.mode === 'convergence');
  const convergenceStartRemote = await convergenceStartB;
  assert.equal(convergenceStartA.mode, 'convergence');
  assert.equal(convergenceStartRemote.mode, 'convergence');
  assert.equal(convergenceStartA.difficulty, 'expert');
  assert.equal(convergenceStartRemote.arena, 'themyscira');

  const stateOnB = nextMessage(b, m => m.type === 'state' && m.id === helloA.playerId);
  send(a, 'state', {
    t: Date.now(),
    position: { x: 4, y: 0, z: -2 },
    rotationY: 1.2,
    hp: 650,
    alive: true
  });
  const relayedState = await stateOnB;
  assert.deepEqual(relayedState.position, { x: 4, y: 0, z: -2 });
  assert.equal(relayedState.hp, 700);

  const authorityAfterDamageB = nextMessage(b, m => m.type === 'player-authority' && m.id === helloB.playerId && m.hp === 297);
  send(a, 'combat-event', {
    event: {
      kind: 'damage',
      targetId: helloB.playerId,
      amount: 123,
      source: 'Heat Vision',
      sourceName: 'Superman',
      sourceTeam: 'blue',
      sourceId: helloA.playerId
    }
  });
  const authorityDamage = await authorityAfterDamageB;
  assert.equal(authorityDamage.maxHp, 420);
  assert.equal(authorityDamage.hp, 297);
  assert.equal(authorityDamage.alive, true);

  const healEventOnB = nextMessage(b, m => m.type === 'combat-event' && m.event?.kind === 'ability-effect' && m.event.effect === 'heal');
  const healAuthorityB = nextMessage(b, m => m.type === 'player-authority' && m.id === helloB.playerId && m.hp === 347);
  send(a, 'combat-event', {
    event: {
      kind: 'ability-effect',
      targetId: helloB.playerId,
      effect: 'heal',
      duration: 0,
      amount: 50,
      sourceName: 'Support',
      sourceTeam: 'red'
    }
  });
  await healEventOnB;
  const healAuthority = await healAuthorityB;
  assert.equal(healAuthority.hp, 347);

  const shieldEventOnB = nextMessage(b, m => m.type === 'combat-event' && m.event?.kind === 'ability-effect' && m.event.effect === 'shield');
  send(a, 'combat-event', {
    event: {
      kind: 'ability-effect',
      targetId: helloB.playerId,
      effect: 'shield',
      duration: 180,
      amount: 0,
      sourceName: 'Support',
      sourceTeam: 'red'
    }
  });
  await shieldEventOnB;

  const shieldedDamageOnB = nextMessage(b, m => m.type === 'combat-event' && m.event?.kind === 'damage' && m.event.amount < 100);
  const shieldedAuthorityB = nextMessage(b, m => m.type === 'player-authority' && m.id === helloB.playerId && m.hp < 347);
  send(a, 'combat-event', {
    event: {
      kind: 'damage',
      targetId: helloB.playerId,
      amount: 100,
      source: 'Heat Vision',
      sourceName: 'Superman',
      sourceTeam: 'blue',
      sourceId: helloA.playerId
    }
  });
  const shieldedDamage = await shieldedDamageOnB;
  const shieldedAuthority = await shieldedAuthorityB;
  assert.ok(Math.abs(shieldedDamage.event.amount - 42) < 0.01);
  assert.ok(Math.abs(shieldedAuthority.hp - 305) < 0.01);

  await new Promise(resolve => setTimeout(resolve, 220));

  const matchStateOnB = nextMessage(b, m => m.type === 'match-state');
  send(a, 'match-state', {
    state: {
      blueScore: 12.5,
      redScore: 7.25,
      objectiveState: 'ESCORTING · 32% · 120s',
      matchOver: false,
      convoyProgress: 32.5,
      convoyTimeRemaining: 120,
      convergencePhase: 'escort',
      convergenceBlueCapture: 100,
      convergenceRedCapture: 64,
      convergenceEscortTeam: 'blue',
      destructibles: [
        { id: 'nexus-a', hp: 90, alive: true },
        { id: 'nexus-b', hp: 0, alive: false }
      ],
      bots: [{
        slot: 0,
        team: 'blue',
        heroId: 'batman',
        position: { x: 2, y: 0, z: 3 },
        rotationY: 0.4,
        hp: 300,
        alive: true,
        kills: 2,
        deaths: 1
      }]
    }
  });
  const sharedState = await matchStateOnB;
  assert.equal(sharedState.hostId, helloA.playerId);
  assert.equal(sharedState.state.blueScore, 12.5);
  assert.equal(sharedState.state.convoyProgress, 32.5);
  assert.equal(sharedState.state.convoyTimeRemaining, 120);
  assert.equal(sharedState.state.convergencePhase, 'escort');
  assert.equal(sharedState.state.convergenceBlueCapture, 100);
  assert.equal(sharedState.state.convergenceRedCapture, 64);
  assert.equal(sharedState.state.convergenceEscortTeam, 'blue');
  assert.equal(sharedState.state.destructibles.length, 2);
  assert.equal(sharedState.state.destructibles[0].id, 'nexus-a');
  assert.equal(sharedState.state.destructibles[0].hp, 90);
  assert.equal(sharedState.state.destructibles[1].alive, false);
  assert.equal(sharedState.state.bots.length, 1);
  assert.equal(sharedState.state.bots[0].kills, 2);
  assert.equal(sharedState.state.bots[0].deaths, 1);

  const damageOnB = nextMessage(b, m => m.type === 'combat-event' && m.event?.kind === 'damage');
  const deathAuthorityB = nextMessage(b, m => m.type === 'player-authority' && m.id === helloB.playerId && m.alive === false);
  const teamKillOnAFromAuthority = nextMessage(a, m => m.type === 'combat-event' && m.event?.kind === 'team-kill' && m.event?.victimId === helloB.playerId);
  const statsAfterKillA = nextMessage(a, m => m.type === 'player-stats' && Array.isArray(m.stats) && m.stats.some(s => s.deaths > 0));
  send(a, 'combat-event', {
    event: {
      kind: 'damage',
      targetId: helloB.playerId,
      amount: 250,
      source: 'Worldbreaker',
      sourceName: 'Superman',
      sourceTeam: 'blue',
      sourceId: helloA.playerId
    }
  });
  const damage = await damageOnB;
  console.log('checkpoint: first damage');
  const secondDamageOnB = nextMessage(b, m => m.type === 'combat-event' && m.event?.kind === 'damage');
  send(a, 'combat-event', {
    event: {
      kind: 'damage',
      targetId: helloB.playerId,
      amount: 80,
      source: 'Heat Vision',
      sourceName: 'Superman',
      sourceTeam: 'blue',
      sourceId: helloA.playerId
    }
  });
  await secondDamageOnB;
  console.log('checkpoint: lethal damage routed');
  const deathAuthority = await deathAuthorityB;
  console.log('checkpoint: death authority');
  const authoritativeKill = await teamKillOnAFromAuthority;
  console.log('checkpoint: team kill');
  assert.equal(damage.event.amount, 250);
  assert.equal(damage.event.sourceTeam, 'blue');
  assert.equal(deathAuthority.hp, 0);
  assert.equal(deathAuthority.alive, false);
  assert.equal(authoritativeKill.event.team, 'blue');
  const statsAfterKill = await statsAfterKillA;
  console.log('checkpoint: player stats');
  const alphaStats = statsAfterKill.stats.find(s => s.id === helloA.playerId);
  const bravoStats = statsAfterKill.stats.find(s => s.id === helloB.playerId);
  assert.equal(alphaStats.kills, 1);
  assert.equal(alphaStats.deaths, 0);
  assert.equal(bravoStats.kills, 0);
  assert.equal(bravoStats.deaths, 1);

  const effectOnB = nextMessage(b, m => m.type === 'combat-event' && m.event?.kind === 'ability-effect');
  send(a, 'combat-event', {
    event: {
      kind: 'ability-effect',
      targetId: helloB.playerId,
      effect: 'slow',
      duration: 2600,
      amount: 0,
      sourceName: 'Superman',
      sourceTeam: 'blue',
      sourcePosition: { x: 1, y: 0, z: 1 }
    }
  });
  const effect = await effectOnB;
  console.log('checkpoint: ability effect');
  assert.equal(effect.event.effect, 'slow');
  assert.equal(effect.event.duration, 2600);
  assert.deepEqual(effect.event.sourcePosition, { x: 1, y: 0, z: 1 });

  const worldDamageOnHost = nextMessage(a, m => m.type === 'combat-event' && m.event?.kind === 'world-damage');
  send(b, 'combat-event', {
    event: {
      kind: 'world-damage',
      destructibleId: 'nexus-a',
      amount: 88,
      sourceName: 'Gorr the God Butcher'
    }
  });
  const worldDamage = await worldDamageOnHost;
  assert.equal(worldDamage.id, helloB.playerId);
  assert.equal(worldDamage.event.destructibleId, 'nexus-a');
  assert.equal(worldDamage.event.amount, 88);

    const botDamageOnHost = nextMessage(a, m => m.type === 'combat-event' && m.event?.kind === 'bot-damage');
  send(b, 'combat-event', {
    event: {
      kind: 'bot-damage',
      team: 'blue',
      slot: 0,
      amount: 77,
      source: 'Necrosword',
      sourceName: 'Gorr the God Butcher'
    }
  });
  const botDamage = await botDamageOnHost;
  console.log('checkpoint: bot damage');
  assert.equal(botDamage.id, helloB.playerId);
  assert.equal(botDamage.event.team, 'blue');
  assert.equal(botDamage.event.slot, 0);
  assert.equal(botDamage.event.amount, 77);

  const botEffectOnHost = nextMessage(a, m => m.type === 'combat-event' && m.event?.kind === 'bot-effect');
  send(b, 'combat-event', {
    event: {
      kind: 'bot-effect',
      team: 'blue',
      slot: 0,
      effect: 'root',
      duration: 1400,
      amount: 0,
      sourcePosition: { x: 5, y: 0, z: -4 }
    }
  });
  const botEffect = await botEffectOnHost;
  console.log('checkpoint: bot effect');
  assert.equal(botEffect.event.effect, 'root');
  assert.equal(botEffect.event.duration, 1400);
  assert.deepEqual(botEffect.event.sourcePosition, { x: 5, y: 0, z: -4 });

  const respawnAuthorityB = await nextMessage(b, m => m.type === 'player-authority' && m.id === helloB.playerId && m.alive === true, 7000);
  console.log('checkpoint: respawn authority');
  assert.equal(respawnAuthorityB.hp, respawnAuthorityB.maxHp);

  console.log('network integration: PASS');
} finally {
  try { a?.close(); } catch {}
  try { b?.close(); } catch {}
  server.kill('SIGTERM');
}
