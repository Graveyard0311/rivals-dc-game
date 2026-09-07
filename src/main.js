import * as THREE from 'three';
import './styles.css';
import { HEROES, getHero } from './heroes.js';

const app = document.querySelector('#app');
const TEAM_SIZE = 6;
const SCORE_TO_WIN = 100;
const RESPAWN_SECONDS = 5;
const BLUE_SPAWN = new THREE.Vector3(0, 0, 28);
const RED_SPAWN = new THREE.Vector3(0, 0, -28);
const OBJECTIVE_RADIUS = 6.5;

let selectedHero = HEROES.find(h => h.id === 'superman') || HEROES[0];
let matchStarted = false;
let matchOver = false;
let blueScore = 0;
let redScore = 0;
let playerDeaths = 0;
let playerKills = 0;
let respawnAt = 0;
let yaw = 0;
let pitch = -0.12;
let verticalVelocity = 0;
let grounded = true;
let lastShot = 0;
let abilityReadyAt = 0;
let ultimateCharge = 0;
let objectiveState = 'NEUTRAL';

app.innerHTML = `
  <div id="heroSelect" class="hero-select">
    <div class="select-card">
      <div class="eyebrow">PRIVATE DEMO BUILD · NEXUS ARENA</div>
      <h1>RIVALS: COLLISION</h1>
      <p>Choose your hero. You enter a full 6v6 objective match and bots fill every open slot.</p>
      <div id="roster" class="roster"></div>
      <button id="deployBtn" class="deploy">DEPLOY TO BATTLE</button>
    </div>
  </div>
  <div id="hud" class="hud hidden">
    <div class="topbar">
      <span id="blueScore" class="team blue">ALLIANCE 0</span>
      <span id="objectiveState" class="objective">CAPTURE THE NEXUS</span>
      <span id="redScore" class="team red">LEGION 0</span>
    </div>
    <div class="crosshair"></div>
    <div class="instructions">WASD move · Mouse aim · LMB primary · Shift ability · Q ultimate · Space jump</div>
    <div class="hero">
      <div id="heroName" class="hero-name"></div>
      <div id="heroRole" class="role"></div>
      <div class="health"><div id="healthFill"></div></div>
      <div class="hp"><span id="hp"></span> / <span id="maxHp"></span></div>
      <div class="stats">K <span id="kills">0</span> · D <span id="deaths">0</span></div>
    </div>
    <div class="abilities">
      <div class="ability"><div class="key">LMB</div><div id="primaryLabel" class="label"></div></div>
      <div class="ability"><div class="key">⇧</div><div id="abilityLabel" class="label"></div><div id="abilityCd" class="charge">READY</div></div>
      <div class="ability"><div class="key">Q</div><div id="ultLabel" class="label"></div><div id="ultCharge" class="charge">0%</div></div>
    </div>
    <div id="banner" class="banner"></div>
    <div id="killfeed" class="killfeed"></div>
  </div>
`;

const rosterEl = document.querySelector('#roster');
for (const hero of HEROES) {
  const b = document.createElement('button');
  b.className = 'hero-option' + (hero.id === selectedHero.id ? ' selected' : '');
  b.dataset.hero = hero.id;
  b.innerHTML = `<span class="universe">${hero.universe}</span><strong>${hero.name}</strong><small>${hero.role} · ${hero.primary}</small>`;
  b.onclick = () => {
    selectedHero = getHero(hero.id);
    [...rosterEl.children].forEach(x => x.classList.toggle('selected', x.dataset.hero === hero.id));
  };
  rosterEl.appendChild(b);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bc4e8);
scene.fog = new THREE.Fog(0x9bc4e8, 45, 115);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdbeeff, 0x29334b, 3.0));
const sun = new THREE.DirectionalLight(0xfff1d8, 3.6);
sun.position.set(28, 42, 18);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({ color: 0x465974, roughness: 0.82, metalness: 0.18 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(120, 60, 0x94b9e3, 0x566a86));

function makeBox(x, z, w, h, d, color = 0x60748e) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.24 })
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

[
  [-15,-11,10,7,7,0x546985],[14,-12,9,9,7,0x705a73],[-19,9,11,8,6,0x4f7180],
  [18,10,10,7,8,0x7a5967],[-31,-1,8,12,20,0x52627a],[31,1,8,12,20,0x615a76],
  [-9,0,4,3,8,0x607aa0],[9,0,4,3,8,0x896276],[0,-30,19,5,5,0x596f8d],[0,30,19,5,5,0x745d78]
].forEach(v => makeBox(...v));

