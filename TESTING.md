# Private Demo Test Guide

## Fastest offline test

1. Install Node.js 22 or newer.
2. Clone the repository and open a terminal in the project root.
3. Run:
   ```bash
   npm install
   npm run dev
   ```
4. Open the local Vite URL.
5. Pick an arena, mode, bot difficulty, and hero.
6. Select **Deploy Offline Battle**.

Offline matches run as 6v6 with bots filling every non-human slot.

## Current modes

- **Domination** — capture and hold the central Nexus; first team to 100 wins.
- **Team Deathmatch** — eliminations score; first team to 30 wins.
- **Convoy** — Alliance escorts a payload while Legion defends.
- **Convergence** — both teams fight for a neutral point; the winning team becomes the payload escort team.

## Current arenas

- Nexus Arena
- Gotham Industrial
- Themyscira Ruins

## Training Range test

1. From hero select, choose **Enter Training Range**.
2. Confirm stationary and moving targets spawn and the hostile target attacks.
3. Switch heroes from the Training Range panel and confirm HUD, HP, attacks, resource meter, and colors update without a reload.
4. Use **Reset Cooldowns** and confirm Shift/RMB cooldowns return to ready.
5. Use **Fill Ultimate** and confirm Q reaches 100%.
6. Enable **Infinite Ult** and confirm Q remains available after activation.
7. Destroy practice targets and confirm they respawn at their range positions.
8. Use **Reset Targets** and confirm all targets return to full HP and their original locations.
9. As Batman, use Shift to gain vertical height and hold Space while airborne to confirm reduced fall speed.
10. As Superman, use Shift and confirm temporary aerial movement with increased travel speed.
11. As Professor X, use RMB near an ally and confirm Mental Command grants haste plus a short shield.
12. As Juggernaut, build Momentum by moving, use Shift, and confirm Unstoppable Charge travels farther, damages/knocks back nearby targets, and grants a brief shield window.
13. As Gorr, use Shift near multiple targets and confirm God Hunter marks the highest-health target; pursue and strike it to confirm bonus movement and melee pressure.

## Two-human private match test

Use two browser windows, two computers, or two separate browser profiles.

### Start the game server

In terminal 1:

```bash
npm install
npm run server
```

The default WebSocket endpoint is:

```text
ws://localhost:8787
```

### Start the browser client

In terminal 2:

```bash
npm run dev
```

Open the Vite URL on both clients.

On Client A:

1. Enter a player name.
2. Select a hero.
3. Select mode, difficulty, and arena.
4. Choose **Create Private Lobby**.
5. Copy the six-character lobby code.

On Client B:

1. Enter a player name.
2. Enter Client A's lobby code.
3. Choose **Join Lobby**.

Client A is the host. Start the match from Client A.

Expected behavior:

- Both humans appear in the same 6v6 match.
- Bots fill remaining team slots.
- Human transforms, HP/alive state, current ability effects, human-vs-human damage, bot state, objective state, mode state, and team scoring synchronize through the current networking layer.
- Host migration is available if the lobby host leaves.
- Human HP is still owner-applied rather than fully server-authoritative.

## Core gameplay checks

1. Select several Vanguard, Duelist, and Strategist heroes and confirm different movement/combat profiles.
2. Confirm primary, secondary, Shift ability, team-up, and ultimate labels match the selected hero.
3. Confirm shields reduce incoming damage.
4. Confirm healing restores allied health.
5. Confirm slow/root/stun/knockback effects alter combat behavior.
6. Confirm bots pursue objectives, seek cover at low health, and flank based on role.
7. Confirm deaths create kill-feed entries and respawn after five seconds.
8. Confirm match victory triggers correctly in all four modes.
9. Test all three arenas for collision and route accessibility.
10. Test Easy, Normal, Hard, and Expert bot difficulty.
11. Hold **Tab** during a match and confirm both teams show hero/role plus K/D, with human K/D synchronized in private matches.

## Controls

Default controls:

- WASD — movement
- Mouse — aim
- Left Mouse — primary
- Right Mouse — secondary
- Shift — hero ability
- F — team-up ability when available
- Q — ultimate
- Space — jump
- Tab — hold scoreboard

Movement/jump/ability/ultimate keyboard bindings can be remapped in Settings.

## Settings checks

1. Change FOV, mouse sensitivity, master volume, reduced camera shake, and health-bar visibility.
2. Remap supported keyboard controls.
3. Reload and confirm settings persist.
4. Use **Reset Settings** and confirm defaults return.

## Automated validation

Before gameplay changes are merged to `main`, CI runs:

```bash
npm run build
npm run check:server
npm run test:network
npm run test:teamups
npm run test:bots
npm run test:arenas
npm run test:heroes
```

## Downloadable builds

### Browser artifact

The **Build Check** workflow uploads the production `dist/` directory as:

```text
rivals-collision-web
```

### Desktop packages

The **Desktop Packages** workflow produces Electron packages for supported platforms. Local packaging is available with:

```bash
npm run desktop:dist
```

Output is written to:

```text
release/
```

## Hosted browser demo prerequisite

The Browser Demo workflow itself builds successfully, but GitHub currently blocks automatic creation of the repository's Pages site with:

```text
Resource not accessible by integration
```

This is a repository-level GitHub Pages enablement restriction, not a game build failure. After Pages is enabled once in repository settings, the existing workflow is already configured to deploy `main`.

## Current alpha limitations

- Original placeholder geometry is used instead of licensed character models.
- Procedural/placeholder audio is used instead of production sound assets.
- Connected-human HP, death, kill generation, and respawn timing are server-authoritative.
- Networking is intended for private testing, not hostile public matchmaking.
- Many heroes use reusable prototype archetypes and still need deeper bespoke mechanics.
- Wider browser/hardware playtesting remains necessary.


## Controller test

1. Connect an Xbox-, PlayStation-, or standard-layout browser-compatible controller before or during a match.
2. Confirm left stick moves and right stick aims.
3. Confirm RT primary and LT secondary work.
4. Confirm RB activates the hero ability, LB activates an available team-up, and Y/Triangle activates a charged ultimate.
5. Confirm A/Cross jumps and ascends during Superman/Silver Surfer flight.
6. Confirm Batman can hold A/Cross while airborne to glide.
7. Hold Back/View and confirm the scoreboard appears.
8. Confirm keyboard/mouse input still works while the controller is connected.


## Network authority checks

1. In a two-human private match, damage a teammate's opponent and verify the server-authoritative HP state matches both clients.
2. Apply a friendly heal to a damaged human and verify server HP increases by the same amount.
3. Apply a friendly shield to a human, then deal damage before it expires and verify the authoritative damage is reduced.
4. After the shield expires, verify subsequent damage resolves at full value.
5. Confirm death, K/D, and respawn timing remain synchronized after heals and shields.


## Destruction test

1. Enter any arena and identify the smaller breakable cover pieces near the central lanes.
2. Damage them with projectiles and beam/hitscan attacks; confirm HP loss eventually removes the mesh and collision.
3. Use a melee hero at close range and confirm cover can be smashed.
4. As Juggernaut, charge through breakable cover and confirm destruction along the path.
5. In a two-client private match, destroy cover from the non-host client and confirm the host applies the damage and both clients show the same open lane.
6. Confirm destroyed cover resets when a fresh match or Training Range starts.
