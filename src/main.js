import './style.css';
import Phaser from 'phaser';

const W = 450;
const H = 800;
const PLAT_W = W * 0.25;   // quarter screen width
const PLAT_H = 14;
const PLAT_HIT_HALF = Math.ceil(PLAT_W * 0.65) + 17; // visual half-width (halfW + R) ≈ 90
const DISPLAY_SIZE = 160;                      // visual frame size
const HIT_W = Math.floor(DISPLAY_SIZE / 5);        // 32 — narrow hitbox width
const HIT_H = Math.floor(DISPLAY_SIZE * 0.8);      // 128 — tall hitbox, bottom-aligned to sprite
// Y offset from sprite center to hitbox center (hitbox bottom == sprite bottom)
const HIT_Y = DISPLAY_SIZE / 2 - HIT_H / 2;       // 16
const GRAVITY = 1600;
const BOUNCE_VY = -2100;
const MAX_FALL = 750;   // cap downward speed to prevent tunneling
const MOVE_SPEED = 700;
const GAP_MIN = 240;
const GAP_MAX = 520;
// Camera keeps player at 25% from top so 75% of screen shows what's below
const PLAYER_HOME_Y = Math.floor(H * 0.25);

// Animation
const ANIM_TOTAL  = 25;                              // total frames in sheet
const ANIM_Q      = ANIM_TOTAL / 4;                  // 6.25 — frames per quarter
const APEX_TIME   = Math.abs(BOUNCE_VY) / GRAVITY;   // seconds to reach apex ≈ 1.31
const ANIM_RATE   = ANIM_Q / APEX_TIME;              // frames/s during active motion ≈ 4.76

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  preload() {
    this.load.spritesheet('bot', '/assets/Bot-jump.png', {
      frameWidth: 256,
      frameHeight: 256,
    });

  }

  create() {
    this.state = 'idle';
    this.score = 0;
    this.highestY = 0; // world y=0 is start; going up means negative y

    // Camera: top of screen in world coords.
    // Player is at world y=0 and should appear at PLAYER_HOME_Y on screen.
    this.camTop = -PLAYER_HOME_Y;
    this.cameras.main.scrollY = this.camTop;

    // Animation state — driven manually in tickAnim()
    this.animProgress  = 0;     // float 0–25
    this.bounceCount   = 0;     // increments on each platform hit
    this.animSynced    = false; // false until first platform hit

    // Player — always drawn above platforms
    this.player = this.physics.add.sprite(W / 2, 0, 'bot', 0)
      .setScale(DISPLAY_SIZE / 256)
      .setDepth(5);
    this.pb = this.player.body;

    this.pb.setGravityY(GRAVITY);
    this.pb.allowGravity = false; // suspended until start

    this.targetX = W / 2;
    // Track player bottom from previous frame for tunnel-through prevention
    this.prevBottom = HIT_Y + HIT_H / 2; // = DISPLAY_SIZE / 2 (sprite bottom)

    // Platforms: plain rectangles, no physics needed (manual collision)
    this.plats = [];
    // Downward tracker: initial platforms the player falls onto
    this.nextPlatY = DISPLAY_SIZE / 2 + 100;
    this.spawnBelow(this.camTop + H + H * 0.5);

    // Pre-seed: distribute clouds across visible zone + buffer above
    for (let i = 0; i < 12; i++) {
      const y = Phaser.Math.Between(
        Math.floor(this.camTop - H * 0.8),
        Math.floor(this.camTop + H),
      );
      const vx = this.cloudVx();
      let x;
      if (y < this.camTop) {
        // Above viewport: drift-compensated so it's mid-screen when camera arrives
        const dist = this.player.y - y;
        const T    = dist / 145;
        x = Math.max(-200, Math.round(W * 0.4 - vx * T));
      } else {
        // Within viewport: stagger across screen as if mid-stream at game start
        x = -200 + i * 55; // −200 … 405 — clouds at various stages of crossing
      }
      const { g, circles } = this.spawnCloud(x, y);
      this.plats.push({ g, circles, x, y, vx });
    }

    // Stream clouds from left, covering visible zone PLUS buffer above (jump destination)
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        const y = Phaser.Math.Between(
          Math.floor(this.camTop - H * 0.8),
          Math.floor(this.camTop + H),
        );
        const vx = this.cloudVx();
        let x;
        if (y < this.camTop) {
          // Above viewport: player can't see this yet, so place it at drift-compensated X
          // so it's mid-screen by the time the camera scrolls up to it
          const dist = this.player.y - y;
          const T    = dist / 145;
          x = Math.max(-200, Math.round(W * 0.4 - vx * T));
        } else {
          // Within viewport: must enter from left edge — never pop in on screen
          x = -200;
        }
        const { g, circles } = this.spawnCloud(x, y);
        this.plats.push({ g, circles, x, y, vx });
      },
    });

    // Input — pointermove fires on desktop always, on mobile only while touching
    this.input.on('pointermove', ptr => { this.targetX = ptr.x; });
    this.input.on('pointerdown', ptr => {
      this.targetX = ptr.x;
      if (this.state === 'idle') this.startGame();
    });

    // HUD (scrollFactor 0 = fixed to screen)
    this.scoreText = this.add
      .text(W / 2, 12, '0', {
        fontSize: '28px', fontFamily: 'monospace',
        color: '#ffffff', stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(10);

    this.prompt = this.add
      .text(W / 2, H * 0.60, 'Click / Tap to Start', {
        fontSize: '26px', color: '#ffe082',
        stroke: '#000000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);
  }

  spawnCloud(x, y) {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0xffffff, 1);

    const halfW   = PLAT_W * 0.65;
    const maxH    = 44;
    const R       = 17;
    const colS    = R * 1.45;
    const rowS    = colS * 0.866;
    const circles = [];

    let row = 0;
    for (let cy = R * 0.3; cy >= -(maxH + R); cy -= rowS) {
      const xShift = (row % 2) * colS * 0.5;
      for (let cx = -halfW - R + xShift; cx <= halfW + R; cx += colS) {
        const t = Math.max(0, 1 - Math.pow(Math.abs(cx / halfW), 1.8));
        if (cy < -(t * maxH + R * 0.3)) continue;
        const jx = Phaser.Math.FloatBetween(-2, 2);
        const jy = Phaser.Math.FloatBetween(-2, 2);
        const r  = R + Phaser.Math.FloatBetween(-2, 3);
        g.fillCircle(cx + jx, cy + jy, r);
        circles.push({ cx: cx + jx, cy: cy + jy, r });
      }
      row++;
    }

    g.setPosition(x, y);
    return { g, circles };
  }

  // Cloud speed scales with score; always left→right (wind direction)
  cloudVx() {
    const base  = 30;
    const boost = Math.min((this.score || 0) * 1.8, 90);
    return Math.floor(base + boost + Phaser.Math.Between(-8, 8));
  }

  randomPlatX() {
    return Phaser.Math.Between(Math.ceil(PLAT_W / 2), Math.floor(W - PLAT_W / 2));
  }

  spawnBelow(worldYMax) {
    while (this.nextPlatY < worldYMax) {
      const x = this.randomPlatX();
      const { g, circles } = this.spawnCloud(x, this.nextPlatY);
      this.plats.push({ g, circles, x, y: this.nextPlatY, vx: this.cloudVx() });
      this.nextPlatY += Phaser.Math.Between(GAP_MIN, GAP_MAX);
    }
  }

  poofCloud(p, impactX) {
    p.g.destroy();
    const relX = impactX - p.x;
    for (const { cx, cy, r } of p.circles) {
      const mini = this.add.graphics().setDepth(3);
      mini.fillStyle(0xffffff, 1);
      mini.fillCircle(0, 0, r);
      mini.setPosition(p.x + cx, p.y + cy);
      // Scatter away from impact point; +35 downward bias so pieces fall outward
      const angle = Math.atan2(cy + 35, cx - relX) + Phaser.Math.FloatBetween(-0.3, 0.3);
      const dist  = Phaser.Math.FloatBetween(70, 200);
      this.tweens.add({
        targets: mini,
        x: mini.x + Math.cos(angle) * dist,
        y: mini.y + Math.sin(angle) * dist,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: Phaser.Math.Between(250, 400),
        ease: 'Cubic.Out',
        onComplete: () => mini.destroy(),
      });
    }
  }

  startGame() {
    this.state = 'playing';
    this.pb.allowGravity = true;
    this.prompt.setVisible(false);
  }

  // Snap animation to the correct quarter on each platform hit
  onBounce() {
    this.bounceCount++;
    this.animSynced   = true;
    this.animProgress = this.bounceCount % 2 === 1 ? 0 : ANIM_Q * 2;
  }

  // Manual animation scrubber — replaces Phaser's built-in anim system
  tickAnim(delta) {
    const dt = delta / 1000;

    if (this.state !== 'playing' || !this.animSynced) {
      // Free play at 12 fps before first bounce and during idle
      this.animProgress = (this.animProgress + 12 * dt) % ANIM_TOTAL;
    } else {
      const vy        = this.pb.velocity.y;
      const ascending = vy < -50;
      const descending = vy > 50;
      const firstHalf = this.bounceCount % 2 === 1;

      if (ascending) {
        // Advance toward Q1 (frame 6.25) or Q3 (frame 18.75), stop at apex
        const apexFrame = firstHalf ? ANIM_Q : ANIM_Q * 3;
        if (this.animProgress < apexFrame)
          this.animProgress = Math.min(apexFrame, this.animProgress + ANIM_RATE * dt);
      } else if (descending) {
        // Advance toward Q2 (12.5) or end of cycle (25), stop at target
        const stopFrame = firstHalf ? ANIM_Q * 2 : ANIM_TOTAL;
        if (this.animProgress < stopFrame)
          this.animProgress = Math.min(stopFrame, this.animProgress + ANIM_RATE * dt);
      }
      // At apex (|vy| <= 50): hold current frame
    }

    this.player.setFrame(Math.floor(this.animProgress) % ANIM_TOTAL);
  }

  update(time, delta) {
    this.tickAnim(delta);

    // Camera follows player upward only — never scrolls back down
    const desired = this.player.y - PLAYER_HOME_Y;
    if (desired < this.camTop) {
      this.camTop = desired;
      this.cameras.main.scrollY = this.camTop;
    }

    // Drift clouds left → right in all game states
    const dt = delta / 1000;
    for (const p of this.plats) {
      if (p.poofing) continue;
      p.x += p.vx * dt;
      p.g.setPosition(p.x, p.y);
    }

    const camBot = this.camTop + H;

    // Cull when off-screen in any direction
    this.plats = this.plats.filter(p => {
      if (p.poofing) return false;
      if (p.x + 95 < 0)          { p.g.destroy(); return false; } // exited left
      if (p.x - 95 > W)          { p.g.destroy(); return false; } // exited right
      if (p.y - 65 > camBot)     { p.g.destroy(); return false; } // scrolled off bottom
      if (p.y < this.camTop - H * 2) { p.g.destroy(); return false; } // too far above
      return true;
    });

    if (this.state !== 'playing') return;

    // Horizontal: chase targetX with clamped speed
    // Clamp targetX to valid range before computing velocity so they never fight at walls
    const minX = HIT_W / 2;
    const maxX = W - HIT_W / 2;
    const clampedTarget = Phaser.Math.Clamp(this.targetX, minX, maxX);
    this.pb.setVelocityX(Phaser.Math.Clamp((clampedTarget - this.player.x) * 10, -MOVE_SPEED, MOVE_SPEED));
    // Hard position clamp — only kill velocity in the wall-ward direction
    if (this.player.x < minX) {
      this.player.x = minX;
      if (this.pb.velocity.x < 0) this.pb.setVelocityX(0);
    }
    if (this.player.x > maxX) {
      this.player.x = maxX;
      if (this.pb.velocity.x > 0) this.pb.setVelocityX(0);
    }

    // Cap fall speed only — bounce upward is uncapped
    if (this.pb.velocity.y > MAX_FALL) this.pb.setVelocityY(MAX_FALL);

    // Platform collision: manual AABB using the narrow centered hit box
    if (this.pb.velocity.y > 0) {
      const pL   = this.player.x - HIT_W / 2;
      const pR   = this.player.x + HIT_W / 2;
      const pBot = this.player.y + HIT_Y + HIT_H / 2; // bottom of hitbox = bottom of sprite

      for (const p of this.plats) {
        if (p.poofing) continue;
        const platTop = p.y - PLAT_H / 2;
        if (
          pBot            >= platTop &&
          this.prevBottom <= platTop + 2 &&
          pR > p.x - PLAT_HIT_HALF &&
          pL < p.x + PLAT_HIT_HALF
        ) {
          this.player.y = platTop - HIT_Y - HIT_H / 2; // snap so sprite bottom = platform top
          this.onBounce();
          this.pb.setVelocityY(BOUNCE_VY);
          p.poofing = true;
          this.poofCloud(p, this.player.x);
          break;
        }
      }
    }
    this.prevBottom = this.player.y + HIT_Y + HIT_H / 2;

    // Keep platforms filled below camera for the initial fall
    this.spawnBelow(camBot + H * 0.5);

    // Safety: if the screen is nearly empty, inject clouds from the left
    const onScreen = this.plats.filter(
      p => !p.poofing && p.x + PLAT_HIT_HALF > 0 && p.x - PLAT_HIT_HALF < W
    ).length;
    if (onScreen < 2) {
      const y = Phaser.Math.Between(Math.floor(this.camTop + 80), Math.floor(camBot - 80));
      const { g, circles } = this.spawnCloud(-200, y);
      this.plats.push({ g, circles, x: -200, y, vx: this.cloudVx() });
    }

    // Score = highest world Y reached (negative = up)
    if (this.player.y < this.highestY) {
      this.highestY = this.player.y;
      this.score = Math.floor(-this.highestY / 55);
      this.scoreText.setText(this.score);
    }

    // Game over: fell below visible screen
    if (this.player.y > camBot + DISPLAY_SIZE / 2) this.doGameOver();
  }

  doGameOver() {
    this.state = 'dead';
    this.pb.allowGravity = false;
    this.pb.setVelocity(0, 0);

    this.add.text(W / 2, H * 0.37, 'GAME OVER', {
      fontSize: '50px', fontFamily: 'monospace',
      color: '#ff5252', stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

    this.add.text(W / 2, H * 0.56, 'Score: ' + this.score, {
      fontSize: '30px', color: '#ffe082', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

    this.time.delayedCall(1500, () => {
      this.add.text(W / 2, H * 0.72, 'Tap to Play Again', {
        fontSize: '22px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(20);
      this.input.once('pointerdown', () => this.scene.restart());
    });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  backgroundColor: '#87ceeb',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: GameScene,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
