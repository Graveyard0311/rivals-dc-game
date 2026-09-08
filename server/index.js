import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';
import { getHero } from '../src/heroes.js';

const PORT = Number(process.env.PORT || 8787);
const wss = new WebSocketServer({ port: PORT });
const lobbies = new Map();
const RESPAWN_MS = 5000;

function authoritativePlayerState(id, player) {
  return {
    type: 'player-authority',
    id,
    hp: player.hp,
    maxHp: player.maxHp,
    alive: player.alive,
    respawnAt: player.respawnAt || 0
  };
}

function broadcastPlayerAuthority(lobby, id) {
  const player = lobby.clients.get(id);
  if (!player) return;
  broadcast(lobby, authoritativePlayerState(id, player));
}

function resetPlayerCombatState(player) {
  const hero = getHero(player.heroId);
  player.maxHp = hero.hp;
  player.hp = hero.hp;
  player.alive = true;
  player.respawnAt = 0;
  player.shieldUntil = 0;
}

function code() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(lobby, payload, exceptId = null) {
  for (const [id, client] of lobby.clients) {
    if (id === exceptId) continue;
    send(client.ws, payload);
  }
}

function snapshot(lobby) {
  return [...lobby.clients.entries()].map(([id, c]) => ({
    id,
    name: c.name,
    heroId: c.heroId,
    team: c.team
  }));
}

function statsSnapshot(lobby) {
  return [...lobby.clients.entries()].map(([id, c]) => ({
    id,
    kills: Number(c.kills || 0),
    deaths: Number(c.deaths || 0)
  }));
}

function broadcastPlayerStats(lobby) {
  broadcast(lobby, { type: 'player-stats', stats: statsSnapshot(lobby) });
}

function assignTeam(lobby) {
  let blue = 0, red = 0;
  for (const c of lobby.clients.values()) c.team === 'blue' ? blue++ : red++;
  return blue <= red ? 'blue' : 'red';
}

function leaveCurrent(ws) {
  const lobbyCode = ws.meta?.lobbyCode;
  const id = ws.meta?.id;
  if (!lobbyCode || !id) return;
  const lobby = lobbies.get(lobbyCode);
  if (!lobby) return;

  lobby.clients.delete(id);
  broadcast(lobby, { type: 'player-left', id, players: snapshot(lobby) });

  if (!lobby.clients.size) {
    lobbies.delete(lobbyCode);
    return;
  }

  if (lobby.hostId === id) {
    lobby.hostId = lobby.clients.keys().next().value;
    broadcast(lobby, { type: 'host-changed', hostId: lobby.hostId });
  }
}

function joinLobby(ws, lobby, lobbyCode, msg) {
  const id = ws.meta.id;
  const heroId = String(msg.heroId || 'superman');
  const hero = getHero(heroId);
  const player = {
    ws,
    name: String(msg.name || 'Player').slice(0, 24),
    heroId,
    team: assignTeam(lobby),
    maxHp: hero.hp,
    hp: hero.hp,
    alive: true,
    respawnAt: 0,
    shieldUntil: 0,
    kills: 0,
    deaths: 0
  };
  lobby.clients.set(id, player);
  ws.meta.lobbyCode = lobbyCode;

  send(ws, {
    type: 'joined',
    lobbyCode,
    playerId: id,
    hostId: lobby.hostId,
    team: player.team,
    players: snapshot(lobby)
  });
  broadcast(lobby, { type: 'player-joined', player: snapshot(lobby).find(p => p.id === id), players: snapshot(lobby) }, id);
}

