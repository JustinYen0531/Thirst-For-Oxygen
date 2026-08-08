# Audio layout

## Music

- `music/main-menu.mp3`
- `music/phase-{1..3}-{normal|boss}.mp3`
- `music/phase-{1..3}-{normal|boss}-2.0.mp3`

`Phase 2 / Boss 2.0` is still intentionally absent because that source file has not been provided.

## Sound effects

- `sfx/ui/`: button and menu selection
- `sfx/environment/`: underwater ambience, scuba bubbles, and water drop
- `sfx/movement/`: launch whoosh
- `sfx/collision/`: wet impact
- `sfx/interaction/`: portal / layer transition
- `sfx/combat/`: explosion and laser
- `sfx/player/`: game-over impact
- `sfx/_duplicates/`: preserved duplicate downloads that are not imported by the game

Runtime imports come from `src/music.js` and `src/sfx.js`, so Vite includes the audio files in the production build.
