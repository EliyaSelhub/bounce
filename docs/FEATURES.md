# Bounce — Feature Inventory

## Engine & Physics
- Phaser 3 via Vite, arcade physics, portrait 450×800
- Gravity (`1600 px/s²`) pulls player downward; bounce applies `-1800 px/s` upward velocity on platform contact
- Fall speed capped at `750 px/s` to prevent tunneling
- Manual AABB collision (not Phaser collider) with prev-frame bottom tracking

## Controls
- **Desktop:** character chases mouse X continuously (no click required to move)
- **Mobile:** character chases last touch X; `pointermove` fires only while finger is down, `pointerdown` sets target on tap
- Character clamped to screen edges horizontally
- Click/tap anywhere to start from idle state

## Camera
- Camera top (`scrollY`) only ever decreases — never scrolls back down
- Player held at `H * 0.25` (25%) from top; 75% of screen shows what's below
- Progression is permanent: falling back down brings player closer to game-over, not to earlier platforms

## Platforms
- Each platform is `W * 0.25` (quarter screen width) wide, `14px` tall
- Random X within padded screen bounds
- Vertical gap between platforms: `120–400px` (non-uniform distribution)
- Two infinite spawn trackers: `spawnBelow` for initial fall, `spawnAbove` for ascent
- Culled the instant the platform's top edge exits the screen bottom

## Scoring
- Score = `floor(-highestWorldY / 55)` — increases only as player reaches new heights, never decreases

## Game States
- **Idle:** player suspended, gravity disabled, "Click / Tap to Start" prompt visible
- **Playing:** gravity active, controls live, score tracked
- **Dead:** player fell below screen bottom; GAME OVER + score shown; tap to restart after 1.5s delay
