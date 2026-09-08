import * as THREE from 'three';
import './styles.css';
import { HEROES, getHero } from './heroes.js';
import { NetworkClient } from './network.js';
import { loadSettings, saveSettings, resetSettings, keyLabel } from './settings.js';
import { preferredTeamUp } from './teamups.js';
import { getBotDifficulty } from './bot-difficulty.js';
import { getArena } from './arenas.js';

const app = document.querySelector('#app');
const TEAM_SIZE = 6;
const DOMINATION_SCORE_TO_WIN = 100;
const TDM_SCORE_TO_WIN = 30;
const CONVOY_SECONDS = 180;
const CONVOY_RADIUS = 6;
const CONVERGENCE_CAPTURE_TO_WIN = 100;
const CONVERGENCE_ESCORT_SECONDS = 150;
const RESPAWN_SECONDS = 5;
const BLUE_SPAWN = new THREE.Vector3(0, 0, 28);
const RED_SPAWN = new THREE.Vector3(0, 0, -28);
const OBJECTIVE_RADIUS = 6.5;

let selectedHero = HEROES.find(h => h.id === 'superman') || HEROES[0];
let selectedMode = 'domination';
let selectedBotDifficulty = 'normal';
let selectedArena = 'nexus';
let matchStarted = false;
let matchOver = false;
let blueScore = 0;
let redScore = 0;
let convoyProgress = 0;
let convoyTimeRemaining = CONVOY_SECONDS;
let convoyEndsAt = 0;
let convergencePhase = 'capture';
let convergenceBlueCapture = 0;
let convergenceRedCapture = 0;
let convergenceEscortTeam = 'blue';
let playerDeaths = 0;
let playerKills = 0;
let respawnAt = 0;
let yaw = 0;
let pitch = -0.12;
let verticalVelocity = 0;
let grounded = true;
let cameraShake = 0;
let lastShot = 0;
let abilityReadyAt = 0;
let secondaryReadyAt = 0;
let ultimateCharge = 0;
let heroResource = 0;
let lastResourcePosition = new THREE.Vector3();
let flightUntil = 0;
let temporalHistory = [];
let lastTemporalSampleAt = 0;
let teamUpReadyAt = 0;
let activeTeamUp = null;
let audioCtx = null;
let objectiveState = 'NEUTRAL';
let settings = loadSettings();
let pendingBind = null;
const network = new NetworkClient();
let joinedLobby = false;
let lobbyHostId = null;
let lastNetworkStateAt = 0;
let lastMatchStateAt = 0;
let networkPlayers = [];
const remoteFighters = new Map();

app.innerHTML = `
  <div id="heroSelect" class="hero-select">
    <div class="select-card">
      <div class="eyebrow">PRIVATE DEMO BUILD · NEXUS ARENA</div>
      <h1>RIVALS: COLLISION</h1>
      <p>Choose your hero and match mode. Bots fill every open slot.</p>
      <div class="mode-select">
        <button class="mode-option selected" data-mode="domination"><strong>DOMINATION</strong><small>Capture and hold the Nexus · First to 100</small></button>
        <button class="mode-option" data-mode="tdm"><strong>TEAM DEATHMATCH</strong><small>Eliminations score · First to 30</small></button>
        <button class="mode-option" data-mode="convoy"><strong>CONVOY</strong><small>Alliance escorts · Legion defends · 3:00</small></button>
        <button class="mode-option" data-mode="convergence"><strong>CONVERGENCE</strong><small>Capture first · Winner escorts the payload</small></button>
      </div>
      <div class="difficulty-select">
        <label for="botDifficulty">BOT DIFFICULTY</label>
        <select id="botDifficulty">
          <option value="easy">Easy</option>
          <option value="normal" selected>Normal</option>
          <option value="hard">Hard</option>
          <option value="expert">Expert</option>
        </select>
      </div>
      <div class="arena-select">
        <button class="arena-option selected" data-arena="nexus"><strong>NEXUS ARENA</strong><small>Balanced city combat</small></button>
        <button class="arena-option" data-arena="gotham"><strong>GOTHAM INDUSTRIAL</strong><small>Tight alleys and hard flanks</small></button>
        <button class="arena-option" data-arena="themyscira"><strong>THEMYSCIRA RUINS</strong><small>Open lanes and temple cover</small></button>
      </div>
      <div id="roster" class="roster"></div>
      <details class="settings-panel">
        <summary>SETTINGS & KEYBINDS</summary>
        <div class="settings-grid">
          <label>Mouse sensitivity <input id="mouseSensitivity" type="range" min="0.0008" max="0.006" step="0.0001"><span id="mouseSensitivityValue"></span></label>
          <label>Field of view <input id="fovSetting" type="range" min="70" max="110" step="1"><span id="fovValue"></span></label>
          <label>Master volume <input id="masterVolume" type="range" min="0" max="1" step="0.05"><span id="masterVolumeValue"></span></label>
          <label class="toggle-setting"><input id="reducedCameraShake" type="checkbox"> Reduced camera shake</label>
          <label class="toggle-setting"><input id="showHealthBars" type="checkbox"> Show combatant health bars</label>
        </div>
        <div id="keybindGrid" class="keybind-grid"></div>
        <button id="resetSettingsBtn" class="network-btn settings-reset">RESET SETTINGS</button>
      </details>
      <div class="network-panel">
        <input id="playerName" maxlength="24" placeholder="Player name" value="Player">
        <input id="lobbyCode" maxlength="6" placeholder="Lobby code">
        <button id="createLobbyBtn" class="network-btn">CREATE PRIVATE LOBBY</button>
        <button id="joinLobbyBtn" class="network-btn">JOIN LOBBY</button>
        <div id="networkStatus" class="network-status">Offline mode ready</div>
      </div>
      <button id="deployBtn" class="deploy">DEPLOY OFFLINE BATTLE</button>
    </div>
  </div>
  <div id="hud" class="hud hidden">
    <div class="topbar">
      <span id="blueScore" class="team blue">ALLIANCE 0</span>
      <span id="objectiveState" class="objective">CAPTURE THE NEXUS</span>
      <span id="redScore" class="team red">LEGION 0</span>
    </div>
    <div class="crosshair"></div><div id="damagePop" class="damage-pop"></div>
    <div class="instructions">WASD move · Mouse aim · LMB primary · Shift ability · Q ultimate · Space jump</div>
    <div class="hero">
      <div id="heroName" class="hero-name"></div>
      <div id="heroRole" class="role"></div>
      <div class="health"><div id="healthFill"></div></div>
      <div class="hp"><span id="hp"></span> / <span id="maxHp"></span></div>
      <div class="stats">K <span id="kills">0</span> · D <span id="deaths">0</span></div>
    </div>
    <div id="heroResource" class="hero-resource hidden"><div class="hero-resource-label"><span id="heroResourceLabel"></span><span id="heroResourceValue">0%</span></div><div class="hero-resource-track"><div id="heroResourceFill"></div></div></div>
    <div class="abilities">
      <div class="ability"><div class="key">LMB</div><div id="primaryLabel" class="label"></div></div>
      <div class="ability"><div class="key">RMB</div><div id="secondaryLabel" class="label"></div><div id="secondaryCd" class="charge">READY</div></div>
      <div class="ability"><div class="key">⇧</div><div id="abilityLabel" class="label"></div><div id="abilityCd" class="charge">READY</div></div>
      <div class="ability teamup-ability"><div class="key">F</div><div id="teamUpLabel" class="label">NO TEAM-UP</div><div id="teamUpCd" class="charge">—</div></div>
      <div class="ability"><div class="key">Q</div><div id="ultLabel" class="label"></div><div id="ultCharge" class="charge">0%</div></div>
    </div>
    <div id="scoreboard" class="scoreboard hidden">
      <div class="scoreboard-card">
        <div class="scoreboard-title">MATCH SCOREBOARD</div>
        <div class="scoreboard-columns">
          <div><h3>ALLIANCE</h3><div id="scoreboardBlue"></div></div>
          <div><h3>LEGION</h3><div id="scoreboardRed"></div></div>
        </div>
      </div>
    </div>
    <div id="banner" class="banner"></div>
    <div id="killfeed" class="killfeed"></div>
  </div>
`;

document.querySelector('#mouseSensitivity').addEventListener('input', e => {
  settings.mouseSensitivity = Number(e.target.value);
  persistSettings();
});
document.querySelector('#fovSetting').addEventListener('input', e => {
  settings.fov = Number(e.target.value);
  persistSettings();
});
document.querySelector('#masterVolume').addEventListener('input', e => {
  settings.masterVolume = Number(e.target.value);
  persistSettings();
});
document.querySelector('#reducedCameraShake').addEventListener('change', e => {
  settings.reducedCameraShake = e.target.checked;
  persistSettings();
});
document.querySelector('#showHealthBars').addEventListener('change', e => {
  settings.showHealthBars = e.target.checked;
  persistSettings();
});
document.querySelector('#keybindGrid').addEventListener('click', e => {
  const button = e.target.closest('[data-bind]');
  if (!button) return;
  pendingBind = button.dataset.bind;
  button.textContent = 'PRESS KEY';
  button.classList.add('listening');
});
document.querySelector('#resetSettingsBtn').onclick = () => {
  settings = resetSettings();
  pendingBind = null;
  persistSettings();
};
renderSettings();

document.querySelectorAll('.mode-option').forEach(button => {
  button.onclick = () => {
    selectedMode = ['domination', 'tdm', 'convoy', 'convergence'].includes(button.dataset.mode) ? button.dataset.mode : 'domination';
    document.querySelectorAll('.mode-option').forEach(x => x.classList.toggle('selected', x === button));
  };
});

document.querySelector('#botDifficulty').onchange = e => {
  selectedBotDifficulty = ['easy', 'normal', 'hard', 'expert'].includes(e.target.value) ? e.target.value : 'normal';
};

document.querySelectorAll('.arena-option').forEach(button => {
  button.onclick = () => {
    selectedArena = ['nexus', 'gotham', 'themyscira'].includes(button.dataset.arena) ? button.dataset.arena : 'nexus';
    document.querySelectorAll('.arena-option').forEach(x => x.classList.toggle('selected', x === button));
    applyArenaPreset(selectedArena);
  };
});

const SETTINGS_BINDINGS = [
  ['forward', 'Move Forward'],
  ['backward', 'Move Backward'],
  ['left', 'Move Left'],
  ['right', 'Move Right'],
  ['jump', 'Jump'],
  ['ability', 'Ability'],
  ['ultimate', 'Ultimate']
];