for (let i = -2; i <= 2; i++) {
  const tower = makeBox(i * 18, -48, 10, 18 + Math.abs(i) * 5, 8, i % 2 ? 0x657b98 : 0x7087a4);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 2),
    new THREE.MeshBasicMaterial({ color: i % 2 ? 0x55aaff : 0xb86cff })
  );
  sign.position.set(tower.position.x, tower.position.y + 2, tower.position.z + 4.05);
  scene.add(sign);
}

const objective = new THREE.Mesh(
  new THREE.CylinderGeometry(5.6, 5.6, 0.35, 48),
  new THREE.MeshStandardMaterial({ color: 0x6d68ff, emissive: 0x3830d5, emissiveIntensity: 2.4, transparent: true, opacity: 0.78 })
);
objective.position.y = 0.2;
scene.add(objective);
const objectiveRing = new THREE.Mesh(
  new THREE.TorusGeometry(6.25, 0.14, 12, 64),
  new THREE.MeshBasicMaterial({ color: 0xe9f4ff })
);
objectiveRing.rotation.x = Math.PI / 2;
objectiveRing.position.y = 0.43;
scene.add(objectiveRing);

const effects = [];
function pulseEffect(position, color, radius = 3, duration = 0.45) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.7, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position).add(new THREE.Vector3(0, 0.08, 0));
  scene.add(mesh);
  effects.push({ mesh, age: 0, duration, radius });
}

function makeFighter(hero, team, isPlayer = false) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: hero.color, roughness: 0.35, metalness: 0.38 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, 1.05, 5, 10), mat);
  body.position.y = 1.18;
  body.castShadow = true;
  g.add(body);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshBasicMaterial({ color: team === 'blue' ? 0x70c8ff : 0xff667c })
  );
  marker.position.set(0, 2.15, 0);
  g.add(marker);

  g.userData = {
    hero, team, body, hp: hero.hp, maxHp: hero.hp, alive: true, isPlayer,
    respawnAt: 0, lastAttack: 0, target: null, abilityReadyAt: 0,
    ultReadyAt: 18000 + Math.random() * 9000, shieldUntil: 0,
    stunnedUntil: 0, empoweredUntil: 0
  };
  scene.add(g);
  return g;
}

let player = null;
const fighters = [];
const keys = {};
const raycaster = new THREE.Raycaster();

function spawnPosition(team, index = 0) {
  const base = team === 'blue' ? BLUE_SPAWN : RED_SPAWN;
  return base.clone().add(new THREE.Vector3((index % 3 - 1) * 2.4, 0, Math.floor(index / 3) * (team === 'blue' ? 2.2 : -2.2)));
}

function resetFighter(f, index = 0) {
  f.position.copy(spawnPosition(f.userData.team, index));
  f.userData.hp = f.userData.maxHp;
  f.userData.alive = true;
  f.visible = true;
  f.userData.target = null;
  f.userData.shieldUntil = 0;
  f.userData.stunnedUntil = 0;
  f.userData.empoweredUntil = 0;
}

function addKillFeed(text) {
  const feed = document.querySelector('#killfeed');
  const item = document.createElement('div');
  item.textContent = text;
  feed.prepend(item);
  while (feed.children.length > 5) feed.lastElementChild.remove();
  setTimeout(() => item.remove(), 5000);
}

function heal(target, amount) {
  if (!target?.userData.alive) return;
  target.userData.hp = Math.min(target.userData.maxHp, target.userData.hp + amount);
  pulseEffect(target.position, 0x72ffbf, 2.5, 0.35);
}

function damage(target, amount, attacker) {
  if (!target?.userData.alive || matchOver) return;
  const now = performance.now();
  let dealt = amount;
  if (target.userData.shieldUntil > now) dealt *= 0.42;
  if (attacker?.userData.empoweredUntil > now) dealt *= 1.55;
  target.userData.hp -= dealt;
  target.userData.body.material.emissive = new THREE.Color(0xffffff);
  setTimeout(() => target.userData?.body?.material?.emissive?.set(0x000000), 65);

  if (target.userData.hp <= 0) {
    target.userData.hp = 0;
    target.userData.alive = false;
    target.visible = false;
    target.userData.respawnAt = now + RESPAWN_SECONDS * 1000;
    const killerName = attacker?.userData.hero.name || 'Nexus';
    addKillFeed(`${killerName} eliminated ${target.userData.hero.name}`);
    if (attacker === player) {
      playerKills++;
      ultimateCharge = Math.min(100, ultimateCharge + 24);
    }
    if (target === player) {
      playerDeaths++;
      respawnAt = target.userData.respawnAt;
    }
  }
}

