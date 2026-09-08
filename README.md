# Rivals: Collision

Private, browser-first Marvel/DC hero-shooter demo.

## Current playable scope

- Hero-select screen with 33 Marvel/DC roster entries
- 6v6 match population
- Offline 6v6 with one local human and bot fill; private lobbies support multiple connected humans with bots filling remaining slots
- Third-person movement and camera
- Persistent FOV, mouse sensitivity, volume, reduced-shake and keybind settings
- Primary and secondary attacks
- Hero-specific health, damage, range, movement speed, fire rate, secondary, ability and ultimate data
- Bot target acquisition, cover/flank movement and combat
- Domination capture objective, Team Deathmatch, Convoy, and Convergence
- Mode-specific score progression (Domination to 100; Team Deathmatch to 30)
- Deaths, kill feed, respawns, K/D tracking, and a hold-Tab team scoreboard
- Ultimate charge and area-damage ultimate
- Match victory and automatic reset
- Dedicated Training Range with stationary/moving/hostile targets, live hero switching, cooldown reset, target reset, and infinite-ultimate toggle

## Controls

- WASD — movement
- Mouse — aim
- Left Mouse — primary attack
- Right Mouse — secondary action
- Shift — mobility ability
- F — team-up ability when an eligible partner is on your team
- Q — ultimate at 100%
- Space — jump (default; movement/jump/ability/ultimate keyboard binds are remappable)
- Tab — hold scoreboard

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in the terminal.

### Private-lobby networking

Run the WebSocket relay server in a second terminal:

```bash
npm run server
```

The browser client defaults to `ws://localhost:8787`. For a hosted server, set `VITE_WS_URL` before building the browser client.

Current private networking supports lobby creation/joining, team assignment, host migration, remote human rendering, player-state relays, host-owned bot/objective state, synchronized current ability effects, validated human combat relays, and server-authoritative connected-human HP/death/respawn state, plus server-authoritative network healing and shield mitigation.

## Direction

This is the foundation for the larger browser/downloadable hero shooter: human players occupy available slots and bots fill the rest. Networking authority, richer individual hero kits, additional maps/modes, animation/model polish and downloadable packaging are subsequent milestones.


## Desktop build

The same production web build can be packaged as a standalone Electron application.

```bash
npm install
npm run desktop:dist
```

Generated packages are written to `release/`.

GitHub Actions also includes a `Desktop Packages` workflow that builds Windows portable, Linux AppImage, and macOS ZIP artifacts from `main`.


## Hosted browser demo

The repository includes a `Browser Demo` GitHub Actions workflow that builds the current `main` branch for GitHub Pages. A one-time repository-level Pages enablement is still required before deployment can complete.

The hosted Pages build supports the full offline 6v6 experience. Private multiplayer still requires a reachable WebSocket server configured through `VITE_WS_URL`; when no server is available, the UI falls back to offline play.


## Team-up abilities

The current prototype includes reusable pair-based team-ups for Batman + Nightwing, Superman + Wonder Woman, Flash + Green Lantern, Raven + Starfire, and Batman + Cyborg. When the selected hero has an eligible partner on the same team, the HUD exposes an `F` team-up slot with its own cooldown.


## Bot difficulty

Before deploying, choose Easy, Normal, Hard, or Expert. The profile changes bot movement pressure, accuracy, damage output, and ability/ultimate cadence. In private lobbies, the host-selected difficulty is synchronized to all clients when the match starts.


## Arenas

Three prototype arena layouts are selectable before deployment:

- **Nexus Arena** — balanced city combat.
- **Gotham Industrial** — tighter lanes, alleys, and flank routes.
- **Themyscira Ruins** — broader sightlines with temple-style cover.

Arena selection changes environment palette, cover placement, collision geometry, and combat lanes. In private lobbies, the host's arena selection is synchronized to every client when the match starts.


## Convoy mode

**Convoy** is an attack/defend payload mode. Alliance escorts the payload from its start line toward Legion territory while Legion contests the escort radius. The attacking team wins by reaching 100% progress; the defending team wins if the three-minute round timer expires first.

In private lobbies, the host owns payload progress, timer, bot behavior, and victory state and synchronizes them to the other clients.


## Convergence mode

**Convergence** is a two-stage hybrid mode. Both teams first fight over a neutral capture point. The team that completes that capture becomes the escorting team, the payload spawns on its side of the map, and the route reverses automatically if Legion wins the opening point. The escorting team must reach 100% payload progress before the 2:30 escort timer expires; otherwise the defending team wins.

In private lobbies, the host synchronizes capture progress, phase transitions, escort-team ownership, payload progress, timer state, bots, and victory state to connected clients.


## Testing

See [TESTING.md](./TESTING.md) for offline testing, two-client private match setup, automated validation coverage, build artifacts, and current alpha limitations.


## Training Range

Choose **Enter Training Range** from the hero-select screen for a no-score practice environment. The range includes stationary targets, moving targets, and one hostile target. Training controls support live hero switching, cooldown reset, ultimate fill, infinite ultimate, and target reset so hero kits and resource systems can be exercised quickly without a full match.


## Flagship hero mechanics

Additional bespoke hero behaviors now include:

