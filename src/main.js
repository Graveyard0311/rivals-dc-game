import * as THREE from 'three';
import './styles.css';
import { HEROES, getHero } from './heroes.js';

const app = document.querySelector('#app');

const TEAM_SIZE = 6;
const SCORE_TO_WIN = 100;
const RESPAWN_SECONDS = 5;
const BLUE_SPAWN = new THREE.Vector3(0, 0, 24);
const RED_SPAWN = new THREE.Vector3(0, 0, -24);

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

app.innerHTML = `
  <div id="heroSelect" class="hero-select">
    <div class="select-card">
      <div class="eyebrow">PRIVATE DEMO BUILD</div>
      <h1>RIVALS: COLLISION</h1>
      <p>Choose your hero. One human player enters a 6v6 match; bots fill every remaining slot.</p>
      <div id="roster" class="roster"></div>
      <button id="deployBtn" class="deploy">DEPLOY</button>
    </div>
  </div>
  <div id="hud" class="hud hidden">
    <div class="topbar">
      <span id="blueScore" class="team blue">ALLIANCE 0</span>
      <span class="objective">CAPTURE THE NEXUS</span>
      <span id="redScore" class="team red">LEGION 0</span>
    </div>
    <div class="crosshair"></div>
    <div class="instructions">WASD move · Mouse aim · LMB attack · Shift ability · Q ultimate · Space jump</div>
    <div class="hero">
      <div id="heroName" class="hero-name"></div>
      <div id="heroRole" class="role"></div>
      <div class="health"><div id="healthFill"></div></div>
      <div class="hp"><span id="hp"></span> / <span id="maxHp"></span></div>
      <div class="stats">K <span id="kills">0</span> · D <span id="deaths">0</span></div>
    </div>
    <div class="abilities">
      <div class="ability"><div class="key">LMB</div><div class="label">Primary</div></div>
      <div class="ability"><div class="key">⇧</div><div id="abilityLabel" class="label"></div></div>
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
  b.innerHTML = `<span class="universe">${hero.universe}</span><strong>${hero.name}</strong><small>${hero.role}</small>`;
  b.onclick = () => {
    selectedHero = getHero(hero.id);
    [...rosterEl.children].forEach(x => x.classList.toggle('selected', x.dataset.hero === hero.id));
  };
  rosterEl.appendChild(b);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a14);
scene.fog = new THREE.FogExp2(0x070a14, 0.014);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x879dff, 0x271a35, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(18, 28, 10);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(110, 110),
  new THREE.MeshStandardMaterial({ color: 0x171b29, roughness: 0.9, metalness: 0.1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(110, 55, 0x4f67a8, 0x242b44));

function makeBox(x, z, w, h, d, color = 0x2b3248) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 })
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
[
  [-14,-10,9,6,6,0x27334f],[13,-11,8,8,7,0x352c4b],[-18,8,11,7,6,0x293d49],
  [17,9,9,6,8,0x4a2c39],[-30,-1,7,11,18,0x252b3b],[30,1,7,11,18,0x2c263c],
  [-8,0,4,3,7,0x303a56],[8,0,4,3,7,0x4a3040],[0,-27,18,4,4,0x29344e],[0,27,18,4,4,0x3d2c3e]
].forEach(v => makeBox(...v));

const objective = new THREE.Mesh(
  new THREE.CylinderGeometry(5.5, 5.5, 0.35, 48),
  new THREE.MeshStandardMaterial({ color: 0x775cff, emissive: 0x3824b8, emissiveIntensity: 2, transparent: true, opacity: 0.75 })
);
objective.position.y = 0.2;
scene.add(objective);
const objectiveRing = new THREE.Mesh(
  new THREE.TorusGeometry(6.2, 0.13, 12, 64),
  new THREE.MeshBasicMaterial({ color: 0x9bbcff })
);
objectiveRing.rotation.x = Math.PI / 2;
objectiveRing.position.y = 0.42;
scene.add(objectiveRing);

function makeFighter(hero, team, isPlayer = false) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: hero.color,
    roughness: 0.38,
    metalness: 0.35
  });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, 1.05, 5, 10), mat);
  body.position.y = 1.18;
  body.castShadow = true;
  g.add(body);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshBasicMaterial({ color: team === 'blue' ? 0x75c8ff : 0xff6b7e })
  );
  marker.position.set(0, 2.15, 0);
  g.add(marker);

  g.userData = {
    hero, team, body, hp: hero.hp, maxHp: hero.hp, alive: true,
    isPlayer, respawnAt: 0, lastAttack: 0, target: null
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
  return base.clone().add(new THREE.Vector3((index % 3 - 1) * 2.3, 0, Math.floor(index / 3) * (team === 'blue' ? 2 : -2)));
}

function resetFighter(f, index = 0) {
  const p = spawnPosition(f.userData.team, index);
  f.position.copy(p);
  f.userData.hp = f.userData.maxHp;
  f.userData.alive = true;
  f.visible = true;
  f.userData.target = null;
}

function addKillFeed(text) {
  const feed = document.querySelector('#killfeed');
  const item = document.createElement('div');
  item.textContent = text;
  feed.prepend(item);
  while (feed.children.length > 5) feed.lastElementChild.remove();
  setTimeout(() => item.remove(), 5000);
}

function damage(target, amount, attacker) {
  if (!target?.userData.alive || matchOver) return;
  target.userData.hp -= amount;
  target.userData.body.material.emissive = new THREE.Color(0xffffff);
  setTimeout(() => {
    if (target.userData?.body) target.userData.body.material.emissive.set(0x000000);
  }, 60);

  if (target.userData.hp <= 0) {
    target.userData.hp = 0;
    target.userData.alive = false;
    target.visible = false;
    target.userData.respawnAt = performance.now() + RESPAWN_SECONDS * 1000;
    const killerName = attacker?.userData.hero.name || 'Nexus';
    addKillFeed(`${killerName} eliminated ${target.userData.hero.name}`);
    if (attacker === player) {
      playerKills++;
      ultimateCharge = Math.min(100, ultimateCharge + 28);
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

function startMatch() {
  if (matchStarted) return;
  matchStarted = true;
  blueScore = 0; redScore = 0; matchOver = false;
  playerKills = 0; playerDeaths = 0; ultimateCharge = 0;
  document.querySelector('#heroSelect').classList.add('hidden');
  document.querySelector('#hud').classList.remove('hidden');

  player = makeFighter(selectedHero, 'blue', true);
  fighters.push(player);
  for (let i = 1; i < TEAM_SIZE; i++) fighters.push(makeFighter(HEROES[(i + 1) % HEROES.length], 'blue'));
  for (let i = 0; i < TEAM_SIZE; i++) fighters.push(makeFighter(HEROES[(i + 7) % HEROES.length], 'red'));

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
  document.querySelector('#abilityLabel').textContent = h.ability;
  document.querySelector('#ultLabel').textContent = h.ultimate;
}

document.querySelector('#deployBtn').onclick = startMatch;

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyQ') useUltimate();
});
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('mousemove', e => {
  if (document.pointerLockElement === renderer.domElement && matchStarted) {
    yaw -= e.movementX * 0.0022;
    pitch = Math.max(-0.75, Math.min(0.35, pitch - e.movementY * 0.0018));
  }
});
renderer.domElement.addEventListener('click', () => {
  if (matchStarted) renderer.domElement.requestPointerLock();
});
addEventListener('mousedown', e => {
  if (e.button === 0 && matchStarted) playerShoot();
});

function playerShoot() {
  if (!player?.userData.alive) return;
  const now = performance.now();
  if (now - lastShot < selectedHero.fireRate * 1000) return;
  lastShot = now;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targets = fighters.filter(f => f.userData.team === 'red' && f.userData.alive).map(f => f.userData.body);
  const hits = raycaster.intersectObjects(targets);
  if (hits.length) {
    const body = hits[0].object;
    const target = fighters.find(f => f.userData.body === body);
    if (target && player.position.distanceTo(target.position) <= selectedHero.range + 5) {
      damage(target, selectedHero.damage, player);
      ultimateCharge = Math.min(100, ultimateCharge + 4);
    }
  }
}

function useUltimate() {
  if (!player?.userData.alive || ultimateCharge < 100) return;
  ultimateCharge = 0;
  const enemies = fighters.filter(f => f.userData.team === 'red' && f.userData.alive && f.position.distanceTo(player.position) < 12);
  enemies.forEach(e => damage(e, Math.max(90, selectedHero.damage * 3), player));
  showBanner(selectedHero.ultimate.toUpperCase(), 1200);
}

function showBanner(text, duration = 900) {
  const b = document.querySelector('#banner');
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(showBanner.t);
  showBanner.t = setTimeout(() => b.classList.remove('show'), duration);
}

function updateBots(dt, now) {
  for (const bot of fighters) {
    if (bot.userData.isPlayer || !bot.userData.alive || matchOver) continue;

    const target = nearestEnemy(bot);
    if (!target) continue;
    bot.userData.target = target;

    const toTarget = target.position.clone().sub(bot.position);
    toTarget.y = 0;
    const dist = toTarget.length();
    const toPoint = new THREE.Vector3(0, 0, 0).sub(bot.position);
    toPoint.y = 0;
    const hero = bot.userData.hero;

    let moveDir;
    if (dist < hero.range * 0.85) {
      moveDir = toTarget.clone().multiplyScalar(-0.25).add(toPoint.normalize().multiplyScalar(0.45));
    } else if (dist < 18) {
      moveDir = toTarget;
    } else {
      moveDir = toPoint;
    }
    if (moveDir.lengthSq() > 0.01) bot.position.addScaledVector(moveDir.normalize(), hero.speed * 0.48 * dt);
    bot.lookAt(target.position.x, bot.position.y, target.position.z);

    if (dist <= hero.range && now - bot.userData.lastAttack >= hero.fireRate * 1000) {
      bot.userData.lastAttack = now;
      const accuracy = 0.54 + Math.min(0.25, (hero.range - dist) / Math.max(hero.range, 1) * 0.3);
      if (Math.random() < accuracy) damage(target, hero.damage * 0.55, bot);
    }
  }
}

function updateRespawns(now) {
  const teams = { blue: 0, red: 0 };
  for (const f of fighters) {
    if (f.userData.alive) { teams[f.userData.team]++; continue; }
    if (now >= f.userData.respawnAt && !matchOver) {
      const sameTeam = fighters.filter(x => x.userData.team === f.userData.team);
      resetFighter(f, sameTeam.indexOf(f));
      if (f === player) showBanner('RESPAWNED');
    }
  }
  return teams;
}

function updateObjective(dt) {
  const radius = 6.4;
  const blueOn = living('blue').filter(f => Math.hypot(f.position.x, f.position.z) < radius).length;
  const redOn = living('red').filter(f => Math.hypot(f.position.x, f.position.z) < radius).length;

  if (blueOn > redOn) blueScore = Math.min(SCORE_TO_WIN, blueScore + dt * (2.3 + blueOn * 0.25));
  if (redOn > blueOn) redScore = Math.min(SCORE_TO_WIN, redScore + dt * (2.3 + redOn * 0.25));

  document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.floor(blueScore)}`;
  document.querySelector('#redScore').textContent = `LEGION ${Math.floor(redScore)}`;

  if (!matchOver && (blueScore >= SCORE_TO_WIN || redScore >= SCORE_TO_WIN)) {
    matchOver = true;
    showBanner(blueScore >= SCORE_TO_WIN ? 'ALLIANCE VICTORY' : 'LEGION VICTORY', 5000);
    setTimeout(() => location.reload(), 5200);
  }
}