function renderSettings() {
  const sens = document.querySelector('#mouseSensitivity');
  const fov = document.querySelector('#fovSetting');
  const volume = document.querySelector('#masterVolume');
  const reduced = document.querySelector('#reducedCameraShake');
  const bars = document.querySelector('#showHealthBars');
  if (!sens || !fov || !volume || !reduced || !bars) return;

  sens.value = String(settings.mouseSensitivity);
  fov.value = String(settings.fov);
  volume.value = String(settings.masterVolume);
  reduced.checked = settings.reducedCameraShake;
  bars.checked = settings.showHealthBars;
  document.querySelector('#mouseSensitivityValue').textContent = settings.mouseSensitivity.toFixed(4);
  document.querySelector('#fovValue').textContent = String(settings.fov);
  document.querySelector('#masterVolumeValue').textContent = `${Math.round(settings.masterVolume * 100)}%`;

  const grid = document.querySelector('#keybindGrid');
  grid.innerHTML = '';
  for (const [action, label] of SETTINGS_BINDINGS) {
    const row = document.createElement('div');
    row.className = 'keybind-row';
    row.innerHTML = `<span>${label}</span><button class="bind-btn" data-bind="${action}">${keyLabel(settings.keybinds[action])}</button>`;
    grid.appendChild(row);
  }
}

function persistSettings() {
  saveSettings(settings);
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  renderSettings();
}

const rosterEl = document.querySelector('#roster');
for (const hero of HEROES) {
  const b = document.createElement('button');
  b.className = 'hero-option' + (hero.id === selectedHero.id ? ' selected' : '');
  b.dataset.hero = hero.id;
  b.innerHTML = `<span class="universe">${hero.universe}</span><strong>${hero.name}</strong><small>${hero.role} · ${hero.primary}</small>`;
  b.onclick = () => {
    selectedHero = getHero(hero.id);
    network.setHero(selectedHero.id);
    [...rosterEl.children].forEach(x => x.classList.toggle('selected', x.dataset.hero === hero.id));
  };
  rosterEl.appendChild(b);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bc4e8);
scene.fog = new THREE.Fog(0x9bc4e8, 45, 115);
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.1, 500);
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

const collisionBoxes = [];
const arenaStructures = [];
function makeBox(x, z, w, h, d, color = 0x60748e) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.24 })
  );
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  arenaStructures.push(mesh);
  const bounds = new THREE.Box3().setFromObject(mesh);
  collisionBoxes.push(bounds);
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
  sign.position.set(0, 2, 4.05);
  tower.add(sign);
}

function applyArenaPreset(id) {
  const arena = getArena(id);
  selectedArena = arena.id;
  scene.background.setHex(arena.background);
  scene.fog.color.setHex(arena.background);
  ground.material.color.setHex(arena.ground);

  collisionBoxes.length = 0;
  arenaStructures.forEach((mesh, index) => {
    const preset = arena.structures[index];
    if (!preset) return;
    const [x, z, sx, sz, color] = preset;
    mesh.position.x = x;
    mesh.position.z = z;
    mesh.scale.x = sx;
    mesh.scale.z = sz;
    mesh.material.color.setHex(color);
    mesh.updateMatrixWorld(true);
    collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
  });
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

const payload = new THREE.Group();
const payloadBody = new THREE.Mesh(
  new THREE.BoxGeometry(3.2, 1.35, 4.2),
  new THREE.MeshStandardMaterial({ color: 0x4d86c6, emissive: 0x183f70, emissiveIntensity: 1.1, metalness: 0.55, roughness: 0.32 })
);
payloadBody.position.y = 1.05;
payloadBody.castShadow = true;
const payloadCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.52, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0x8dd9ff })
);
payloadCore.position.set(0, 1.35, 0);
payload.add(payloadBody, payloadCore);
payload.visible = false;
scene.add(payload);

function updatePayloadTransform() {
  const redEscort = selectedMode === 'convergence' && convergenceEscortTeam === 'red';
  const startZ = redEscort ? -20 : 20;
  const direction = redEscort ? 1 : -1;
  payload.position.set(0, 0, startZ + direction * convoyProgress * 0.4);
}
updatePayloadTransform();

const MAX_PROJECTILES = 96;
const MAX_EFFECTS = 64;
const projectileGeometry = new THREE.SphereGeometry(0.16, 8, 8);
const effectGeometry = new THREE.RingGeometry(0.5, 0.7, 40);
const projectilePool = [];
const effectPool = [];
const effects = [];
const projectiles = [];

function acquireProjectileMesh(color) {
  const mesh = projectilePool.pop() || new THREE.Mesh(
    projectileGeometry,
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.material.color.setHex(color);
  mesh.visible = true;
  return mesh;
}

function releaseProjectile(projectile) {
  scene.remove(projectile.mesh);
  projectile.mesh.visible = false;
  if (projectilePool.length < MAX_PROJECTILES) projectilePool.push(projectile.mesh);
}

function acquireEffectMesh(color) {
  const mesh = effectPool.pop() || new THREE.Mesh(
    effectGeometry,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  mesh.material.color.setHex(color);
  mesh.material.opacity = 0.9;
  mesh.visible = true;
  mesh.scale.setScalar(1);
  return mesh;
}

function releaseEffect(effect) {
  scene.remove(effect.mesh);
  effect.mesh.visible = false;
  if (effectPool.length < MAX_EFFECTS) effectPool.push(effect.mesh);
}

function overlapsWorld(pos, radius = 0.66) {
  if (Math.abs(pos.x) > 57 || Math.abs(pos.z) > 57) return true;
  for (const box of collisionBoxes) {
    const x = THREE.MathUtils.clamp(pos.x, box.min.x, box.max.x);
    const z = THREE.MathUtils.clamp(pos.z, box.min.z, box.max.z);
    const dx = pos.x - x;
    const dz = pos.z - z;
    if (dx * dx + dz * dz < radius * radius && pos.y < box.max.y + 0.2) return true;
  }
  return false;
}

function moveWithCollision(fighter, delta) {
  if (!delta.lengthSq()) return;
  const nextX = fighter.position.clone();
  nextX.x += delta.x;
  if (!overlapsWorld(nextX)) fighter.position.x = nextX.x;
  const nextZ = fighter.position.clone();
  nextZ.z += delta.z;
  if (!overlapsWorld(nextZ)) fighter.position.z = nextZ.z;
}

function showHitFeedback(amount) {
  const cross = document.querySelector('.crosshair');
  cross?.classList.add('hit');
  clearTimeout(showHitFeedback.t);
  showHitFeedback.t = setTimeout(() => cross?.classList.remove('hit'), 85);
  const pop = document.querySelector('#damagePop');
  if (pop) {
    pop.textContent = Math.round(amount);
    pop.classList.remove('show');
    void pop.offsetWidth;
    pop.classList.add('show');
  }
}

function spawnProjectile(actor, direction, damageAmount, speed) {
  if (projectiles.length >= MAX_PROJECTILES) releaseProjectile(projectiles.shift());
  const mesh = acquireProjectileMesh(actor.userData.hero.color);
  mesh.position.copy(actor.position).add(new THREE.Vector3(0, 1.35, 0)).add(direction.clone().multiplyScalar(0.9));
  scene.add(mesh);
  projectiles.push({
    mesh, actor, velocity: direction.clone().normalize().multiplyScalar(speed || 28),
    damage: damageAmount, life: 2.2
  });
}
function pulseEffect(position, color, radius = 3, duration = 0.45) {
  if (effects.length >= MAX_EFFECTS) releaseEffect(effects.shift());
  const mesh = acquireEffectMesh(color);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(position).add(new THREE.Vector3(0, 0.08, 0));
  scene.add(mesh);
  effects.push({ mesh, age: 0, duration, radius });
}

function makeFighter(hero, team, isPlayer = false, isRemote = false, networkId = null) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: hero.color, roughness: 0.35, metalness: 0.38 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, 1.05, 5, 10), mat);
  const roleScale = hero.role === 'Vanguard' ? 1.16 : hero.role === 'Duelist' ? 0.92 : 1;
  body.scale.set(roleScale, hero.role === 'Vanguard' ? 1.08 : 1, roleScale);
  body.position.y = 1.18;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(hero.role === 'Vanguard' ? 0.42 : 0.36, 12, 10),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(hero.color).offsetHSL(0, 0, 0.12),
      roughness: 0.42,
      metalness: 0.18
    })
  );
  head.position.y = hero.role === 'Vanguard' ? 2.18 : 2.08;
  head.castShadow = true;
  g.add(head);

  const shoulderWidth = hero.role === 'Vanguard' ? 1.75 : hero.role === 'Duelist' ? 1.28 : 1.48;
  const shoulders = new THREE.Mesh(
    new THREE.BoxGeometry(shoulderWidth, 0.22, 0.42),
    new THREE.MeshStandardMaterial({ color: hero.color, roughness: 0.4, metalness: 0.32 })
  );
  shoulders.position.y = 1.72;
  shoulders.castShadow = true;
  g.add(shoulders);

  const accent = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.055, 8, 18),
    new THREE.MeshBasicMaterial({ color: team === 'blue' ? 0xa7ddff : 0xffa3af })
  );
  accent.position.set(0, 1.45, -0.52 * roleScale);
  accent.rotation.x = Math.PI / 2;
  g.add(accent);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshBasicMaterial({ color: team === 'blue' ? 0x70c8ff : 0xff667c })
  );
  marker.position.set(0, 2.15, 0);
  g.add(marker);

  const healthGroup = new THREE.Group();
  healthGroup.position.set(0, 2.45, 0);
  const healthBg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 0.16),
    new THREE.MeshBasicMaterial({ color: 0x111827, transparent: true, opacity: 0.88, depthTest: false })
  );
  const healthFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1.38, 0.1),
    new THREE.MeshBasicMaterial({ color: team === 'blue' ? 0x67c7ff : 0xff6b7d, depthTest: false })
  );
  healthFill.position.z = 0.002;
  healthGroup.add(healthBg, healthFill);
  healthGroup.renderOrder = 9;
  g.add(healthGroup);

  g.userData = {
    hero, team, body, hp: hero.hp, maxHp: hero.hp, alive: true, isPlayer, isRemote, networkId,
    respawnAt: 0, lastAttack: 0, target: null, abilityReadyAt: 0, kills: 0, deaths: 0,
    ultReadyAt: 18000 + Math.random() * 9000, shieldUntil: 0,
    stunnedUntil: 0, empoweredUntil: 0, rootedUntil: 0, slowedUntil: 0, hasteUntil: 0,
    flankSign: Math.random() < 0.5 ? -1 : 1, healthGroup, healthFill,
    head, shoulders, accent, baseBodyY: body.position.y, baseHeadY: head.position.y,
    baseShoulderY: shoulders.position.y, visualPhase: Math.random() * Math.PI * 2,
    lastVisualPosition: g.position.clone()
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
  f.userData.rootedUntil = 0;
  f.userData.slowedUntil = 0;
  f.userData.hasteUntil = 0;
  f.userData.lastNetworkAttackerId = null;
  f.userData.lastNetworkSourceTeam = null;
  f.userData.lastNetworkSourceName = null;
  f.userData.lastVisualPosition.copy(f.position);
}

