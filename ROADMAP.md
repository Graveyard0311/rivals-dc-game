# Rivals: Collision Roadmap

## Milestone A — Core combat foundation ✅
- Three.js/Vite browser client
- Third-person camera and movement
- Hero selection
- 6v6 bot-populated matches
- Objective scoring
- Death/respawn loop
- Kill feed and HUD
- CI build verification

## Milestone B — Hero identity ✅
- Data-driven Marvel/DC roster
- Vanguard, Duelist and Strategist roles
- Hero-specific primary names
- Dash/blink/shield/team-shield/heal/burst ability archetypes
- Slam/empower/stun/team-heal ultimate archetypes
- Cooldowns and ultimate charge
- Role-aware bot behavior

## Milestone C — Alpha feel pass — in progress
- Arena/player collision ✅
- Better hit and projectile VFX ✅ / expanding
- Camera collision + shoulder swap ✅
- Lightweight destructible cover ✅ host-authoritative predefined breakables
- Projectile and melee attack types ✅
- Health bars/nameplates over combatants ✅
- Damage numbers/hit markers ✅
- Competitive hold-Tab scoreboard ✅ synchronized human K/D + host-replicated bot K/D
- Improved objective presentation
- Better bot cover/flank navigation ✅ / expanding
- Audio pass ✅ / procedural prototype

## Milestone D — Two-person private demo — in progress
- Multiplayer session/lobby ✅ foundation
- Two human clients in the same match ✅ transform/health replication
- Authoritative match state ✅ host-authoritative bots/objective + server-authoritative human HP/death/respawn
- Bots fill every unused slot ✅
- Join/leave/reconnect behavior ✅ foundation
- Networked damage ✅ server-owned human HP with validated damage/death/respawn
- Networked objective state ✅
- Networked abilities ✅ current heal/shield/slow/root/stun/knockback archetypes; heal + shield mitigation are server-authoritative

## Milestone E — Content expansion
- Full priority roster ✅ 33-character prototype roster / expanding
- Individual bespoke hero kits ✅ / expanding — Juggernaut Momentum, Gorr Hatred, Flash Speed Force, Doom Arcane Charge, Kang Temporal Rewind, Silver Surfer Cosmic Flight, Batman Grapnel/Glide, Superman Flight, Professor X Mental Command, Juggernaut Unstoppable Charge, Gorr God Hunter
- Team Deathmatch ✅
- Team-up abilities ✅ reusable pair registry + five prototype team-ups
- Additional arenas ✅ Nexus Arena / Gotham Industrial / Themyscira Ruins
- Convoy/payload ✅ host-authoritative escort mode
- Hybrid/Convergence mode ✅ neutral capture → winning-team escort
- More bot personalities/difficulty levels ✅ Easy/Normal/Hard/Expert tuning profiles

## Milestone F — Packaging/polish
- Browser-hosted test URL ⚠️ workflow ready; one-time GitHub Pages repository enablement still required
- Downloadable desktop wrapper/build ✅ Electron wrapper + cross-platform packaging workflow
- Settings and keybinds ✅ persistent local settings + remapping + health-bar visibility
- Performance optimization ✅ transient projectile/VFX pooling and caps / expanding
- Animation/model/audio polish ✅ role-distinct placeholder silhouettes + locomotion motion + procedural audio / production assets remaining
- Final private-demo QA ✅ automated build/network/team-up/bot/arena/hero regression suite + tester handoff guide / broader browser playtest remaining


## Training/validation tools
- Dedicated Training Range ✅
- Stationary and moving targets ✅
- Hostile practice target ✅
- Live hero switching ✅
- Cooldown reset / ultimate fill / infinite ultimate ✅
- Target reset ✅


## Input
- Keyboard/mouse ✅
- Persistent keyboard remapping ✅
- Standard Gamepad API controller support ✅
- Simultaneous keyboard/mouse + controller input ✅