function living(team) {
  return fighters.filter(f => f.userData.team === team && f.userData.alive);
}

function nearestEnemy(f) {
  let best = null;
  let bestDist = Infinity;
  for (const other of fighters) {
    if (!other.userData.alive || other.userData.team === f.userData.team) continue;
    const d = f.position.distanceToSquared(other.position);
    if (d < bestDist) { best = other; bestDist = d; }
  }
  return best;
}

function lowestAlly(f) {
  return living(f.userData.team)
    .filter(x => x !== f)
    .sort((a, b) => (a.userData.hp / a.userData.maxHp) - (b.userData.hp / b.userData.maxHp))[0] || null;
}

function teamFor(team) {
  return fighters.filter(f => f.userData.team === team && f.userData.alive);
}

function startMatch() {
  if (matchStarted) return;
  matchStarted = true;
  matchOver = false;
  blueScore = 0;
  redScore = 0;
  playerKills = 0;
  playerDeaths = 0;
  ultimateCharge = 0;
  document.querySelector('#heroSelect').classList.add('hidden');
  document.querySelector('#hud').classList.remove('hidden');

  player = makeFighter(selectedHero, 'blue', true);
  fighters.push(player);
  const bluePool = HEROES.filter(h => h.id !== selectedHero.id);
  for (let i = 1; i < TEAM_SIZE; i++) fighters.push(makeFighter(bluePool[(i - 1) % bluePool.length], 'blue'));
  for (let i = 0; i < TEAM_SIZE; i++) fighters.push(makeFighter(HEROES[(i + 6) % HEROES.length], 'red'));

  fighters.filter(f => f.userData.team === 'blue').forEach((f, i) => resetFighter(f, i));
  fighters.filter(f => f.userData.team === 'red').forEach((f, i) => resetFighter(f, i));
  applyHudHero();
  renderer.domElement.requestPointerLock();
}

function applyHudHero() {
  const h = selectedHero;
  document.querySelector('#heroName').textContent = h.name;
  document.querySelector('#heroRole').textContent = `${h.universe} · ${h.role}`;
  document.querySelector('#maxHp').textContent = h.hp;
  document.querySelector('#primaryLabel').textContent = h.primary;
  document.querySelector('#abilityLabel').textContent = h.ability;
  document.querySelector('#ultLabel').textContent = h.ultimate;
}

document.querySelector('#deployBtn').onclick = startMatch;

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') usePlayerAbility();
  if (e.code === 'KeyQ') useUltimate();
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousemove', e => {
  if (document.pointerLockElement === renderer.domElement && matchStarted) {
    yaw -= e.movementX * 0.0022;
    pitch = Math.max(-0.75, Math.min(0.35, pitch - e.movementY * 0.0018));
  }
});
renderer.domElement.addEventListener('click', () => matchStarted && renderer.domElement.requestPointerLock());
addEventListener('mousedown', e => e.button === 0 && matchStarted && playerShoot());