function addKillFeed(text) {
  const feed = document.querySelector('#killfeed');
  const item = document.createElement('div');
  item.textContent = text;
  feed.prepend(item);
  while (feed.children.length > 5) feed.lastElementChild.remove();
  setTimeout(() => item.remove(), 5000);
}

function isNonHostBotReplica(target) {
  return joinedLobby &&
    network.connected &&
    network.playerId !== lobbyHostId &&
    target &&
    !target.userData.isPlayer &&
    !target.userData.isRemote &&
    Number.isInteger(target.userData.syncSlot);
}

function canRouteRemoteEffect(actor, target) {
  if (!joinedLobby || !network.connected || !target?.userData.isRemote || !actor) return false;
  return actor === player || network.playerId === lobbyHostId;
}

function applyEffect(target, effect, { duration = 0, amount = 0, actor = null, networkApplied = false, sourcePosition = null } = {}) {
  if (!target?.userData.alive) return;

  if (!networkApplied && actor === player && isNonHostBotReplica(target)) {
    network.sendCombatEvent({
      kind: 'bot-effect',
      team: target.userData.team,
      slot: target.userData.syncSlot,
      effect,
      duration,
      amount,
      sourcePosition: sourcePosition || { x: player.position.x, y: player.position.y, z: player.position.z }
    });
    return;
  }

  if (!networkApplied && canRouteRemoteEffect(actor, target)) {
    network.sendCombatEvent({
      kind: 'ability-effect',
      targetId: target.userData.networkId,
      effect,
      duration,
      amount,
      sourceId: actor?.userData.networkId || null,
      sourceName: actor?.userData.hero?.name || 'Ability',
      sourceTeam: actor?.userData.team,
      sourcePosition: sourcePosition || (actor ? { x: actor.position.x, y: actor.position.y, z: actor.position.z } : null)
    });
    return;
  }

  const now = performance.now();
  if (effect === 'heal') {
    target.userData.hp = Math.min(target.userData.maxHp, target.userData.hp + amount);
    pulseEffect(target.position, 0x72ffbf, 2.5, 0.35);
  }
  if (effect === 'shield') {
    target.userData.shieldUntil = Math.max(target.userData.shieldUntil, now + duration);
    pulseEffect(target.position, 0x8bd7ff, 2.7, 0.3);
  }
  if (effect === 'slow') target.userData.slowedUntil = Math.max(target.userData.slowedUntil, now + duration);
  if (effect === 'root') target.userData.rootedUntil = Math.max(target.userData.rootedUntil, now + duration);
  if (effect === 'stun') target.userData.stunnedUntil = Math.max(target.userData.stunnedUntil, now + duration);
  if (effect === 'haste') target.userData.hasteUntil = Math.max(target.userData.hasteUntil, now + duration);
  if (effect === 'knockback') {
    const origin = sourcePosition
      ? new THREE.Vector3(sourcePosition.x || 0, 0, sourcePosition.z || 0)
      : actor?.position?.clone().setY(0);
    if (origin) {
      const push = target.position.clone().setY(0).sub(origin);
      if (push.lengthSq()) moveWithCollision(target, push.normalize().multiplyScalar(amount || 3.5));
    }
  }
}

function heal(target, amount, actor = null, networkApplied = false) {
  applyEffect(target, 'heal', { amount, actor, networkApplied });
}

function damage(target, amount, attacker, networkApplied = false) {
  if (!target?.userData.alive || matchOver) return;

  if (!networkApplied && attacker === player && isNonHostBotReplica(target)) {
    network.sendCombatEvent({
      kind: 'bot-damage',
      team: target.userData.team,
      slot: target.userData.syncSlot,
      amount,
      source: selectedHero.primary,
      sourceName: selectedHero.name
    });
    showHitFeedback(amount);
    return;
  }

  if (joinedLobby && network.connected && target.userData.isRemote && !networkApplied &&
      (attacker === player || (network.playerId === lobbyHostId && attacker && !attacker.userData.isRemote))) {
    network.sendCombatEvent({
      kind: 'damage',
      targetId: target.userData.networkId,
      amount,
      source: attacker?.userData.hero?.primary || selectedHero.primary,
      sourceId: attacker?.userData.networkId || null,
      sourceName: attacker?.userData.hero?.name || selectedHero.name,
      sourceTeam: attacker?.userData.team
    });
    if (attacker === player) showHitFeedback(amount);
    return;
  }

  const now = performance.now();
  let dealt = amount;
  if (target.userData.shieldUntil > now) dealt *= 0.42;
  if (attacker?.userData.empoweredUntil > now) dealt *= 1.55;
  target.userData.hp -= dealt;
  if (attacker === player) showHitFeedback(dealt);
  if (target === player) {
    cameraShake = Math.min(1.4, cameraShake + dealt / 180);
    if (!joinedLobby && selectedHero.resourceKind === 'arcaneCharge') gainHeroResource(dealt * 0.22);
  }
  target.userData.body.material.emissive = new THREE.Color(0xffffff);
  setTimeout(() => target.userData?.body?.material?.emissive?.set(0x000000), 65);

  if (target.userData.hp <= 0) {
    target.userData.hp = 0;
    target.userData.alive = false;
    target.visible = false;
    target.userData.respawnAt = now + RESPAWN_SECONDS * 1000;
    const killerName = attacker?.userData.hero.name || target.userData.lastNetworkSourceName || 'Nexus';
    addKillFeed(`${killerName} eliminated ${target.userData.hero.name}`);

    if (selectedMode === 'tdm' && attacker?.userData.team) {
      const hostOwnsDeath = network.playerId === lobbyHostId &&
        ((!target.userData.isPlayer && !target.userData.isRemote) || (target === player && !networkApplied));
      if (!joinedLobby || hostOwnsDeath) {
        addTeamScore(attacker.userData.team, 1);
      }
    }

    if (attacker) attacker.userData.kills = Number(attacker.userData.kills || 0) + 1;
    target.userData.deaths = Number(target.userData.deaths || 0) + 1;

    if (attacker === player) {
      playerKills = attacker.userData.kills;
      ultimateCharge = Math.min(100, ultimateCharge + 24);
    }
    if (target === player) {
      playerDeaths = target.userData.deaths;
      respawnAt = target.userData.respawnAt;
    }
  }
}

function opposingTeam(team) {
  return team === 'blue' ? 'red' : 'blue';
}

function modeScoreLimit() {
  return selectedMode === 'tdm' ? TDM_SCORE_TO_WIN : DOMINATION_SCORE_TO_WIN;
}