- **Batman** — Grapnel Launch adds vertical traversal; holding jump while airborne reduces fall speed for glide-like movement.
- **Superman** — Solar Flight enables temporary controlled aerial movement with increased travel speed.
- **Professor X** — Mental Command now targets a nearby ally, granting haste plus a short protective shield.


## Controller support

Standard browser Gamepad API controllers are supported alongside keyboard/mouse. Default standard-layout mapping:

- Left stick — movement
- Right stick — aim
- RT — primary attack
- LT — secondary action
- RB — hero ability
- LB — team-up
- Y / Triangle — ultimate
- A / Cross — jump / ascend while flying
- Back / View — hold scoreboard

Keyboard and mouse remain active while a controller is connected.


## Villain flagship mechanics

- **Juggernaut** — Unstoppable Charge converts Momentum into a longer charge, impact damage, knockback, and brief damage mitigation.
- **Gorr** — God Hunter marks a high-health enemy in range; while the mark is active, Gorr gains pursuit speed and bonus melee damage against that target.


## Destructible cover

Each arena now includes six predefined breakable cover pieces. Damage removes their HP; once destroyed, the mesh and collision volume are removed to open the lane. Projectile, hitscan/beam, melee, and Juggernaut charge interactions can destroy cover.

In private matches, the host owns destructible HP/alive state. Non-host world damage is routed to the host and the regular match snapshot replicates destruction state to all clients.


## Camera controls

The third-person camera now resolves collision against arena structures and live destructible cover, pulling forward instead of clipping through geometry.

- **V** — swap left/right shoulder
- **R3 / Right Stick Click** — swap shoulder on controller


## Universal quick melee

Every hero now has a short-range quick melee separate from their primary attack.

- **C** — quick melee on keyboard
- **B / Circle** — quick melee on standard controller layouts

Quick melee has a short lockout, can finish nearby enemies, applies light knockback, and can damage destructible cover.


## Respawn spectator

When the local player is eliminated in a normal match, the camera automatically follows a living teammate until respawn.

- **[ / ]** or **Left / Right Arrow** — previous/next teammate
- **D-pad Left / Right** — previous/next teammate on controller

The spectator camera uses the same collision-aware third-person camera and returns control automatically when the player respawns.


## In-match hero swapping

Press **H** during a normal match to open the hero swap overlay when either:

- you are eliminated and waiting to respawn, or
- you are within your team's spawn area.

Hero swaps preserve K/D, team, match score, and respawn timing. Hero-specific cooldowns/resources reset, and networked swaps update remote fighter visuals/state for all connected clients.


## Spawn protection

Players receive **2.5 seconds of spawn protection** on initial spawn and respawn. In private matches, the protection timer is server-authoritative and incoming human damage is rejected until the window expires. The HUD displays the remaining protection time.


## Lobby ready states

Private lobbies now track per-player readiness. The host is automatically ready when creating the lobby; joining players use the **Ready** button before launch. The host cannot start until every non-host participant is ready.


## Post-match results

Normal matches now end on a persistent results screen instead of automatically reloading. The screen shows:

- winning team and mode/map context
- match MVP based on synchronized K/D performance
- both team rosters with hero, role, kills, and deaths
- the local player's final K/D
- an explicit **Return to Lobby / Menu** action

Private-match clients open the same results flow when the host-authoritative match state reports the match as complete.


## Thanos bespoke mechanics

- **Gauntlet Charge** builds from successful melee pressure and damage taken, then slowly decays.
- **Reality Crush** spends charge to damage, slow, and knock back nearby enemies while smashing breakable cover.
- **Space Stone** spends charge for a forward reposition with brief protection and impact damage; without enough charge, Shift falls back to Titan Charge.
- **Infinity Surge** consumes stored Gauntlet Charge to scale its radius, damage, stun, knockback, and environmental destruction.


## Darkseid bespoke mechanics

- **Omega Charge** builds from Omega Beam hits and damage taken, then slowly decays.
- **Boom Tube** spends charge to reposition Darkseid forward while granting brief protection.
- **Omega Sanction** spends charge to damage, root, and slow a target in front of Darkseid.
- **Anti-Life Equation** consumes remaining Omega Charge to scale its crowd-control radius, damage, and stun duration.


## 75-hero launch-target roster

The playable prototype roster now contains **75 heroes** across Marvel and DC. The expansion adds the previously approved wave (including Wolverine, Jean Grey, Magneto, Deadpool, Invisible Woman, Human Torch, Shang-Chi, Daredevil, Sentry, Doctor Octopus, Green Goblin, Miles Morales, Loki, Moon Knight, Reverse-Flash, Red Hood, Blue Beetle, Swamp Thing, Supergirl, Doctor Fate, Beast Boy, Lobo, Sinestro, Doomsday, Brainiac, Bane, and Hawkgirl) plus core Marvel anchors needed to complete the 75-character target: Spider-Man, Iron Man, Captain America, Thor, Hulk, Black Panther, Scarlet Witch, Star-Lord, Rocket Raccoon, Groot, Venom, Storm, Hawkeye, and Black Widow.

This establishes the roster data/selection/combat archetypes. Bespoke character mechanics continue in dedicated hero-system waves rather than blocking roster availability.