function playerForward() {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function playerShoot() {
  if (!player?.userData.alive || performance.now() < player.userData.stunnedUntil) return;
  const now = performance.now();
  if (now - lastShot < selectedHero.fireRate * 1000) return;
  lastShot = now;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targets = fighters.filter(f => f.userData.team === 'red' && f.userData.alive).map(f => f.userData.body);
  const hits = raycaster.intersectObjects(targets);
  if (!hits.length) return;
  const target = fighters.find(f => f.userData.body === hits[0].object);
  if (target && player.position.distanceTo(target.position) <= selectedHero.range + 4) {
    damage(target, selectedHero.damage, player);
    ultimateCharge = Math.min(100, ultimateCharge + 4.5);
    pulseEffect(target.position, selectedHero.color, 1.5, 0.22);
  }
}

function activateAbility(actor, kind, isHuman = false) {
  const hero = actor.userData.hero;
  const now = performance.now();
  const enemyTeam = actor.userData.team === 'blue' ? 'red' : 'blue';
  const allies = teamFor(actor.userData.team);
  const enemies = teamFor(enemyTeam);

  if (kind === 'dash' || kind === 'blink') {
    let dir;
    if (isHuman) dir = playerForward();
    else if (actor.userData.target) dir = actor.userData.target.position.clone().sub(actor.position).setY(0).normalize();
    else dir = new THREE.Vector3(0, 0, actor.userData.team === 'blue' ? -1 : 1);
    actor.position.addScaledVector(dir, kind === 'blink' ? 8.5 : 6.5);
    pulseEffect(actor.position, hero.color, 3.2, 0.3);
  }
  if (kind === 'shield') {
    actor.userData.shieldUntil = now + 3200;
    pulseEffect(actor.position, 0x8bd7ff, 4, 0.5);
  }
  if (kind === 'teamShield') {
    allies.filter(a => a.position.distanceTo(actor.position) < 11).forEach(a => a.userData.shieldUntil = now + 3000);
    pulseEffect(actor.position, 0x70e8ff, 7, 0.6);
  }
  if (kind === 'heal') {
    allies.filter(a => a.position.distanceTo(actor.position) < 12).forEach(a => heal(a, a.userData.maxHp * 0.22));
    pulseEffect(actor.position, 0x6dffb3, 7, 0.6);
  }
  if (kind === 'burst') {
    enemies.filter(e => e.position.distanceTo(actor.position) < 10).forEach(e => damage(e, hero.damage * 1.4, actor));
    pulseEffect(actor.position, 0xd18cff, 8, 0.5);
  }
}

function usePlayerAbility() {
  if (!player?.userData.alive) return;
  const now = performance.now();
  if (now < abilityReadyAt) return;
  abilityReadyAt = now + selectedHero.abilityCooldown * 1000;
  activateAbility(player, selectedHero.abilityKind, true);
  showBanner(selectedHero.ability.toUpperCase(), 650);
}

function activateUltimate(actor, isHuman = false) {
  const hero = actor.userData.hero;
  const now = performance.now();
  const enemyTeam = actor.userData.team === 'blue' ? 'red' : 'blue';
  const allies = teamFor(actor.userData.team);
  const enemies = teamFor(enemyTeam);

  if (hero.ultKind === 'slam') {
    enemies.filter(e => e.position.distanceTo(actor.position) < 13).forEach(e => damage(e, Math.max(115, hero.damage * 3.2), actor));
    pulseEffect(actor.position, hero.color, 13, 0.8);
  }
  if (hero.ultKind === 'empower') {
    actor.userData.empoweredUntil = now + 8500;
    actor.userData.shieldUntil = now + 4000;
    pulseEffect(actor.position, hero.color, 8, 0.8);
  }
  if (hero.ultKind === 'stun') {
    enemies.filter(e => e.position.distanceTo(actor.position) < 14).forEach(e => e.userData.stunnedUntil = now + 3500);
    pulseEffect(actor.position, 0xb98cff, 14, 0.8);
  }
  if (hero.ultKind === 'teamHeal') {
    allies.forEach(a => heal(a, a.userData.maxHp * 0.42));
    allies.forEach(a => a.userData.shieldUntil = now + 2500);
    pulseEffect(actor.position, 0x6effc2, 15, 0.9);
  }
  if (isHuman) showBanner(hero.ultimate.toUpperCase(), 1400);
}

function useUltimate() {
  if (!player?.userData.alive || ultimateCharge < 100) return;
  ultimateCharge = 0;
  activateUltimate(player, true);
}

function showBanner(text, duration = 900) {
  const b = document.querySelector('#banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(showBanner.t);
  showBanner.t = setTimeout(() => b.classList.remove('show'), duration);
}

function updateBotAbility(bot, now) {
  const hero = bot.userData.hero;
  if (now >= bot.userData.abilityReadyAt) {
    let shouldUse = false;
    if (hero.role === 'Strategist') {
      const low = lowestAlly(bot);
      shouldUse = !!low && low.userData.hp / low.userData.maxHp < 0.62 && low.position.distanceTo(bot.position) < 14;
    } else if (hero.role === 'Vanguard') {
      shouldUse = bot.userData.hp / bot.userData.maxHp < 0.62 || Math.hypot(bot.position.x, bot.position.z) < 8;
    } else {
      shouldUse = !!bot.userData.target && bot.position.distanceTo(bot.userData.target.position) < Math.max(10, hero.range);
    }
    if (shouldUse) {
      activateAbility(bot, hero.abilityKind, false);
      bot.userData.abilityReadyAt = now + hero.abilityCooldown * 1000;
    }
  }

  if (now >= bot.userData.ultReadyAt) {
    const nearbyEnemies = living(bot.userData.team === 'blue' ? 'red' : 'blue').filter(e => e.position.distanceTo(bot.position) < 14).length;
    if (nearbyEnemies >= 2 || hero.role === 'Strategist') {
      activateUltimate(bot, false);
      bot.userData.ultReadyAt = now + 30000 + Math.random() * 12000;
    }
  }
}

function updateBots(dt, now) {
  for (const bot of fighters) {
    if (bot.userData.isPlayer || !bot.userData.alive || matchOver || now < bot.userData.stunnedUntil) continue;
    const hero = bot.userData.hero;
    let target = nearestEnemy(bot);
    bot.userData.target = target;
    updateBotAbility(bot, now);

    const point = new THREE.Vector3(0, 0, 0);
    let desired = point.clone().sub(bot.position);

    if (hero.role === 'Strategist') {
      const low = lowestAlly(bot);
      if (low && low.userData.hp / low.userData.maxHp < 0.72) desired = low.position.clone().sub(bot.position);
      else desired.multiplyScalar(0.75);
    } else if (hero.role === 'Duelist' && target) {
      const side = new THREE.Vector3(-(target.position.z - bot.position.z), 0, target.position.x - bot.position.x).normalize();
      desired = target.position.clone().sub(bot.position).addScaledVector(side, bot.userData.team === 'blue' ? 4 : -4);
    } else if (target && bot.position.distanceTo(target.position) < 14) {
      desired = target.position.clone().sub(bot.position);
    }

    if (target) {
      const dist = bot.position.distanceTo(target.position);
      const preferred = hero.role === 'Vanguard' ? Math.min(hero.range * 0.75, 6) : hero.role === 'Strategist' ? Math.max(hero.range * 0.75, 13) : Math.max(hero.range * 0.7, 7);
      if (dist < preferred) desired.add(target.position.clone().sub(bot.position).normalize().multiplyScalar(-5));
      bot.lookAt(target.position.x, bot.position.y, target.position.z);
    }

    if (desired.lengthSq() > 0.04) bot.position.addScaledVector(desired.normalize(), hero.speed * (hero.role === 'Duelist' ? 0.58 : 0.5) * dt);

    if (target) {
      const dist = bot.position.distanceTo(target.position);
      if (dist <= hero.range && now - bot.userData.lastAttack >= hero.fireRate * 1000) {
        bot.userData.lastAttack = now;
        const accuracy = hero.role === 'Duelist' ? 0.68 : hero.role === 'Strategist' ? 0.55 : 0.61;
        if (Math.random() < accuracy) damage(target, hero.damage * 0.52, bot);
      }
    }
  }
}

function updateRespawns(now) {
  for (const f of fighters) {
    if (f.userData.alive || now < f.userData.respawnAt || matchOver) continue;
    const sameTeam = fighters.filter(x => x.userData.team === f.userData.team);
    resetFighter(f, sameTeam.indexOf(f));
    if (f === player) showBanner('RESPAWNED');
  }
}

function updateObjective(dt) {
  const blueOn = living('blue').filter(f => Math.hypot(f.position.x, f.position.z) < OBJECTIVE_RADIUS).length;
  const redOn = living('red').filter(f => Math.hypot(f.position.x, f.position.z) < OBJECTIVE_RADIUS).length;

  if (blueOn > redOn) {
    blueScore = Math.min(SCORE_TO_WIN, blueScore + dt * (2.25 + blueOn * 0.3));
    objectiveState = `ALLIANCE CAPTURING · ${blueOn}`;
    objective.material.color.set(0x3c9dff);
    objective.material.emissive.set(0x1676d2);
  } else if (redOn > blueOn) {
    redScore = Math.min(SCORE_TO_WIN, redScore + dt * (2.25 + redOn * 0.3));
    objectiveState = `LEGION CAPTURING · ${redOn}`;
    objective.material.color.set(0xff536d);
    objective.material.emissive.set(0xb9213d);
  } else if (blueOn && redOn) {
    objectiveState = 'CONTESTED';
    objective.material.color.set(0xa070ff);
    objective.material.emissive.set(0x6237c8);
  } else {
    objectiveState = 'CAPTURE THE NEXUS';
    objective.material.color.set(0x6d68ff);
    objective.material.emissive.set(0x3830d5);
  }

  document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.floor(blueScore)}`;
  document.querySelector('#redScore').textContent = `LEGION ${Math.floor(redScore)}`;
  document.querySelector('#objectiveState').textContent = objectiveState;

  if (!matchOver && (blueScore >= SCORE_TO_WIN || redScore >= SCORE_TO_WIN)) {
    const winningBlue = blueScore >= SCORE_TO_WIN;
    const contested = blueOn > 0 && redOn > 0;
    if (contested) {
      document.querySelector('#objectiveState').textContent = 'OVERTIME · CONTESTED';
      if (winningBlue) blueScore = 99.8; else redScore = 99.8;
      return;
    }
    matchOver = true;
    showBanner(winningBlue ? 'ALLIANCE VICTORY' : 'LEGION VICTORY', 5000);
    setTimeout(() => location.reload(), 5200);
  }
}

function updatePlayer(dt, now) {
  if (!player?.userData.alive || matchOver || now < player.userData.stunnedUntil) return;
  const forward = playerForward();
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();
  if (keys.KeyW) move.add(forward);
  if (keys.KeyS) move.sub(forward);
  if (keys.KeyD) move.add(right);
  if (keys.KeyA) move.sub(right);
  if (move.lengthSq()) move.normalize();

  const speedBoost = player.userData.empoweredUntil > now ? 1.22 : 1;
  player.position.addScaledVector(move, selectedHero.speed * speedBoost * dt);

  if (keys.Space && grounded) { verticalVelocity = 8; grounded = false; }
  verticalVelocity -= 20 * dt;
  player.position.y += verticalVelocity * dt;
  if (player.position.y <= 0) {
    player.position.y = 0;
    verticalVelocity = 0;
    grounded = true;
  }
  player.rotation.y = yaw;

  const camOffset = new THREE.Vector3(0, 3.15, 6.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.lerp(player.position.clone().add(camOffset), 1 - Math.pow(0.001, dt));
  const aim = player.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(forward.clone().multiplyScalar(10));
  aim.y += Math.tan(pitch) * 10;
  camera.lookAt(aim);
}

function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const fx = effects[i];
    fx.age += dt;
    const t = Math.min(1, fx.age / fx.duration);
    const scale = 1 + t * fx.radius;
    fx.mesh.scale.setScalar(scale);
    fx.mesh.material.opacity = 0.9 * (1 - t);
    if (t >= 1) {
      scene.remove(fx.mesh);
      effects.splice(i, 1);
    }
  }
}

function updateHud(now) {
  if (!player) return;
  const hp = Math.max(0, Math.ceil(player.userData.hp));
  document.querySelector('#hp').textContent = hp;
  document.querySelector('#healthFill').style.width = `${100 * hp / player.userData.maxHp}%`;
  document.querySelector('#kills').textContent = playerKills;
  document.querySelector('#deaths').textContent = playerDeaths;
  document.querySelector('#ultCharge').textContent = `${Math.floor(ultimateCharge)}%`;
  const abilityRemaining = Math.max(0, (abilityReadyAt - now) / 1000);
  document.querySelector('#abilityCd').textContent = abilityRemaining > 0 ? abilityRemaining.toFixed(1) : 'READY';

  if (!player.userData.alive) {
    const remain = Math.max(0, Math.ceil((respawnAt - now) / 1000));
    showBanner(`RESPAWN IN ${remain}`, 300);
  } else if (now < player.userData.stunnedUntil) {
    showBanner('STUNNED', 250);
  }
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const now = performance.now();

  if (matchStarted) {
    updatePlayer(dt, now);
    updateBots(dt, now);
    updateRespawns(now);
    updateObjective(dt);
    updateHud(now);
  } else {
    camera.position.set(0, 20, 35);
    camera.lookAt(0, 0, 0);
  }

  updateEffects(dt);
  objectiveRing.rotation.z += dt * 0.42;
  objective.material.emissiveIntensity = 1.7 + Math.sin(now * 0.004) * 0.65;
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