function updatePlayer(dt) {
  if (!player?.userData.alive || matchOver) return;
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();
  if (keys.KeyW) move.add(forward);
  if (keys.KeyS) move.sub(forward);
  if (keys.KeyD) move.add(right);
  if (keys.KeyA) move.sub(right);
  if (move.lengthSq()) move.normalize();

  let speed = selectedHero.speed;
  const now = performance.now();
  if ((keys.ShiftLeft || keys.ShiftRight) && now >= abilityReadyAt && move.lengthSq()) {
    speed *= 3.1;
    abilityReadyAt = now + 4500;
  }
  player.position.addScaledVector(move, speed * dt);

  if (keys.Space && grounded) { verticalVelocity = 8; grounded = false; }
  verticalVelocity -= 20 * dt;
  player.position.y += verticalVelocity * dt;
  if (player.position.y <= 0) {
    player.position.y = 0;
    verticalVelocity = 0;
    grounded = true;
  }
  player.rotation.y = yaw;

  const camOffset = new THREE.Vector3(0, 3.2, 6.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.lerp(player.position.clone().add(camOffset), 1 - Math.pow(0.001, dt));
  const aim = player.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(forward.clone().multiplyScalar(10));
  aim.y += Math.tan(pitch) * 10;
  camera.lookAt(aim);
}

function updateHud() {
  if (!player) return;
  const hp = Math.max(0, Math.ceil(player.userData.hp));
  document.querySelector('#hp').textContent = hp;
  document.querySelector('#healthFill').style.width = `${100 * hp / player.userData.maxHp}%`;
  document.querySelector('#kills').textContent = playerKills;
  document.querySelector('#deaths').textContent = playerDeaths;
  document.querySelector('#ultCharge').textContent = `${Math.floor(ultimateCharge)}%`;

  if (!player.userData.alive) {
    const remain = Math.max(0, Math.ceil((respawnAt - performance.now()) / 1000));
    showBanner(`RESPAWN IN ${remain}`, 300);
  }
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const now = performance.now();

  if (matchStarted) {
    updatePlayer(dt);
    updateBots(dt, now);
    updateRespawns(now);
    updateObjective(dt);
    updateHud();
  } else {
    camera.position.set(0, 18, 32);
    camera.lookAt(0, 0, 0);
  }

  objectiveRing.rotation.z += dt * 0.4;
  objective.material.emissiveIntensity = 1.5 + Math.sin(now * 0.004) * 0.6;
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
