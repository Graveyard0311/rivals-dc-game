# Rivals: Collision

Private, browser-first Marvel/DC hero-shooter demo.

## Current playable scope

- Hero-select screen with Marvel and DC roster entries
- 6v6 match population
- One human player with bots filling the remaining slots
- Third-person movement and camera
- Primary attacks
- Hero-specific health, damage, range, movement speed, fire rate, ability and ultimate data
- Bot target acquisition, movement and combat
- Central capture objective
- Team score progression to 100
- Deaths, kill feed, respawns and K/D tracking
- Ultimate charge and area-damage ultimate
- Match victory and automatic reset

## Controls

- WASD — movement
- Mouse — aim
- Left Mouse — primary attack
- Shift — mobility ability
- Q — ultimate at 100%
- Space — jump

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in the terminal.

## Direction

This is the foundation for the larger browser/downloadable hero shooter: human players occupy available slots and bots fill the rest. Networking, richer individual hero kits, additional maps/modes, animation/audio, improved navigation AI and downloadable packaging are subsequent milestones.
