# Alpha Test Checklist

## Launch

```bash
npm install
npm run dev
```

Open the Vite URL in a desktop browser.

## Core match checks

1. Select multiple heroes and verify the HUD updates primary, ability and ultimate names.
2. Confirm the match starts as 6v6 with bots filling all open slots.
3. Verify WASD movement, mouse aim, jump, primary fire, Shift ability and Q ultimate.
4. Verify Vanguard, Duelist and Strategist heroes behave differently.
5. Confirm shields reduce incoming damage.
6. Confirm Strategist healing restores team health.
7. Confirm stun ultimates temporarily prevent movement/attacks.
8. Confirm empowered ultimates increase damage and movement.
9. Confirm bots fight, rotate toward the Nexus and use abilities.
10. Confirm deaths create kill-feed entries and respawn after five seconds.
11. Confirm objective scoring changes the Nexus color and status text.
12. Confirm contested scoring pauses and overtime appears at the finish threshold.
13. Confirm victory resets the match.

## Known alpha limitations

- Bot navigation is steering-based rather than navmesh/pathfinding.
- Arena collision and advanced traversal are still being expanded.
- Character meshes are placeholders rather than finished models/animations.
- Primary attacks are mostly hitscan placeholders.
- Audio, settings, scoreboard detail and replay systems are not complete.
- Two-human networking is not yet wired into the browser demo.


## Team Deathmatch test

1. Start the game and select **TEAM DEATHMATCH** before deploying.
2. Confirm the central capture objective is hidden.
3. Confirm eliminations increase the correct team score.
4. Confirm the first team to 30 eliminations wins.
5. In a two-client lobby, have the host select Team Deathmatch and start the match.
6. Confirm both clients enter Team Deathmatch and display the same team scores.
7. Confirm human-vs-human and human-vs-bot eliminations update the shared score once, without duplicate scoring.


## Settings and keybind test

1. Open **SETTINGS & KEYBINDS** on the hero-select screen.
2. Change FOV, mouse sensitivity, master volume and reduced camera shake.
3. Remap movement, jump, ability and ultimate keys.
4. Deploy and verify the new controls/settings apply immediately.
5. Reload the game and verify settings persist.
6. Use **RESET SETTINGS** and verify defaults are restored.


## Health-bar visibility test

1. Open **SETTINGS & KEYBINDS**.
2. Disable **Show combatant health bars** and deploy.
3. Confirm overhead health bars are hidden while HUD health remains visible.
4. Reload and confirm the setting persists.
5. Re-enable the setting and confirm bars return.