wss.on('connection', ws => {
  ws.meta = { id: crypto.randomUUID(), lobbyCode: null };

  send(ws, { type: 'hello', playerId: ws.meta.id });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'create-lobby') {
      leaveCurrent(ws);
      let lobbyCode = code();
      while (lobbies.has(lobbyCode)) lobbyCode = code();
      const lobby = { hostId: ws.meta.id, clients: new Map() };
      lobbies.set(lobbyCode, lobby);
      joinLobby(ws, lobby, lobbyCode, msg);
      return;
    }

    if (msg.type === 'join-lobby') {
      leaveCurrent(ws);
      const lobbyCode = String(msg.lobbyCode || '').trim().toUpperCase();
      const lobby = lobbies.get(lobbyCode);
      if (!lobby) return send(ws, { type: 'error', code: 'LOBBY_NOT_FOUND' });
      if (lobby.clients.size >= 12) return send(ws, { type: 'error', code: 'LOBBY_FULL' });
      joinLobby(ws, lobby, lobbyCode, msg);
      return;
    }

    const lobbyCode = ws.meta.lobbyCode;
    const lobby = lobbyCode && lobbies.get(lobbyCode);
    if (!lobby) return;

    const self = lobby.clients.get(ws.meta.id);
    if (!self) return;

    if (msg.type === 'set-hero') {
      self.heroId = String(msg.heroId || self.heroId);
      if (!self.alive) resetPlayerCombatState(self);
      else {
        const hero = getHero(self.heroId);
        self.maxHp = hero.hp;
        self.hp = Math.min(self.hp, self.maxHp);
      }
      broadcast(lobby, { type: 'player-updated', id: ws.meta.id, heroId: self.heroId, players: snapshot(lobby) });
      broadcastPlayerAuthority(lobby, ws.meta.id);
      return;
    }

    if (msg.type === 'start-match') {
      if (lobby.hostId !== ws.meta.id) return;
      for (const player of lobby.clients.values()) {
        resetPlayerCombatState(player);
        player.kills = 0;
        player.deaths = 0;
      }
      const mode = ['domination', 'tdm', 'convoy', 'convergence'].includes(msg.mode) ? msg.mode : 'domination';
      const difficulty = ['easy', 'normal', 'hard', 'expert'].includes(msg.difficulty) ? msg.difficulty : 'normal';
      const arena = ['nexus', 'gotham', 'themyscira'].includes(msg.arena) ? msg.arena : 'nexus';
      broadcast(lobby, { type: 'match-start', mode, difficulty, arena, seed: crypto.randomInt(0, 2 ** 31 - 1), players: snapshot(lobby) });
      for (const [id] of lobby.clients) broadcastPlayerAuthority(lobby, id);
      broadcastPlayerStats(lobby);
      return;
    }

    if (msg.type === 'state') {
      broadcast(lobby, {
        type: 'state',
        id: ws.meta.id,
        t: Number(msg.t || Date.now()),
        position: msg.position,
        rotationY: Number(msg.rotationY || 0),
        hp: self.hp,
        alive: self.alive
      }, ws.meta.id);
      return;
    }

    if (msg.type === 'match-state') {
      if (lobby.hostId !== ws.meta.id) return;
      const state = msg.state || {};
      const destructibles = Array.isArray(state.destructibles) ? state.destructibles.slice(0, 12).map(prop => ({
        id: String(prop.id || '').slice(0, 48),
        hp: Math.max(0, Number(prop.hp || 0)),
        alive: Boolean(prop.alive)
      })) : [];
      const bots = Array.isArray(state.bots) ? state.bots.slice(0, 12).map(bot => ({
        slot: Number(bot.slot),
        team: bot.team === 'red' ? 'red' : 'blue',
        heroId: String(bot.heroId || 'superman').slice(0, 48),
        position: bot.position,
        rotationY: Number(bot.rotationY || 0),
        hp: Math.max(0, Number(bot.hp || 0)),
        alive: Boolean(bot.alive),
        kills: Math.max(0, Math.floor(Number(bot.kills || 0))),
        deaths: Math.max(0, Math.floor(Number(bot.deaths || 0)))
      })) : [];
      broadcast(lobby, {
        type: 'match-state',
        hostId: ws.meta.id,
        state: {
          blueScore: Math.max(0, Math.min(100, Number(state.blueScore || 0))),
          redScore: Math.max(0, Math.min(100, Number(state.redScore || 0))),
          objectiveState: String(state.objectiveState || 'CAPTURE THE NEXUS').slice(0, 64),
          matchOver: Boolean(state.matchOver),
          convoyProgress: Math.max(0, Math.min(100, Number(state.convoyProgress || 0))),
          convoyTimeRemaining: Math.max(0, Math.min(300, Number(state.convoyTimeRemaining || 0))),
          convergencePhase: state.convergencePhase === 'escort' ? 'escort' : 'capture',
          convergenceBlueCapture: Math.max(0, Math.min(100, Number(state.convergenceBlueCapture || 0))),
          convergenceRedCapture: Math.max(0, Math.min(100, Number(state.convergenceRedCapture || 0))),
          convergenceEscortTeam: state.convergenceEscortTeam === 'red' ? 'red' : 'blue',
          destructibles,
          bots
        }
      }, ws.meta.id);
      return;
    }

    if (msg.type === 'combat-event') {
      const event = msg.event || {};

      if (event.kind === 'damage') {
        const targetId = String(event.targetId || '');
        const target = lobby.clients.get(targetId);
        const amount = Number(event.amount);
        const sourceTeam = lobby.hostId === ws.meta.id && (event.sourceTeam === 'blue' || event.sourceTeam === 'red')
          ? event.sourceTeam
          : self.team;
        if (!target || target.team === sourceTeam || !target.alive || !Number.isFinite(amount) || amount <= 0) return;
        let dealt = Math.min(amount, 250);
        if (Number(target.shieldUntil || 0) > Date.now()) dealt *= 0.42;
        const claimedSourceId = String(event.sourceId || '');
        const sourcePlayer = claimedSourceId ? lobby.clients.get(claimedSourceId) : null;
        const authoritativeSourceId = sourcePlayer && sourcePlayer.team === sourceTeam ? claimedSourceId : '';
        target.hp = Math.max(0, target.hp - dealt);
        let killed = false;
        if (target.hp <= 0) {
          target.alive = false;
          target.respawnAt = Date.now() + RESPAWN_MS;
          target.deaths = Number(target.deaths || 0) + 1;
          if (authoritativeSourceId) {
            const killer = lobby.clients.get(authoritativeSourceId);
            if (killer) killer.kills = Number(killer.kills || 0) + 1;
          }
          killed = true;
        }

        send(target.ws, {
          type: 'combat-event',
          id: authoritativeSourceId || '',
          event: {
            kind: 'damage',
            amount: dealt,
            source: String(event.source || 'attack').slice(0, 48),
            sourceName: String(event.sourceName || self.name || 'Opponent').slice(0, 48),
            sourceTeam
          }
        });
        broadcastPlayerAuthority(lobby, targetId);

        if (killed) {
          broadcast(lobby, {
            type: 'combat-event',
            id: authoritativeSourceId,
            event: {
              kind: 'team-kill',
              team: sourceTeam,
              victimId: targetId,
              killerId: authoritativeSourceId,
              sourceName: String(event.sourceName || (authoritativeSourceId ? lobby.clients.get(authoritativeSourceId)?.name : '') || 'Opponent').slice(0, 48)
            }
          });
          broadcastPlayerStats(lobby);
        }
        return;
      }

      if (event.kind === 'ability-effect') {
        const targetId = String(event.targetId || '');
        const target = lobby.clients.get(targetId);
        const effect = String(event.effect || '');
        const duration = Math.max(0, Math.min(5000, Number(event.duration || 0)));
        const amount = Math.max(0, Math.min(500, Number(event.amount || 0)));
        const sourceTeam = lobby.hostId === ws.meta.id && (event.sourceTeam === 'blue' || event.sourceTeam === 'red')
          ? event.sourceTeam
          : self.team;
        const hostile = ['slow', 'root', 'stun', 'knockback'].includes(effect);
        const friendly = ['heal', 'shield', 'haste'].includes(effect);
        if (!target || (!hostile && !friendly)) return;
        if (hostile && target.team === sourceTeam) return;
        if (friendly && target.team !== sourceTeam) return;

        if (friendly && !target.alive) return;
        if (effect === 'heal') {
          target.hp = Math.min(target.maxHp, target.hp + amount);
          broadcastPlayerAuthority(lobby, targetId);
        }
        if (effect === 'shield') {
          target.shieldUntil = Math.max(Number(target.shieldUntil || 0), Date.now() + duration);
        }

        send(target.ws, {
          type: 'combat-event',
          id: String(event.sourceId || ws.meta.id),
          event: {
            kind: 'ability-effect',
            effect,
            duration,
            amount,
            sourceName: String(event.sourceName || self.name || 'Ally').slice(0, 48),
            sourceTeam,
            sourcePosition: event.sourcePosition && Number.isFinite(Number(event.sourcePosition.x)) && Number.isFinite(Number(event.sourcePosition.z))
              ? { x: Number(event.sourcePosition.x), y: Number(event.sourcePosition.y || 0), z: Number(event.sourcePosition.z) }
              : null
          }
        });
        return;
      }

      if (event.kind === 'world-damage') {
        if (lobby.hostId === ws.meta.id) return;
        const host = lobby.clients.get(lobby.hostId);
        const destructibleId = String(event.destructibleId || '').slice(0, 48);
        const amount = Number(event.amount);
        if (!host || !destructibleId || !Number.isFinite(amount) || amount <= 0) return;
        send(host.ws, {
          type: 'combat-event',
          id: ws.meta.id,
          event: {
            kind: 'world-damage',
            destructibleId,
            amount: Math.min(amount, 400),
            sourceName: String(self.name || 'Player').slice(0, 48)
          }
        });
        return;
      }

      if (event.kind === 'bot-damage') {
        if (lobby.hostId === ws.meta.id) return;
        const host = lobby.clients.get(lobby.hostId);
        const team = event.team === 'red' ? 'red' : 'blue';
        const slot = Number(event.slot);
        const amount = Number(event.amount);
        if (!host || team === self.team || !Number.isInteger(slot) || slot < 0 || slot > 5 || !Number.isFinite(amount) || amount <= 0) return;
        send(host.ws, {
          type: 'combat-event',
          id: ws.meta.id,
          event: {
            kind: 'bot-damage',
            team,
            slot,
            amount: Math.min(amount, 250),
            source: String(event.source || 'attack').slice(0, 48),
            sourceName: String(self.name || 'Player').slice(0, 48)
          }
        });
        return;
      }

      if (event.kind === 'bot-effect') {
        if (lobby.hostId === ws.meta.id) return;
        const host = lobby.clients.get(lobby.hostId);
        const team = event.team === 'red' ? 'red' : 'blue';
        const slot = Number(event.slot);
        const effect = String(event.effect || '');
        const duration = Math.max(0, Math.min(5000, Number(event.duration || 0)));
        const amount = Math.max(0, Math.min(500, Number(event.amount || 0)));
        const hostile = ['slow', 'root', 'stun', 'knockback'].includes(effect);
        const friendly = ['heal', 'shield', 'haste'].includes(effect);
        if (!host || !Number.isInteger(slot) || slot < 0 || slot > 5 || (!hostile && !friendly)) return;
        if (hostile && team === self.team) return;
        if (friendly && team !== self.team) return;
        send(host.ws, {
          type: 'combat-event',
          id: ws.meta.id,
          event: {
            kind: 'bot-effect',
            team,
            slot,
            effect,
            duration,
            amount,
            sourcePosition: event.sourcePosition && Number.isFinite(Number(event.sourcePosition.x)) && Number.isFinite(Number(event.sourcePosition.z))
              ? { x: Number(event.sourcePosition.x), y: Number(event.sourcePosition.y || 0), z: Number(event.sourcePosition.z) }
              : null
          }
        });
        return;
      }

      if (event.kind === 'death-confirmed') {
        return;
      }
    }
  });

  ws.on('close', () => leaveCurrent(ws));
  ws.on('error', () => leaveCurrent(ws));
});

const respawnTimer = setInterval(() => {
  const now = Date.now();
  for (const lobby of lobbies.values()) {
    for (const [id, player] of lobby.clients) {
      if (player.alive || !player.respawnAt || now < player.respawnAt) continue;
      resetPlayerCombatState(player);
      broadcastPlayerAuthority(lobby, id);
    }
  }
}, 250);
respawnTimer.unref?.();

console.log(`Rivals Collision WebSocket server listening on ws://localhost:${PORT}`);
