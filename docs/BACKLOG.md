# Bounce — Backlog

## Now — Game State & Feel

**Task 1 — Game state machine**
- Proper start screen (title, instructions)
- Idle → Playing → Dead → Restart flow with clean transitions
- High score persistence (localStorage)
- Score display polish

**Task 2 — Difficulty progression**
- Platforms get sparser / gaps widen as score increases
- Gradual ramp so early game is learnable, late game is hard

---

## Next — Visual Polish

**Task 3 — Character art**
- Replace placeholder rectangle with real character sprite
- Idle, falling, and bounce-landing animation states

**Task 4 — Platform art**
- Replace green rectangles with styled platform sprites
- Optional: different platform types (moving, crumbling, bouncy multiplier)

**Task 5 — Background & atmosphere**
- Parallax background layers that scroll at different speeds
- Sky gradient that shifts as player ascends (ground → clouds → space)

---

## Later — Juice & Audio

**Task 6 — Sound effects**
- Bounce sfx
- Game over sfx
- Background music loop

**Task 7 — Screen shake & particles**
- Brief screen shake on bounce
- Dust/spark particles on platform contact

**Task 8 — Combo system**
- Consecutive bounces without missing increment a multiplier
- Visual feedback (multiplier displayed, color shift)

---

## Done (recent)

✅ Vite + Phaser 3 setup (2026-06-19)
✅ Core physics engine — gravity, bounce, manual AABB collision (2026-06-19)
✅ Mouse (desktop) and touch (mobile) horizontal controls (2026-06-19)
✅ Camera locks upward only — never scrolls back down (2026-06-19)
✅ Infinite platform generation — upward + downward trackers (2026-06-19)
✅ Platform culling on screen exit (2026-06-19)
✅ Portrait orientation 450×800 (2026-06-19)
✅ Player depth above platforms (2026-06-19)
✅ Score tracking by height (2026-06-19)
✅ Game over + restart flow (2026-06-19)