function addTeamScore(team, amount = 1) {
  if (team === 'blue') blueScore = Math.min(modeScoreLimit(), blueScore + amount);
  if (team === 'red') redScore = Math.min(modeScoreLimit(), redScore + amount);
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

function startMatch(players = networkPlayers) {
  if (matchStarted) return;
  matchStarted = true;
  matchOver = false;
  blueScore = 0;
  redScore = 0;
  convoyProgress = 0;
  convoyTimeRemaining = selectedMode === 'convergence' ? CONVERGENCE_ESCORT_SECONDS : CONVOY_SECONDS;
  convoyEndsAt = performance.now() + convoyTimeRemaining * 1000;
  convergencePhase = 'capture';
  convergenceBlueCapture = 0;
  convergenceRedCapture = 0;
  convergenceEscortTeam = 'blue';
  updatePayloadTransform();
  playerKills = 0;
  playerDeaths = 0;
  ultimateCharge = 0;
  heroResource = 0;
  lastResourcePosition.set(0, 0, 0);
  flightUntil = 0;
  temporalHistory = [];
  lastTemporalSampleAt = 0;
  document.querySelector('#heroSelect').classList.add('hidden');
  document.querySelector('#hud').classList.remove('hidden');

  const localTeam = joinedLobby && network.team ? network.team : 'blue';
  player = makeFighter(selectedHero, localTeam, true, false, network.playerId);
  fighters.push(player);

  if (joinedLobby && Array.isArray(players)) {
    for (const p of players) {
      if (p.id === network.playerId) continue;
      const remote = makeFighter(getHero(p.heroId), p.team, false, true, p.id);
      fighters.push(remote);
      remoteFighters.set(p.id, remote);
    }
  }

  for (const team of ['blue', 'red']) {
    const existing = fighters.filter(f => f.userData.team === team).length;
    const pool = HEROES.filter(h => h.id !== selectedHero.id);
    for (let i = existing; i < TEAM_SIZE; i++) {
      fighters.push(makeFighter(pool[(i + (team === 'red' ? 5 : 0)) % pool.length], team));
    }
  }

  for (const team of ['blue', 'red']) {
    let botSlot = 0;
    fighters.filter(f => f.userData.team === team).forEach((f, i) => {
      resetFighter(f, i);
      if (!f.userData.isPlayer && !f.userData.isRemote) f.userData.syncSlot = botSlot++;
    });
  }
  objective.visible = selectedMode === 'domination' || selectedMode === 'convergence';
  objectiveRing.visible = selectedMode === 'domination' || selectedMode === 'convergence';
  payload.visible = selectedMode === 'convoy';
  refreshTeamUp();
  applyHudHero();
  renderer.domElement.requestPointerLock();
}

function applyHudHero() {
  const h = selectedHero;
  document.querySelector('#heroName').textContent = h.name;
  document.querySelector('#heroRole').textContent = `${h.universe} · ${h.role}`;
  document.querySelector('#maxHp').textContent = h.hp;
  document.querySelector('#primaryLabel').textContent = h.primary;
  document.querySelector('#secondaryLabel').textContent = h.secondary || 'Secondary';
  document.querySelector('#abilityLabel').textContent = h.ability;
  document.querySelector('#ultLabel').textContent = h.ultimate;
  const resource = document.querySelector('#heroResource');
  resource.classList.toggle('hidden', !h.resourceKind);
  document.querySelector('#heroResourceLabel').textContent = h.resourceLabel || '';
}

const networkStatus = document.querySelector('#networkStatus');
const deployBtn = document.querySelector('#deployBtn');

function setNetworkStatus(text, error = false) {
  networkStatus.textContent = text;
  networkStatus.classList.toggle('error', error);
}

network.on('connection', ({ connected }) => {
  setNetworkStatus(connected ? 'Connected to private-lobby server' : 'Disconnected — offline play remains available', !connected);
});

network.on('joined', msg => {
  joinedLobby = true;
  networkPlayers = msg.players || [];
  lobbyHostId = msg.hostId;
  document.querySelector('#lobbyCode').value = msg.lobbyCode;
  const host = msg.playerId === msg.hostId;
  setNetworkStatus(`Lobby ${msg.lobbyCode} · ${msg.players.length}/12 · ${host ? 'HOST' : msg.team.toUpperCase()}`);
  deployBtn.textContent = host ? 'START PRIVATE MATCH' : 'WAITING FOR HOST';
});

network.on('player-joined', msg => {
  networkPlayers = msg.players || networkPlayers;
  setNetworkStatus(`Lobby ${network.lobbyCode} · ${msg.players.length}/12 players`);
});

network.on('player-left', msg => {
  networkPlayers = msg.players || networkPlayers.filter(p => p.id !== msg.id);
  const remote = remoteFighters.get(msg.id);
  if (remote) {
    remote.visible = false;
    scene.remove(remote);
    const idx = fighters.indexOf(remote);
    if (idx >= 0) fighters.splice(idx, 1);
    remoteFighters.delete(msg.id);
  }
  setNetworkStatus(`Lobby ${network.lobbyCode} · ${msg.players.length}/12 players`);
});

network.on('player-updated', msg => {
  networkPlayers = msg.players || networkPlayers;
});

network.on('state', msg => {
  const remote = remoteFighters.get(msg.id);
  if (!remote || !msg.position) return;
  remote.position.lerp(new THREE.Vector3(msg.position.x, msg.position.y, msg.position.z), 0.62);
  remote.rotation.y = Number(msg.rotationY || 0);
  if (Number.isFinite(Number(msg.hp))) remote.userData.hp = THREE.MathUtils.clamp(Number(msg.hp), 0, remote.userData.maxHp);
  if (typeof msg.alive === 'boolean') {
    remote.userData.alive = msg.alive;
    remote.visible = remote.userData.alive;
  }
});

network.on('match-state', msg => {
  if (!matchStarted || network.playerId === lobbyHostId || !msg.state) return;
  const state = msg.state;
  blueScore = Number(state.blueScore || 0);
  redScore = Number(state.redScore || 0);
  convoyProgress = THREE.MathUtils.clamp(Number(state.convoyProgress || 0), 0, 100);
  convoyTimeRemaining = Math.max(0, Number(state.convoyTimeRemaining || CONVOY_SECONDS));
  convergencePhase = state.convergencePhase === 'escort' ? 'escort' : 'capture';
  convergenceBlueCapture = THREE.MathUtils.clamp(Number(state.convergenceBlueCapture || 0), 0, CONVERGENCE_CAPTURE_TO_WIN);
  convergenceRedCapture = THREE.MathUtils.clamp(Number(state.convergenceRedCapture || 0), 0, CONVERGENCE_CAPTURE_TO_WIN);
  convergenceEscortTeam = state.convergenceEscortTeam === 'red' ? 'red' : 'blue';
  updatePayloadTransform();
  if (selectedMode === 'convergence') {
    objective.visible = convergencePhase === 'capture';
    objectiveRing.visible = convergencePhase === 'capture';
    payload.visible = convergencePhase === 'escort';
  }
  objectiveState = state.objectiveState || 'CAPTURE THE NEXUS';
  matchOver = Boolean(state.matchOver);

  for (const snap of state.bots || []) {
    const bot = fighters.find(f =>
      !f.userData.isPlayer &&
      !f.userData.isRemote &&
      f.userData.team === snap.team &&
      f.userData.syncSlot === snap.slot
    );
    if (!bot || !snap.position) continue;
    bot.position.lerp(new THREE.Vector3(snap.position.x, snap.position.y, snap.position.z), 0.72);
    bot.rotation.y = Number(snap.rotationY || 0);
    bot.userData.hp = THREE.MathUtils.clamp(Number(snap.hp || 0), 0, bot.userData.maxHp);
    bot.userData.alive = Boolean(snap.alive);
    bot.userData.kills = Number(snap.kills || 0);
    bot.userData.deaths = Number(snap.deaths || 0);
    bot.visible = bot.userData.alive;
  }

  if (selectedMode === 'convoy') {
    document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.floor(convoyProgress)}%`;
    document.querySelector('#redScore').textContent = `LEGION ${Math.ceil(convoyTimeRemaining)}s`;
  } else if (selectedMode === 'convergence') {
    if (convergencePhase === 'capture') {
      document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.floor(convergenceBlueCapture)}`;
      document.querySelector('#redScore').textContent = `LEGION ${Math.floor(convergenceRedCapture)}`;
    } else {
      document.querySelector('#blueScore').textContent = convergenceEscortTeam === 'blue'
        ? `ALLIANCE ${Math.floor(convoyProgress)}%`
        : `ALLIANCE ${Math.ceil(convoyTimeRemaining)}s`;
      document.querySelector('#redScore').textContent = convergenceEscortTeam === 'red'
        ? `LEGION ${Math.floor(convoyProgress)}%`
        : `LEGION ${Math.ceil(convoyTimeRemaining)}s`;
    }
  } else {
    document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.floor(blueScore)}`;
    document.querySelector('#redScore').textContent = `LEGION ${Math.floor(redScore)}`;
  }
  document.querySelector('#objectiveState').textContent = objectiveState;

  if (matchOver) showBanner(blueScore >= redScore ? 'ALLIANCE VICTORY' : 'LEGION VICTORY', 5000);
});

network.on('player-stats', msg => {
  for (const stat of msg.stats || []) {
    const fighter = stat.id === network.playerId ? player : remoteFighters.get(stat.id);
    if (!fighter) continue;
    fighter.userData.kills = Number(stat.kills || 0);
    fighter.userData.deaths = Number(stat.deaths || 0);
    if (fighter === player) {
      playerKills = fighter.userData.kills;
      playerDeaths = fighter.userData.deaths;
    }
  }
});

network.on('player-authority', msg => {
  const target = msg.id === network.playerId ? player : remoteFighters.get(msg.id);
  if (!target) return;
  const wasAlive = target.userData.alive;

  const previousHp = target.userData.hp;
  if (Number.isFinite(Number(msg.maxHp)) && Number(msg.maxHp) > 0) target.userData.maxHp = Number(msg.maxHp);
  if (Number.isFinite(Number(msg.hp))) target.userData.hp = THREE.MathUtils.clamp(Number(msg.hp), 0, target.userData.maxHp);
  if (target === player && selectedHero.resourceKind === 'arcaneCharge' && target.userData.hp < previousHp) {
    gainHeroResource((previousHp - target.userData.hp) * 0.22);
  }
  target.userData.alive = Boolean(msg.alive);
  target.visible = target.userData.alive;

  if (wasAlive && !target.userData.alive && target === player) {
    playerDeaths++;
    respawnAt = performance.now() + Math.max(0, Number(msg.respawnAt || Date.now()) - Date.now());
  }

  if (!wasAlive && target.userData.alive) {
    const sameTeam = fighters.filter(f => f.userData.team === target.userData.team);
    resetFighter(target, sameTeam.indexOf(target));
    if (target === player) {
      respawnAt = 0;
      showBanner('RESPAWNED');
    }
  }
});

network.on('combat-event', msg => {
  if (!matchStarted || !msg.event) return;

  if (msg.event.kind === 'damage') {
    const attacker = remoteFighters.get(msg.id) || null;
    player.userData.lastNetworkAttackerId = msg.id || null;
    player.userData.lastNetworkSourceTeam = msg.event.sourceTeam || attacker?.userData.team || null;
    player.userData.lastNetworkSourceName = msg.event.sourceName || attacker?.userData.hero?.name || 'Opponent';
    cameraShake = Math.max(cameraShake, 0.42);
    return;
  }

  if (msg.event.kind === 'ability-effect') {
    const attacker = remoteFighters.get(msg.id) || null;
    applyEffect(player, msg.event.effect, {
      duration: Number(msg.event.duration || 0),
      amount: Number(msg.event.amount || 0),
      actor: attacker,
      networkApplied: true,
      sourcePosition: msg.event.sourcePosition || null
    });
    return;
  }

  if (msg.event.kind === 'bot-damage' && network.playerId === lobbyHostId) {
    const bot = fighters.find(f =>
      !f.userData.isPlayer &&
      !f.userData.isRemote &&
      f.userData.team === msg.event.team &&
      f.userData.syncSlot === Number(msg.event.slot)
    );
    if (bot) {
      const attacker = remoteFighters.get(msg.id) || null;
      damage(bot, Number(msg.event.amount || 0), attacker, true);
    }
    return;
  }

  if (msg.event.kind === 'bot-effect' && network.playerId === lobbyHostId) {
    const bot = fighters.find(f =>
      !f.userData.isPlayer &&
      !f.userData.isRemote &&
      f.userData.team === msg.event.team &&
      f.userData.syncSlot === Number(msg.event.slot)
    );
    if (bot) {
      const attacker = remoteFighters.get(msg.id) || null;
      applyEffect(bot, msg.event.effect, {
        duration: Number(msg.event.duration || 0),
        amount: Number(msg.event.amount || 0),
        actor: attacker,
        networkApplied: true,
        sourcePosition: msg.event.sourcePosition || null
      });
    }
    return;
  }

  if (msg.event.kind === 'team-kill') {
    if (selectedMode === 'tdm' && network.playerId === lobbyHostId) {
      addTeamScore(msg.event.team, 1);
    }
    if (msg.event.killerId === network.playerId) {
      playerKills++;
      ultimateCharge = Math.min(100, ultimateCharge + 24);
      const victim = remoteFighters.get(msg.event.victimId);
      addKillFeed(`${selectedHero.name} eliminated ${victim?.userData.hero.name || 'opponent'}`);
    }
    return;
  }
});

network.on('host-changed', msg => {
  lobbyHostId = msg.hostId;
  const host = network.playerId === lobbyHostId;
  deployBtn.textContent = host ? 'START PRIVATE MATCH' : 'WAITING FOR HOST';
});

network.on('match-start', msg => {
  networkPlayers = msg.players || networkPlayers;
  selectedMode = ['domination', 'tdm', 'convoy', 'convergence'].includes(msg.mode) ? msg.mode : 'domination';
  selectedBotDifficulty = ['easy', 'normal', 'hard', 'expert'].includes(msg.difficulty) ? msg.difficulty : 'normal';
  selectedArena = ['nexus', 'gotham', 'themyscira'].includes(msg.arena) ? msg.arena : 'nexus';
  applyArenaPreset(selectedArena);
  if (!matchStarted) startMatch(networkPlayers);
});

network.on('error', msg => {
  setNetworkStatus(msg.code === 'LOBBY_NOT_FOUND' ? 'Lobby not found' : msg.code || 'Network error', true);
});

document.querySelector('#createLobbyBtn').onclick = async () => {
  setNetworkStatus('Connecting...');
  try {
    await network.createLobby({
      name: document.querySelector('#playerName').value || 'Player',
      heroId: selectedHero.id
    });
  } catch {
    setNetworkStatus('Could not reach lobby server — offline mode still works', true);
  }
};

document.querySelector('#joinLobbyBtn').onclick = async () => {
  const lobbyCode = document.querySelector('#lobbyCode').value.trim().toUpperCase();
  if (!lobbyCode) return setNetworkStatus('Enter a lobby code', true);
  setNetworkStatus('Joining...');
  try {
    await network.joinLobby({
      lobbyCode,
      name: document.querySelector('#playerName').value || 'Player',
      heroId: selectedHero.id
    });
  } catch {
    setNetworkStatus('Could not reach lobby server — offline mode still works', true);
  }
};

deployBtn.onclick = () => {
  if (!joinedLobby) return startMatch();
  if (network.playerId === lobbyHostId) network.startMatch(selectedMode, selectedBotDifficulty, selectedArena);
  else setNetworkStatus('Waiting for the host to start the match');
};

addEventListener('keydown', e => {
  if (pendingBind) {
    e.preventDefault();
    settings.keybinds[pendingBind] = e.code;
    pendingBind = null;
    persistSettings();
    return;
  }

  keys[e.code] = true;
  if (e.code === 'Tab') {
    e.preventDefault();
    document.querySelector('#scoreboard')?.classList.remove('hidden');
    renderScoreboard();
  }
  if (e.code === settings.keybinds.ability) usePlayerAbility();
  if (e.code === 'KeyF') useTeamUp();
  if (e.code === settings.keybinds.ultimate) useUltimate();
});
addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'Tab') document.querySelector('#scoreboard')?.classList.add('hidden');
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement === renderer.domElement && matchStarted) {
    yaw -= e.movementX * settings.mouseSensitivity;
    pitch = Math.max(-0.75, Math.min(0.35, pitch - e.movementY * settings.mouseSensitivity * 0.82));
  }
});
renderer.domElement.addEventListener('click', () => matchStarted && renderer.domElement.requestPointerLock());
addEventListener('mousedown', e => {
  if (!matchStarted) return;
  if (e.button === 0) playerShoot();
  if (e.button === 2) useSecondary();
});
addEventListener('contextmenu', e => matchStarted && e.preventDefault());

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq = 220, duration = 0.055, gain = 0.025, type = 'sine') {
  try {
    const ctx = ensureAudio();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(Math.max(0.0001, gain * settings.masterVolume), ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playerForward() {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function playerDamageAmount(base) {
  if (selectedHero.resourceKind === 'hatred') return base * (1 + heroResource * 0.0045);
  if (selectedHero.resourceKind === 'momentum') return base * (1 + heroResource * 0.003);
  if (selectedHero.resourceKind === 'speedForce') return base * (heroResource >= 60 ? 1.18 : 1);
  if (selectedHero.resourceKind === 'powerCosmic') return base * (1 + heroResource * 0.0015);
  return base;
}

function gainHeroResource(amount) {
  if (!selectedHero.resourceKind) return;
  heroResource = THREE.MathUtils.clamp(heroResource + amount, 0, 100);
}

function playerShoot() {
  if (!player?.userData.alive || performance.now() < player.userData.stunnedUntil) return;
  const now = performance.now();
  if (now - lastShot < selectedHero.fireRate * 1000) return;
  lastShot = now;
  tone(selectedHero.attackType === 'melee' ? 130 : 280, 0.045, 0.018, selectedHero.attackType === 'melee' ? 'square' : 'sawtooth');

  const attackType = selectedHero.attackType || 'beam';
  const enemies = fighters.filter(f => f.userData.team === opposingTeam(player.userData.team) && f.userData.alive);

  if (attackType === 'melee') {
    const forward = playerForward();
    let best = null;
    let bestScore = Infinity;
    const radius = selectedHero.meleeRadius || selectedHero.range || 6;
    for (const target of enemies) {
      const toTarget = target.position.clone().sub(player.position);
      const dist = toTarget.length();
      if (dist > radius + 1.5) continue;
      toTarget.y = 0;
      if (!toTarget.lengthSq()) continue;
      const facing = forward.dot(toTarget.normalize());
      if (facing < 0.25) continue;
      if (dist < bestScore) { best = target; bestScore = dist; }
    }
    if (best) {
      const dealt = playerDamageAmount(selectedHero.damage);
      damage(best, dealt, player);
      if (selectedHero.resourceKind === 'hatred') gainHeroResource(10);
      if (selectedHero.resourceKind === 'speedForce') gainHeroResource(-8);
      ultimateCharge = Math.min(100, ultimateCharge + 5);
      pulseEffect(best.position, selectedHero.color, 1.8, 0.18);
    }
    return;
  }

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  if (attackType === 'projectile') {
    const dir = raycaster.ray.direction.clone().normalize();
    spawnProjectile(player, dir, playerDamageAmount(selectedHero.damage), selectedHero.projectileSpeed || 28);
    return;
  }

  const targets = enemies.map(f => f.userData.body);
  const hits = raycaster.intersectObjects(targets);
  if (!hits.length) return;
  const target = fighters.find(f => f.userData.body === hits[0].object);
  if (target && player.position.distanceTo(target.position) <= selectedHero.range + 4) {
    damage(target, playerDamageAmount(selectedHero.damage), player);
    if (selectedHero.resourceKind === 'hatred') gainHeroResource(7);
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
    const dash = dir.clone().multiplyScalar(kind === 'blink' ? 8.5 : 6.5);
    moveWithCollision(actor, dash);
    pulseEffect(actor.position, hero.color, 3.2, 0.3);
  }
  if (kind === 'shield') {
    applyEffect(actor, 'shield', { duration: 3200, actor });
    pulseEffect(actor.position, 0x8bd7ff, 4, 0.5);
  }
  if (kind === 'teamShield') {
    allies.filter(a => a.position.distanceTo(actor.position) < 11)
      .forEach(a => applyEffect(a, 'shield', { duration: 3000, actor }));
    pulseEffect(actor.position, 0x70e8ff, 7, 0.6);
  }
  if (kind === 'heal') {
    allies.filter(a => a.position.distanceTo(actor.position) < 12)
      .forEach(a => heal(a, a.userData.maxHp * 0.22, actor));
    pulseEffect(actor.position, 0x6dffb3, 7, 0.6);
  }
  if (kind === 'burst') {
    enemies.filter(e => e.position.distanceTo(actor.position) < 10).forEach(e => damage(e, hero.damage * 1.4, actor));
    pulseEffect(actor.position, 0xd18cff, 8, 0.5);
  }
}

function useSecondary() {
  if (!player?.userData.alive || performance.now() < player.userData.stunnedUntil) return;
  const now = performance.now();
  if (now < secondaryReadyAt) return;
  secondaryReadyAt = now + (selectedHero.secondaryCooldown || 6) * 1000;
  const kind = selectedHero.secondaryKind || 'heavyBeam';
  const enemies = living(opposingTeam(player.userData.team));

  if (kind === 'phase') {
    if (selectedHero.resourceKind === 'speedForce' && heroResource < 25) {
      secondaryReadyAt = now;
      showBanner('BUILD SPEED FORCE', 600);
      return;
    }
    if (selectedHero.resourceKind === 'speedForce') gainHeroResource(-25);
    player.userData.shieldUntil = now + 1400;
    player.userData.hasteUntil = now + 1800;
    pulseEffect(player.position, selectedHero.color, 4.2, 0.4);
  } else if (kind === 'selfHaste') {
    player.userData.hasteUntil = now + 4200;
    player.userData.shieldUntil = Math.max(player.userData.shieldUntil, now + 1800);
    pulseEffect(player.position, selectedHero.color, 5, 0.45);
  } else if (kind === 'slowBurst' || kind === 'rootBurst' || kind === 'knockbackBurst') {
    const radius = kind === 'rootBurst' ? 9 : 8;
    for (const enemy of enemies.filter(e => e.position.distanceTo(player.position) < radius)) {
      damage(enemy, playerDamageAmount(selectedHero.damage * 0.65), player);
      if (kind === 'slowBurst') applyEffect(enemy, 'slow', { duration: 2600, actor: player });
      if (kind === 'rootBurst') applyEffect(enemy, 'root', { duration: 1500, actor: player });
      if (kind === 'knockbackBurst') applyEffect(enemy, 'knockback', { amount: 3.8, actor: player });
    }
    pulseEffect(player.position, selectedHero.color, radius, 0.55);
  } else {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    if (kind === 'heavyProjectile') {
      spawnProjectile(player, raycaster.ray.direction.clone().normalize(), playerDamageAmount(selectedHero.damage * 1.8), (selectedHero.projectileSpeed || 28) * 0.82);
    } else {
      const targets = enemies.map(f => f.userData.body);
      const hits = raycaster.intersectObjects(targets);
      if (hits.length) {
        const target = fighters.find(f => f.userData.body === hits[0].object);
        if (target && player.position.distanceTo(target.position) <= selectedHero.range + 7) {
          damage(target, playerDamageAmount(selectedHero.damage * 1.65), player);
          pulseEffect(target.position, selectedHero.color, 2.2, 0.3);
        }
      }
    }
  }
  tone(160, 0.12, 0.03, 'triangle');
  showBanner((selectedHero.secondary || 'SECONDARY').toUpperCase(), 500);
}

function refreshTeamUp() {
  if (!player) {
    activeTeamUp = null;
    return;
  }
  const teamHeroIds = fighters.filter(f => f.userData.team === player.userData.team).map(f => f.userData.hero.id);
  activeTeamUp = preferredTeamUp(selectedHero.id, teamHeroIds);
  teamUpReadyAt = 0;
}

function teamUpParticipants() {
  if (!activeTeamUp || !player) return [];
  return fighters.filter(f => f.userData.team === player.userData.team && activeTeamUp.members.includes(f.userData.hero.id));
}

function useTeamUp() {
  if (!player?.userData.alive || !activeTeamUp) return;
  const now = performance.now();
  if (now < teamUpReadyAt) return;
  const allies = teamFor(player.userData.team);
  const enemies = teamFor(opposingTeam(player.userData.team));
  const radius = activeTeamUp.radius || 14;
  const participants = teamUpParticipants();

  if (activeTeamUp.effectKind === 'duoHaste') {
    participants.forEach(f => {
      applyEffect(f, 'haste', { duration: activeTeamUp.duration, actor: player });
      applyEffect(f, 'shield', { duration: 1600, actor: player });
    });
  } else if (activeTeamUp.effectKind === 'teamShield') {
    allies.filter(f => f.position.distanceTo(player.position) <= radius)
      .forEach(f => applyEffect(f, 'shield', { duration: activeTeamUp.duration, actor: player }));
  } else if (activeTeamUp.effectKind === 'duoHasteShield') {
    participants.forEach(f => {
      applyEffect(f, 'haste', { duration: activeTeamUp.duration, actor: player });
      applyEffect(f, 'shield', { duration: Math.min(activeTeamUp.duration, 3600), actor: player });
    });
  } else if (activeTeamUp.effectKind === 'teamHeal') {
    allies.filter(f => f.position.distanceTo(player.position) <= radius).forEach(f => {
      heal(f, f.userData.maxHp * (activeTeamUp.healFactor || 0.22), player);
      applyEffect(f, 'shield', { duration: activeTeamUp.shieldDuration || 2200, actor: player });
    });
  } else if (activeTeamUp.effectKind === 'enemyDisrupt') {
    enemies.filter(f => f.position.distanceTo(player.position) <= radius).forEach(f => {
      applyEffect(f, 'slow', { duration: activeTeamUp.duration, actor: player });
      applyEffect(f, 'root', { duration: 650, actor: player });
    });
  }

  teamUpReadyAt = now + activeTeamUp.cooldown * 1000;
  pulseEffect(player.position, selectedHero.color, radius, 0.75);
  tone(210, 0.18, 0.045, 'triangle');
  showBanner(activeTeamUp.name.toUpperCase(), 1200);
}

function usePlayerAbility() {
  if (!player?.userData.alive) return;
  const now = performance.now();
  if (now < abilityReadyAt) return;

  if (selectedHero.id === 'kang') {
    const rewind = [...temporalHistory].reverse().find(sample => now - sample.t >= 1400);
    if (!rewind || heroResource < 40) {
      showBanner(heroResource < 40 ? 'BUILD TEMPORAL CHARGE' : 'NO TIME ANCHOR', 650);
      return;
    }
    const destination = new THREE.Vector3(rewind.x, rewind.y, rewind.z);
    if (!overlapsWorld(destination, 0.66)) {
      player.position.copy(destination);
      verticalVelocity = 0;
      gainHeroResource(-40);
      pulseEffect(player.position, selectedHero.color, 5.5, 0.55);
      abilityReadyAt = now + selectedHero.abilityCooldown * 1000;
      showBanner('TEMPORAL REWIND', 750);
    }
    return;
  }

  if (selectedHero.id === 'silver-surfer') {
    if (heroResource < 30) {
      showBanner('BUILD POWER COSMIC', 650);
      return;
    }
    gainHeroResource(-30);
    flightUntil = now + 4500;
    player.position.y = Math.max(player.position.y, 2.8);
    verticalVelocity = 0;
    activateAbility(player, selectedHero.abilityKind, true);
    abilityReadyAt = now + selectedHero.abilityCooldown * 1000;
    showBanner('COSMIC FLIGHT', 750);
    return;
  }

  if (selectedHero.id === 'doctor-doom' && heroResource >= 50) {
    gainHeroResource(-50);
    player.userData.empoweredUntil = Math.max(player.userData.empoweredUntil, now + 1800);
    pulseEffect(player.position, selectedHero.color, 7, 0.45);
    showBanner('ARCANE CHARGE EMPOWERED', 700);
  }

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
    enemies.filter(e => e.position.distanceTo(actor.position) < 14)
      .forEach(e => applyEffect(e, 'stun', { duration: 3500, actor }));
    pulseEffect(actor.position, 0xb98cff, 14, 0.8);
  }
  if (hero.ultKind === 'teamHeal') {
    allies.forEach(a => heal(a, a.userData.maxHp * 0.42, actor));
    allies.forEach(a => applyEffect(a, 'shield', { duration: 2500, actor }));
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
  const difficulty = getBotDifficulty(selectedBotDifficulty);
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
      bot.userData.abilityReadyAt = now + hero.abilityCooldown * difficulty.cooldownMultiplier * 1000;
    }
  }

  if (now >= bot.userData.ultReadyAt) {
    const nearbyEnemies = living(bot.userData.team === 'blue' ? 'red' : 'blue').filter(e => e.position.distanceTo(bot.position) < 14).length;
    if (nearbyEnemies >= 2 || hero.role === 'Strategist') {
      activateUltimate(bot, false);
      bot.userData.ultReadyAt = now + (30000 + Math.random() * 12000) * difficulty.cooldownMultiplier;
    }
  }
}

const coverPoints = [
  new THREE.Vector3(-21,0,-11), new THREE.Vector3(-9,0,-11), new THREE.Vector3(9,0,-12), new THREE.Vector3(20,0,-12),
  new THREE.Vector3(-25,0,9), new THREE.Vector3(-13,0,9), new THREE.Vector3(13,0,10), new THREE.Vector3(24,0,10),
  new THREE.Vector3(-11,0,3), new THREE.Vector3(-11,0,-4), new THREE.Vector3(11,0,3), new THREE.Vector3(11,0,-4)
];

function bestCoverPoint(bot, target) {
  if (!target) return null;
  let best = null;
  let score = Infinity;
  for (const p of coverPoints) {
    if (overlapsWorld(p, 0.8)) continue;
    const travel = bot.position.distanceTo(p);
    if (travel > 22) continue;
    const safety = target.position.distanceTo(p);
    const objectivePenalty = Math.max(0, p.length() - 24) * 0.35;
    const s = travel - safety * 0.55 + objectivePenalty;
    if (s < score) { score = s; best = p; }
  }
  return best;
}

function updateBots(dt, now) {
  for (const bot of fighters) {
    if (bot.userData.isPlayer || bot.userData.isRemote || !bot.userData.alive || matchOver || now < bot.userData.stunnedUntil) continue;
    const hero = bot.userData.hero;
    const difficulty = getBotDifficulty(selectedBotDifficulty);
    let target = nearestEnemy(bot);
    bot.userData.target = target;
    updateBotAbility(bot, now);

    const escortObjective = selectedMode === 'convoy' || (selectedMode === 'convergence' && convergencePhase === 'escort');
    const point = escortObjective ? payload.position.clone().setY(0) : new THREE.Vector3(0, 0, 0);
    let desired = point.clone().sub(bot.position);

    const hpPct = bot.userData.hp / bot.userData.maxHp;
    if (hpPct < 0.36 && target) {
      const cover = bestCoverPoint(bot, target);
      if (cover) desired = cover.clone().sub(bot.position);
    } else if (hero.role === 'Strategist') {
      const low = lowestAlly(bot);
      if (low && low.userData.hp / low.userData.maxHp < 0.72) desired = low.position.clone().sub(bot.position);
      else desired.multiplyScalar(0.75);
    } else if (hero.role === 'Duelist' && target) {
      const side = new THREE.Vector3(-(target.position.z - bot.position.z), 0, target.position.x - bot.position.x).normalize();
      desired = target.position.clone().sub(bot.position).addScaledVector(side, 5.5 * bot.userData.flankSign);
    } else if (target && bot.position.distanceTo(target.position) < 14) {
      desired = target.position.clone().sub(bot.position);
    }

    if (target) {
      const dist = bot.position.distanceTo(target.position);
      const preferred = hero.role === 'Vanguard' ? Math.min(hero.range * 0.75, 6) : hero.role === 'Strategist' ? Math.max(hero.range * 0.75, 13) : Math.max(hero.range * 0.7, 7);
      if (dist < preferred) desired.add(target.position.clone().sub(bot.position).normalize().multiplyScalar(-5));
      bot.lookAt(target.position.x, bot.position.y, target.position.z);
    }

    if (now >= bot.userData.rootedUntil && desired.lengthSq() > 0.04) {
      let botSpeed = hero.speed * (hero.role === 'Duelist' ? 0.58 : 0.5);
      if (now < bot.userData.slowedUntil) botSpeed *= 0.58;
      if (now < bot.userData.hasteUntil) botSpeed *= 1.28;
      moveWithCollision(bot, desired.normalize().multiplyScalar(botSpeed * difficulty.speedMultiplier * dt));
    }

    if (target) {
      const dist = bot.position.distanceTo(target.position);
      if (dist <= hero.range && now - bot.userData.lastAttack >= hero.fireRate * 1000) {
        bot.userData.lastAttack = now;
        const baseAccuracy = hero.role === 'Duelist' ? 0.68 : hero.role === 'Strategist' ? 0.55 : 0.61;
        const accuracy = THREE.MathUtils.clamp(baseAccuracy + difficulty.accuracyModifier, 0.15, 0.95);
        if (Math.random() < accuracy) {
          if (hero.attackType === 'projectile') {
            const dir = target.position.clone().add(new THREE.Vector3(0, 1.2, 0))
              .sub(bot.position.clone().add(new THREE.Vector3(0, 1.2, 0))).normalize();
            spawnProjectile(bot, dir, hero.damage * 0.52 * difficulty.damageMultiplier, hero.projectileSpeed || 25);
          } else {
            damage(target, hero.damage * 0.52 * difficulty.damageMultiplier, bot);
          }
        }
      }
    }
  }
}

function updateRespawns(now) {
  for (const f of fighters) {
    if (f.userData.isRemote || f.userData.alive || now < f.userData.respawnAt || matchOver) continue;
    if (joinedLobby && f === player) continue;
    const sameTeam = fighters.filter(x => x.userData.team === f.userData.team);
    resetFighter(f, sameTeam.indexOf(f));
    if (f === player) showBanner('RESPAWNED');
  }
}

function updateConvoy(dt, now) {
  convoyTimeRemaining = Math.max(0, (convoyEndsAt - now) / 1000);
  const payloadPos = payload.position;
  const blueOn = living('blue').filter(f => f.position.distanceTo(payloadPos) < CONVOY_RADIUS).length;
  const redOn = living('red').filter(f => f.position.distanceTo(payloadPos) < CONVOY_RADIUS).length;

  if (blueOn > 0 && redOn === 0) {
    const escortBoost = Math.min(1.75, 1 + (blueOn - 1) * 0.16);
    convoyProgress = Math.min(100, convoyProgress + dt * 4.8 * escortBoost);
    updatePayloadTransform();
    objectiveState = `ESCORTING · ${Math.floor(convoyProgress)}% · ${Math.ceil(convoyTimeRemaining)}s`;
  } else if (blueOn > 0 && redOn > 0) {
    objectiveState = `PAYLOAD CONTESTED · ${Math.ceil(convoyTimeRemaining)}s`;
  } else {
    objectiveState = `ESCORT THE PAYLOAD · ${Math.floor(convoyProgress)}% · ${Math.ceil(convoyTimeRemaining)}s`;
  }

  blueScore = convoyProgress;
  redScore = Math.max(0, 100 - convoyProgress);
  document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.floor(convoyProgress)}%`;
  document.querySelector('#redScore').textContent = `LEGION ${Math.ceil(convoyTimeRemaining)}s`;
  document.querySelector('#objectiveState').textContent = objectiveState;

  if (!matchOver && convoyProgress >= 100) {
    matchOver = true;
    blueScore = 100;
    redScore = 0;
    showBanner('ALLIANCE VICTORY', 5000);
    setTimeout(() => location.reload(), 5200);
  } else if (!matchOver && convoyTimeRemaining <= 0) {
    matchOver = true;
    redScore = 100;
    showBanner('LEGION VICTORY', 5000);
    setTimeout(() => location.reload(), 5200);
  }
}

