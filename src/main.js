import * as THREE from 'three';
import './styles.css';

const app=document.querySelector('#app');
app.innerHTML=`<div class="hud"><div class="topbar"><span class="team blue">ALLIANCE 0</span><span class="objective">CAPTURE THE NEXUS</span><span class="team red">LEGION 0</span></div><div class="crosshair"></div><div class="instructions">WASD — move<br>Mouse — aim<br>Click — energy blast<br>Shift — dash<br>Space — jump</div><div class="hero"><div class="hero-name">SENTINEL PRIME</div><div class="role">Vanguard · Prototype Hero</div><div class="health"><div id="healthFill"></div></div><div class="hp"><span id="hp">650</span> / 650</div></div><div class="abilities"><div class="ability"><div class="key">LMB</div><div class="label">Pulse Bolt</div></div><div class="ability"><div class="key">⇧</div><div class="label">Vector Dash</div></div><div class="ability"><div class="key">Q</div><div class="label">Nova Core</div></div></div><div id="banner" class="banner">Nexus Contested</div></div>`;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x080b16);
scene.fog=new THREE.FogExp2(0x080b16,.018);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.1,1000);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
app.prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x88aaff,0x241a35,2.4));
const sun=new THREE.DirectionalLight(0xffffff,3.2);sun.position.set(12,24,8);sun.castShadow=true;scene.add(sun);

const ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshStandardMaterial({color:0x171b2a,roughness:.85,metalness:.15}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(120,60,0x5268a5,0x252c48);grid.position.y=.01;scene.add(grid);

function box(x,z,w,h,d,color){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.25}));
 m.position.set(x,h/2,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;
}
[
 [-12,-9,8,5,6,0x28324f],[11,-10,7,8,7,0x372b4c],[-17,8,10,7,5,0x293d49],
 [16,9,9,5,8,0x4a2b39],[-28,-2,7,10,15,0x252b3b],[28,0,7,11,16,0x2c263c],
 [0,-24,18,4,5,0x27344d],[0,25,20,5,5,0x3c293c]
].forEach(v=>box(...v));

const objective=new THREE.Mesh(new THREE.CylinderGeometry(5,5,.35,48),new THREE.MeshStandardMaterial({color:0x7d62ff,emissive:0x3827aa,emissiveIntensity:2,transparent:true,opacity:.8}));
objective.position.y=.2;scene.add(objective);
const ring=new THREE.Mesh(new THREE.TorusGeometry(6,.12,12,64),new THREE.MeshBasicMaterial({color:0x8bbcff}));
ring.rotation.x=Math.PI/2;ring.position.y=.45;scene.add(ring);

const player=new THREE.Group();
const body=new THREE.Mesh(new THREE.CapsuleGeometry(.65,1.25,6,12),new THREE.MeshStandardMaterial({color:0x4fa7ff,metalness:.55,roughness:.28}));
body.castShadow=true;body.position.y=1.3;player.add(body);
const core=new THREE.Mesh(new THREE.SphereGeometry(.18,16,16),new THREE.MeshBasicMaterial({color:0xd8f6ff}));
core.position.set(0,1.45,-.62);player.add(core);scene.add(player);
player.position.set(0,0,14);

const enemies=[];
for(let i=0;i<5;i++){
 const e=new THREE.Mesh(new THREE.CapsuleGeometry(.55,1,5,10),new THREE.MeshStandardMaterial({color:0xe94b68,roughness:.45}));
 e.position.set((i-2)*3,1.1,-12-Math.abs(i-2)*2);e.userData.hp=100;e.castShadow=true;scene.add(e);enemies.push(e);
}

const keys={};let yaw=0,pitch=-.12,vy=0,onGround=true,lastShot=0,dashCd=0;
addEventListener('keydown',e=>keys[e.code]=true);addEventListener('keyup',e=>keys[e.code]=false);
renderer.domElement.addEventListener('click',()=>renderer.domElement.requestPointerLock());
addEventListener('mousemove',e=>{if(document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0022;pitch=Math.max(-.75,Math.min(.35,pitch-e.movementY*.0018));}});
addEventListener('mousedown',e=>{if(e.button===0)shoot();});

const raycaster=new THREE.Raycaster();
function shoot(){
 const now=performance.now();if(now-lastShot<220)return;lastShot=now;
 raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
 const hits=raycaster.intersectObjects(enemies.filter(e=>e.parent));
 if(hits.length){const e=hits[0].object;e.userData.hp-=34;e.material.emissive=new THREE.Color(0xffffff);setTimeout(()=>{if(e.parent)e.material.emissive.set(0x000000)},65);if(e.userData.hp<=0){scene.remove(e);}}
}

const clock=new THREE.Clock();
function animate(){
 requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.033);
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
 const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
 const move=new THREE.Vector3();
 if(keys.KeyW)move.add(forward);if(keys.KeyS)move.sub(forward);if(keys.KeyD)move.add(right);if(keys.KeyA)move.sub(right);
 if(move.lengthSq())move.normalize();
 let speed=7;
 dashCd-=dt;if((keys.ShiftLeft||keys.ShiftRight)&&dashCd<=0&&move.lengthSq()){speed=24;dashCd=1.25;}
 player.position.addScaledVector(move,speed*dt);
 if(keys.Space&&onGround){vy=8;onGround=false;}vy-=20*dt;player.position.y+=vy*dt;if(player.position.y<=0){player.position.y=0;vy=0;onGround=true;}
 player.rotation.y=yaw;
 const camOffset=new THREE.Vector3(0,3.1,6.2).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
 camera.position.lerp(player.position.clone().add(camOffset),1-Math.pow(.001,dt));
 const target=player.position.clone().add(new THREE.Vector3(0,1.55,0)).add(forward.clone().multiplyScalar(10));
 target.y+=Math.tan(pitch)*10;camera.lookAt(target);
 ring.rotation.z+=dt*.35;objective.material.emissiveIntensity=1.6+Math.sin(performance.now()*.004)*.7;
 const inPoint=Math.hypot(player.position.x,player.position.z)<6.2;
 document.querySelector('#banner').classList.toggle('show',inPoint);
 enemies.forEach(e=>{if(!e.parent)return;const to=player.position.clone().sub(e.position);to.y=0;if(to.length()<16&&to.length()>2.4)e.position.addScaledVector(to.normalize(),dt*1.3);e.lookAt(player.position.x,e.position.y,player.position.z);});
 renderer.render(scene,camera);
}
animate();

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