function updateConvergence(dt, now) {
  if (convergencePhase === 'capture') {
    const blueOn = living('blue').filter(f => Math.hypot(f.position.x, f.position.z) < OBJECTIVE_RADIUS).length;
    const redOn = living('red').filter(f => Math.hypot(f.position.x, f.position.z) < OBJECTIVE_RADIUS).length;

    if (blueOn > redOn) {
      convergenceBlueCapture = Math.min(CONVERGENCE_CAPTURE_TO_WIN, convergenceBlueCapture + dt * (3 + blueOn * 0.35));
      objectiveState = `ALLIANCE SECURING CONVERGENCE · ${Math.floor(convergenceBlueCapture)}%`;
      objective.material.color.set(0x3c9dff);
      objective.material.emissive.set(0x1676d2);
    } else if (redOn > blueOn) {
      convergenceRedCapture = Math.min(CONVERGENCE_CAPTURE_TO_WIN, convergenceRedCapture + dt * (3 + redOn * 0.35));
      objectiveState = `LEGION SECURING CONVERGENCE · ${Math.floor(convergenceRedCapture)}%`;
      objective.material.color.set(0xff536d);
      objective.material.emissive.set(0xb9213d);
    } else if (blueOn && redOn) {
      objectiveState = 'CONVERGENCE CONTESTED';
      objective.material.color.set(0xa070ff);
      objective.material.emissive.set(0x6237c8);
    } else {
      objectiveState = 'CAPTURE THE CONVERGENCE';
    }

    document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.floor(convergenceBlueCapture)}`;
    document.querySelector('#redScore').textContent = `LEGION ${Math.floor(convergenceRedCapture)}`;
    document.querySelector('#objectiveState').textContent = objectiveState;

    if (convergenceBlueCapture >= CONVERGENCE_CAPTURE_TO_WIN || convergenceRedCapture >= CONVERGENCE_CAPTURE_TO_WIN) {
      convergenceEscortTeam = convergenceBlueCapture >= CONVERGENCE_CAPTURE_TO_WIN ? 'blue' : 'red';
      convergencePhase = 'escort';
      convoyProgress = 0;
      convoyTimeRemaining = CONVERGENCE_ESCORT_SECONDS;
      convoyEndsAt = now + CONVERGENCE_ESCORT_SECONDS * 1000;
      updatePayloadTransform();
      objective.visible = false;
      objectiveRing.visible = false;
      payload.visible = true;
      objectiveState = `${convergenceEscortTeam === 'blue' ? 'ALLIANCE' : 'LEGION'} WON THE POINT · ESCORT THE PAYLOAD`;
      showBanner(`${convergenceEscortTeam === 'blue' ? 'ALLIANCE' : 'LEGION'} CONTROLS THE PAYLOAD`, 1800);
    }
    return;
  }

  convoyTimeRemaining = Math.max(0, (convoyEndsAt - now) / 1000);
  const escortTeam = convergenceEscortTeam;
  const defendTeam = opposingTeam(escortTeam);
  const escortOn = living(escortTeam).filter(f => f.position.distanceTo(payload.position) < CONVOY_RADIUS).length;
  const defendOn = living(defendTeam).filter(f => f.position.distanceTo(payload.position) < CONVOY_RADIUS).length;

  if (escortOn > 0 && defendOn === 0) {
    const escortBoost = Math.min(1.75, 1 + (escortOn - 1) * 0.16);
    convoyProgress = Math.min(100, convoyProgress + dt * 4.8 * escortBoost);
    updatePayloadTransform();
    objectiveState = `${escortTeam === 'blue' ? 'ALLIANCE' : 'LEGION'} ESCORTING · ${Math.floor(convoyProgress)}% · ${Math.ceil(convoyTimeRemaining)}s`;
  } else if (escortOn > 0 && defendOn > 0) {
    objectiveState = `CONVERGENCE PAYLOAD CONTESTED · ${Math.ceil(convoyTimeRemaining)}s`;
  } else {
    objectiveState = `ESCORT THE CONVERGENCE PAYLOAD · ${Math.floor(convoyProgress)}% · ${Math.ceil(convoyTimeRemaining)}s`;
  }

  if (escortTeam === 'blue') {
    blueScore = convoyProgress;
    redScore = Math.max(0, 100 - convoyProgress);
    document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.floor(convoyProgress)}%`;
    document.querySelector('#redScore').textContent = `LEGION ${Math.ceil(convoyTimeRemaining)}s`;
  } else {
    redScore = convoyProgress;
    blueScore = Math.max(0, 100 - convoyProgress);
    document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.ceil(convoyTimeRemaining)}s`;
    document.querySelector('#redScore').textContent = `LEGION ${Math.floor(convoyProgress)}%`;
  }
  document.querySelector('#objectiveState').textContent = objectiveState;

  if (!matchOver && convoyProgress >= 100) {
    matchOver = true;
    if (escortTeam === 'blue') { blueScore = 100; redScore = 0; }
    else { redScore = 100; blueScore = 0; }
    showBanner(escortTeam === 'blue' ? 'ALLIANCE VICTORY' : 'LEGION VICTORY', 5000);
    setTimeout(() => location.reload(), 5200);
  } else if (!matchOver && convoyTimeRemaining <= 0) {
    matchOver = true;
    const winner = defendTeam;
    if (winner === 'blue') { blueScore = 100; redScore = 0; }
    else { redScore = 100; blueScore = 0; }
    showBanner(winner === 'blue' ? 'ALLIANCE VICTORY' : 'LEGION VICTORY', 5000);
    setTimeout(() => location.reload(), 5200);
  }
}

function updateObjective(dt) {
  if (selectedMode === 'convergence') {
    updateConvergence(dt, performance.now());
    return;
  }

  if (selectedMode === 'convoy') {
    updateConvoy(dt, performance.now());
    return;
  }

  if (selectedMode === 'tdm') {
    objectiveState = `TEAM DEATHMATCH · FIRST TO ${TDM_SCORE_TO_WIN}`;
    document.querySelector('#blueScore').textContent = `ALLIANCE ${Math.floor(blueScore)}`;
    document.querySelector('#redScore').textContent = `LEGION ${Math.floor(redScore)}`;
    document.querySelector('#objectiveState').textContent = objectiveState;

    if (!matchOver && (blueScore >= TDM_SCORE_TO_WIN || redScore >= TDM_SCORE_TO_WIN)) {
      matchOver = true;
      const winningBlue = blueScore >= TDM_SCORE_TO_WIN;
      showBanner(winningBlue ? 'ALLIANCE VICTORY' : 'LEGION VICTORY', 5000);
      setTimeout(() => location.reload(), 5200);
    }
    return;
  }

  const blueOn = living('blue').filter(f => Math.hypot(f.position.x, f.position.z) < OBJECTIVE_RADIUS).length;
  const redOn = living('red').filter(f => Math.hypot(f.position.x, f.position.z) < OBJECTIVE_RADIUS).length;

  if (blueOn > redOn) {
    blueScore = Math.min(DOMINATION_SCORE_TO_WIN, blueScore + dt * (2.25 + blueOn * 0.3));
    objectiveState = `ALLIANCE CAPTURING · ${blueOn}`;
    objective.material.color.set(0x3c9dff);
    objective.material.emissive.set(0x1676d2);
  } else if (redOn > blueOn) {
    redScore = Math.min(DOMINATION_SCORE_TO_WIN, redScore + dt * (2.25 + redOn * 0.3));
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

  if (!matchOver && (blueScore >= DOMINATION_SCORE_TO_WIN || redScore >= DOMINATION_SCORE_TO_WIN)) {
    const winningBlue = blueScore >= DOMINATION_SCORE_TO_WIN;
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

function updateHeroResource(dt, now) {
  if (!player?.userData.alive || !selectedHero.resourceKind) return;

  const movedDistance = player.position.distanceTo(lastResourcePosition);
  lastResourcePosition.copy(player.position);

  if (selectedHero.resourceKind === 'momentum') {
    const moving = movedDistance > 0.01;
    gainHeroResource(moving ? dt * 18 : -dt * 12);
    if (heroResource >= 65) player.userData.shieldUntil = Math.max(player.userData.shieldUntil, now + 180);
  } else if (selectedHero.resourceKind === 'speedForce') {
    const moving = movedDistance > 0.01;
    gainHeroResource(moving ? dt * 24 : -dt * 9);
  } else if (selectedHero.resourceKind === 'hatred') {
    gainHeroResource(-dt * 4.2);
  } else if (selectedHero.resourceKind === 'arcaneCharge') {
    gainHeroResource(-dt * 1.5);
  } else if (selectedHero.resourceKind === 'temporalCharge') {
    const moving = movedDistance > 0.01;
    gainHeroResource(moving ? dt * 13 : dt * 5);
  } else if (selectedHero.resourceKind === 'powerCosmic') {
    const moving = movedDistance > 0.01;
    gainHeroResource(moving ? dt * 16 : -dt * 3);
  }
}

function updatePlayer(dt, now) {
  if (!player?.userData.alive || matchOver || now < player.userData.stunnedUntil) return;
  const forward = playerForward();
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();
  if (keys[settings.keybinds.forward]) move.add(forward);
  if (keys[settings.keybinds.backward]) move.sub(forward);
  if (keys[settings.keybinds.right]) move.add(right);
  if (keys[settings.keybinds.left]) move.sub(right);
  if (move.lengthSq()) move.normalize();

  let speedBoost = player.userData.empoweredUntil > now ? 1.22 : 1;
  if (selectedHero.resourceKind === 'momentum') speedBoost *= 1 + heroResource * 0.0025;
  if (selectedHero.resourceKind === 'speedForce') speedBoost *= 1 + heroResource * 0.0038;
  if (selectedHero.resourceKind === 'powerCosmic' && now < flightUntil) speedBoost *= 1.35;
  if (player.userData.hasteUntil > now) speedBoost *= 1.32;
  if (player.userData.slowedUntil > now) speedBoost *= 0.58;
  if (player.userData.rootedUntil <= now) moveWithCollision(player, move.multiplyScalar(selectedHero.speed * speedBoost * dt));

  if (now < flightUntil && selectedHero.id === 'silver-surfer') {
    grounded = false;
    verticalVelocity = 0;
    if (keys[settings.keybinds.jump]) player.position.y = Math.min(9, player.position.y + 5 * dt);
    player.position.y = Math.max(2.2, player.position.y);
  } else {
    if (keys[settings.keybinds.jump] && grounded) { verticalVelocity = 8; grounded = false; }
    verticalVelocity -= 20 * dt;
    player.position.y += verticalVelocity * dt;
    if (player.position.y <= 0) {
      player.position.y = 0;
      verticalVelocity = 0;
      grounded = true;
    }
  }
  player.rotation.y = yaw;

  if (selectedHero.id === 'kang' && now - lastTemporalSampleAt >= 100) {
    lastTemporalSampleAt = now;
    temporalHistory.push({ t: now, x: player.position.x, y: player.position.y, z: player.position.z });
    if (temporalHistory.length > 35) temporalHistory.shift();
  }

  const camOffset = new THREE.Vector3(0, 3.15, 6.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.lerp(player.position.clone().add(camOffset), 1 - Math.pow(0.001, dt));
  if (cameraShake > 0.001) {
    const intensity = cameraShake * (settings.reducedCameraShake ? 0.18 : 1);
    camera.position.x += (Math.random() - 0.5) * 0.14 * intensity;
    camera.position.y += (Math.random() - 0.5) * 0.1 * intensity;
    cameraShake *= Math.pow(0.04, dt);
  }
  const aim = player.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(forward.clone().multiplyScalar(10));
  aim.y += Math.tan(pitch) * 10;
  camera.lookAt(aim);
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    const step = p.velocity.clone().multiplyScalar(dt);
    const next = p.mesh.position.clone().add(step);
    let removed = p.life <= 0 || overlapsWorld(next, 0.18);

    if (!removed) {
      p.mesh.position.copy(next);
      const enemyTeam = p.actor.userData.team === 'blue' ? 'red' : 'blue';
      for (const target of living(enemyTeam)) {
        const targetPos = target.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        if (p.mesh.position.distanceToSquared(targetPos) < 0.85 * 0.85) {
          damage(target, p.damage, p.actor);
          if (p.actor === player) ultimateCharge = Math.min(100, ultimateCharge + 4.5);
          pulseEffect(target.position, p.actor.userData.hero.color, 1.4, 0.2);
          removed = true;
          break;
        }
      }
    }

    if (removed) {
      const [expired] = projectiles.splice(i, 1);
      releaseProjectile(expired);
    }
  }
}

function updateFighterVisuals(now) {
  for (const f of fighters) {
    if (!f.userData.alive) continue;
    const body = f.userData.body;
    const head = f.userData.head;
    const shoulders = f.userData.shoulders;
    const last = f.userData.lastVisualPosition;
    if (!body || !head || !shoulders || !last) continue;

    const moved = f.position.distanceToSquared(last) > 0.0008;
    const phase = now * (moved ? 0.0105 : 0.003) + f.userData.visualPhase;
    const bob = Math.sin(phase) * (moved ? 0.055 : 0.018);
    body.position.y = f.userData.baseBodyY + bob;
    head.position.y = f.userData.baseHeadY + bob * 0.72;
    shoulders.position.y = f.userData.baseShoulderY + bob * 0.86;
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, moved ? Math.sin(phase * 0.5) * 0.025 : 0, 0.18);
    shoulders.rotation.z = THREE.MathUtils.lerp(shoulders.rotation.z, moved ? -body.rotation.z * 1.4 : 0, 0.16);
    last.copy(f.position);
  }
}

function updateFighterBars() {
  for (const f of fighters) {
    const bar = f.userData.healthGroup;
    const fill = f.userData.healthFill;
    if (!bar || !fill) continue;
    bar.visible = settings.showHealthBars && f.userData.alive;
    if (!f.userData.alive) continue;
    bar.quaternion.copy(camera.quaternion);
    const pct = THREE.MathUtils.clamp(f.userData.hp / f.userData.maxHp, 0, 1);
    fill.scale.x = pct;
    fill.position.x = -(1.38 * (1 - pct)) / 2;
  }
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
      const [expired] = effects.splice(i, 1);
      releaseEffect(expired);
    }
  }
}

function fighterDisplayName(f) {
  if (f === player) return 'YOU';
  const entry = f.userData.networkId ? networkPlayers.find(p => p.id === f.userData.networkId) : null;
  return entry?.name || f.userData.hero.name;
}

function renderScoreboardTeam(team, selector) {
  const rows = fighters
    .filter(f => f.userData.team === team)
    .sort((a, b) => Number(b.userData.kills || 0) - Number(a.userData.kills || 0) || Number(a.userData.deaths || 0) - Number(b.userData.deaths || 0))
    .map(f => `<div class="scoreboard-row"><span><strong>${fighterDisplayName(f)}</strong><small>${f.userData.hero.name} · ${f.userData.hero.role}</small></span><span class="scoreboard-kd">K ${Number(f.userData.kills || 0)} · D ${Number(f.userData.deaths || 0)}</span></div>`)
    .join('');
  const el = document.querySelector(selector);
  if (el) el.innerHTML = rows;
}

function renderScoreboard() {
  renderScoreboardTeam('blue', '#scoreboardBlue');
  renderScoreboardTeam('red', '#scoreboardRed');
}

function updateHud(now) {
  if (!player) return;
  const hp = Math.max(0, Math.ceil(player.userData.hp));
  document.querySelector('#hp').textContent = hp;
  document.querySelector('#healthFill').style.width = `${100 * hp / player.userData.maxHp}%`;
  document.querySelector('#kills').textContent = playerKills;
  document.querySelector('#deaths').textContent = playerDeaths;
  if (!document.querySelector('#scoreboard')?.classList.contains('hidden')) renderScoreboard();
  document.querySelector('#ultCharge').textContent = `${Math.floor(ultimateCharge)}%`;
  if (selectedHero.resourceKind) {
    document.querySelector('#heroResourceValue').textContent = `${Math.floor(heroResource)}%`;
    document.querySelector('#heroResourceFill').style.width = `${heroResource}%`;
  }
  const teamUpLabel = document.querySelector('#teamUpLabel');
  const teamUpCd = document.querySelector('#teamUpCd');
  if (activeTeamUp) {
    teamUpLabel.textContent = activeTeamUp.name;
    const teamUpRemaining = Math.max(0, (teamUpReadyAt - now) / 1000);
    teamUpCd.textContent = teamUpRemaining > 0 ? teamUpRemaining.toFixed(1) : 'READY';
  } else {
    teamUpLabel.textContent = 'NO TEAM-UP';
    teamUpCd.textContent = '—';
  }
  const secondaryRemaining = Math.max(0, (secondaryReadyAt - now) / 1000);
  document.querySelector('#secondaryCd').textContent = secondaryRemaining > 0 ? secondaryRemaining.toFixed(1) : 'READY';
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
    updateHeroResource(dt, now);
    if (joinedLobby && network.connected && player && now - lastNetworkStateAt >= 100) {
      lastNetworkStateAt = now;
      network.sendState({
        t: Date.now(),
        position: { x: player.position.x, y: player.position.y, z: player.position.z },
        rotationY: player.rotation.y,
        hp: player.userData.hp,
        alive: player.userData.alive
      });
    }
    const isNetworkHost = !joinedLobby || network.playerId === lobbyHostId;
    if (isNetworkHost) {
      updateBots(dt, now);
      updateObjective(dt);
      if (joinedLobby && network.connected && now - lastMatchStateAt >= 100) {
        lastMatchStateAt = now;
        const bots = fighters
          .filter(f => !f.userData.isPlayer && !f.userData.isRemote)
          .map(f => ({
            slot: f.userData.syncSlot,
            team: f.userData.team,
            heroId: f.userData.hero.id,
            position: { x: f.position.x, y: f.position.y, z: f.position.z },
            rotationY: f.rotation.y,
            hp: f.userData.hp,
            alive: f.userData.alive,
            kills: Number(f.userData.kills || 0),
            deaths: Number(f.userData.deaths || 0)
          }));
        network.send('match-state', {
          state: {
            blueScore, redScore, objectiveState, matchOver, convoyProgress, convoyTimeRemaining,
            convergencePhase, convergenceBlueCapture, convergenceRedCapture, convergenceEscortTeam, bots
          }
        });
      }
    }
    updateRespawns(now);
    updateHud(now);
    updateProjectiles(dt);
    updateFighterVisuals(now);
    updateFighterBars();
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

applyArenaPreset(selectedArena);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
