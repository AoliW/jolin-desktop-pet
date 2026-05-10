const { ipcRenderer } = require('electron');
const canvas = document.getElementById('cat');
const ctx = canvas.getContext('2d');
const bubble = document.getElementById('bubble');

// ── Canvas fills the work area (excludes Dock/taskbar) ───────────────────────
let SW = window.innerWidth;
let SH = window.innerHeight;
canvas.width  = SW;
canvas.height = SH;

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  body:    '#c8956c',  // warm orange-tan (tabby base)
  belly:   '#f0d4b0',  // lighter belly
  stripe:  '#8b5e3c',  // darker stripe
  outline: '#5a3820',  // dark brown outline
  eye:     '#3a2a1a',  // dark iris
  eyeHi:   '#ffffff',  // eye highlight
  nose:    '#e8788a',  // pink nose
  mouth:   '#5a3820',
  ear:     '#e8a0a0',  // inner ear pink
  tail:    '#c8956c',
  shadow:  'rgba(0,0,0,0.12)'
};

// ── State machine ─────────────────────────────────────────────────────────────
const STATE = { IDLE: 'idle', WALK: 'walk', SIT: 'sit', PLAY: 'play', SLEEP: 'sleep' };

let state     = STATE.SIT;
let frame     = 0;       // animation tick (incremented each rAF)
let direction = 1;       // 1 = right, -1 = left
let posX      = SW / 2;  // horizontal position within canvas (cat center)
let posY      = SH - 50; // vertical baseline — near bottom of screen
let bubbleTimer = 0;

// Walk target
let walkTarget = posX;
let walkSpeed  = 1.8;

// ── Messages shown on click ───────────────────────────────────────────────────
const meows = ['Meow~', 'Purrrr...', '*headbutt*', 'Feed me!', 'Pet me!', '(^•ω•^)', 'Mrrrow?'];
let meowIdx = 0;

// ── Idle/walk schedule ────────────────────────────────────────────────────────
let stateTimer = 0;
const STATE_DURATIONS = {
  [STATE.IDLE]:  () => 120 + Math.random() * 180,
  [STATE.WALK]:  () => 180 + Math.random() * 120,
  [STATE.SIT]:   () => 200 + Math.random() * 200,
  [STATE.SLEEP]: () => 300 + Math.random() * 300
};

function scheduleNextState() {
  stateTimer = STATE_DURATIONS[state] ? STATE_DURATIONS[state]() : 180;
}

function pickNewState() {
  if (state === STATE.PLAY) return; // play ends itself
  const roll = Math.random();
  if (roll < 0.35) {
    state = STATE.WALK;
    walkTarget = 60 + Math.random() * (SW - 120);  // anywhere across the screen
    direction  = walkTarget > posX ? 1 : -1;
  } else if (roll < 0.60) {
    state = STATE.SIT;
  } else if (roll < 0.85) {
    state = STATE.IDLE;
  } else {
    state = STATE.SLEEP;
  }
  scheduleNextState();
}

scheduleNextState();

// ── Drawing helpers ───────────────────────────────────────────────────────────

function drawEllipse(cx, cy, rx, ry, color, stroke) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = C.outline; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawRoundRect(x, y, w, h, r, color, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = C.outline; ctx.lineWidth = 1.5; ctx.stroke(); }
}

// Draw a single frame of the cat at (cx, baseline)
// bobY: vertical bob offset, blinkT: 0-1 (1 = fully closed), tailPhase: angle in radians
function drawCat(cx, baseline, { bobY = 0, blinkT = 0, tailPhase = 0, sitting = false, sleeping = false, legPhase = 0 } = {}) {
  ctx.save();
  ctx.translate(cx, baseline);
  if (direction === -1) ctx.scale(-1, 1);  // flip for left-walk

  const by = bobY; // shorthand

  // ── Shadow ──
  drawEllipse(0, 2, 22, 5, C.shadow, false);

  // ── Tail ──
  if (!sleeping) {
    const tx = sitting ? -14 : -18;
    const ty = sitting ? -10 : -5;
    const cp1x = sitting ? -28 : -30;
    const cp1y = sitting ? -30 + Math.sin(tailPhase) * 8 : -20 + Math.sin(tailPhase) * 6;
    const cp2x = sitting ? -10 + Math.cos(tailPhase) * 10 : 0  + Math.cos(tailPhase) * 8;
    const cp2y = sitting ? -50 : -30;
    ctx.beginPath();
    ctx.moveTo(tx, ty + by);
    ctx.bezierCurveTo(cp1x, cp1y + by, cp2x, cp2y + by, 4 + Math.cos(tailPhase)*6, -40 + by);
    ctx.strokeStyle = C.body;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (sleeping) {
    // Curled-up sleeping pose
    drawEllipse(0, -12 + by, 26, 16, C.body, true);
    // Head on top
    drawEllipse(14, -24 + by, 14, 12, C.body, true);
    // Small ear
    ctx.beginPath();
    ctx.moveTo(20, -34 + by); ctx.lineTo(26, -42 + by); ctx.lineTo(30, -34 + by);
    ctx.fillStyle = C.body; ctx.fill(); ctx.strokeStyle = C.outline; ctx.lineWidth = 1.5; ctx.stroke();
    // Inner ear
    ctx.beginPath();
    ctx.moveTo(22, -34 + by); ctx.lineTo(26, -40 + by); ctx.lineTo(29, -34 + by);
    ctx.fillStyle = C.ear; ctx.fill();
    // Closed eyes (sleeping)
    ctx.beginPath();
    ctx.arc(18, -26 + by, 3, Math.PI * 0.1, Math.PI * 0.9);
    ctx.strokeStyle = C.outline; ctx.lineWidth = 1.5; ctx.stroke();
    // Tail curl
    ctx.beginPath();
    ctx.arc(-8, -10 + by, 18, -0.3, Math.PI * 0.9);
    ctx.strokeStyle = C.body; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = C.outline; ctx.lineWidth = 1.5; ctx.stroke();
    // ZZZ
    ctx.fillStyle = 'rgba(100,150,255,0.8)';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('z', 28, -38 + by);
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('z', 34, -44 + by);
    ctx.restore();
    return;
  }

  if (sitting) {
    // ── Sitting body ──
    drawEllipse(0, -12 + by, 18, 22, C.body, true);
    // belly
    drawEllipse(2, -5 + by, 10, 14, C.belly, false);
    // front paws
    drawEllipse(-8, 2 + by, 6, 5, C.body, true);
    drawEllipse(8, 2 + by, 6, 5, C.body, true);
  } else {
    // ── Walking/idle body ──
    drawEllipse(0, -12 + by, 22, 14, C.body, true);
    // belly
    drawEllipse(2, -10 + by, 13, 8, C.belly, false);
    // stripe
    ctx.beginPath(); ctx.moveTo(-6, -22 + by); ctx.lineTo(-4, -4 + by);
    ctx.strokeStyle = C.stripe; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -22 + by); ctx.lineTo(6, -4 + by);
    ctx.stroke();
    // Legs (4 sticks)
    const lp = legPhase;
    const legPairs = [
      [-10, Math.sin(lp)       * 5],
      [ -4, Math.sin(lp + 1)   * 5],
      [  4, Math.sin(lp + Math.PI) * 5],
      [ 10, Math.sin(lp + Math.PI + 1) * 5]
    ];
    legPairs.forEach(([lx, ly]) => {
      ctx.beginPath();
      ctx.moveTo(lx, -4 + by);
      ctx.lineTo(lx + ly * 0.3, 4 + by + Math.abs(ly));
      ctx.strokeStyle = C.outline; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = C.body; ctx.lineWidth = 2.5; ctx.stroke();
    });
  }

  // ── Head ──
  drawEllipse(0, -32 + by, 18, 16, C.body, true);

  // ── Ears ──
  // Left ear
  ctx.beginPath();
  ctx.moveTo(-14, -40 + by); ctx.lineTo(-20, -52 + by); ctx.lineTo(-6, -46 + by);
  ctx.closePath(); ctx.fillStyle = C.body; ctx.fill(); ctx.strokeStyle = C.outline; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-13, -41 + by); ctx.lineTo(-18, -50 + by); ctx.lineTo(-8, -46 + by);
  ctx.closePath(); ctx.fillStyle = C.ear; ctx.fill();
  // Right ear
  ctx.beginPath();
  ctx.moveTo(14, -40 + by); ctx.lineTo(20, -52 + by); ctx.lineTo(6, -46 + by);
  ctx.closePath(); ctx.fillStyle = C.body; ctx.fill(); ctx.strokeStyle = C.outline; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(13, -41 + by); ctx.lineTo(18, -50 + by); ctx.lineTo(8, -46 + by);
  ctx.closePath(); ctx.fillStyle = C.ear; ctx.fill();

  // ── Eyes ──
  const eyeOpenY = 1 - blinkT;  // 1 = open, 0 = closed
  [-7, 7].forEach(ex => {
    // white
    drawEllipse(ex, -33 + by, 5, 5 * eyeOpenY, '#ffffff', true);
    if (eyeOpenY > 0.1) {
      // pupil
      drawEllipse(ex, -33 + by, 2.5, 3 * eyeOpenY, C.eye, false);
      // highlight
      drawEllipse(ex + 1.5, -34 + by, 1, 1 * eyeOpenY, C.eyeHi, false);
    }
  });

  // ── Nose ──
  ctx.beginPath();
  ctx.moveTo(0, -28 + by); ctx.lineTo(-3, -31 + by); ctx.lineTo(3, -31 + by);
  ctx.closePath(); ctx.fillStyle = C.nose; ctx.fill();

  // ── Mouth ──
  ctx.beginPath();
  ctx.moveTo(0, -28 + by);
  ctx.quadraticCurveTo(-5, -24 + by, -4, -22 + by);
  ctx.strokeStyle = C.mouth; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -28 + by);
  ctx.quadraticCurveTo(5, -24 + by, 4, -22 + by);
  ctx.stroke();

  // ── Whiskers ──
  [[-1, -27], [1, -27]].forEach(([sign, wy]) => {
    for (let i = 0; i < 3; i++) {
      const angle = (i - 1) * 0.3;
      const len = 16;
      ctx.beginPath();
      ctx.moveTo(sign * 3, wy + by);
      ctx.lineTo(sign * (3 + len * Math.cos(angle)), wy + by + len * Math.sin(angle) * 0.3);
      ctx.strokeStyle = 'rgba(90,56,32,0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  });

  ctx.restore();
}

// ── Blink scheduler ───────────────────────────────────────────────────────────
let blinkT    = 0;
let blinkDir  = 0;   // 0=idle, 1=closing, -1=opening
let blinkNext = 180 + Math.random() * 200;

function updateBlink() {
  blinkNext--;
  if (blinkNext <= 0 && blinkDir === 0) {
    blinkDir  = 1;
    blinkNext = 180 + Math.random() * 200;
  }
  if (blinkDir === 1) {
    blinkT += 0.25;
    if (blinkT >= 1) { blinkT = 1; blinkDir = -1; }
  } else if (blinkDir === -1) {
    blinkT -= 0.25;
    if (blinkT <= 0) { blinkT = 0; blinkDir = 0; }
  }
}

// ── Play state ────────────────────────────────────────────────────────────────
let playFrames = 0;
const PLAY_DURATION = 90;

function triggerPlay() {
  state       = STATE.PLAY;
  playFrames  = 0;
  showBubble(meows[meowIdx % meows.length]);
  meowIdx++;
}

function showBubble(text) {
  bubble.textContent = text;
  bubble.classList.add('show');
  bubbleTimer = 120;
}

// ── Main loop ─────────────────────────────────────────────────────────────────
function tick() {
  frame++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Bubble timer
  if (bubbleTimer > 0) {
    bubbleTimer--;
    if (bubbleTimer === 0) bubble.classList.remove('show');
  }

  updateBlink();
  stateTimer--;
  if (stateTimer <= 0 && state !== STATE.PLAY) pickNewState();

  let bobY     = 0;
  let tailPh   = frame * 0.04;
  let legPh    = 0;
  let sitting  = false;
  let sleeping = false;

  // Per-state logic
  switch (state) {
    case STATE.IDLE:
      bobY = Math.sin(frame * 0.05) * 1.5;
      break;

    case STATE.WALK:
      posX += direction * walkSpeed;
      legPh = frame * 0.25;
      bobY  = Math.abs(Math.sin(frame * 0.25)) * -2;
      tailPh = frame * 0.08;
      if (Math.abs(posX - walkTarget) < 2) {
        posX  = walkTarget;
        state = STATE.IDLE;
        scheduleNextState();
      }
      // Bounce off screen edges
      if (posX < 60)       { posX = 60;       direction =  1; walkTarget = 60 + Math.random() * (SW - 120); }
      if (posX > SW - 60)  { posX = SW - 60;  direction = -1; walkTarget = 60 + Math.random() * (SW - 120); }
      break;

    case STATE.SIT:
      sitting = true;
      bobY    = Math.sin(frame * 0.03) * 1;
      tailPh  = frame * 0.03;
      break;

    case STATE.SLEEP:
      sleeping = true;
      break;

    case STATE.PLAY: {
      playFrames++;
      // Quick bouncy jump animation
      const t  = playFrames / PLAY_DURATION;
      const pt = Math.sin(t * Math.PI);
      bobY  = -pt * 18;
      legPh = frame * 0.4;
      tailPh = frame * 0.15;
      // Spin direction halfway
      if (playFrames === Math.floor(PLAY_DURATION / 2)) direction *= -1;
      if (playFrames >= PLAY_DURATION) {
        state = STATE.SIT;
        scheduleNextState();
      }
      break;
    }
  }

  drawCat(posX, posY, { bobY, blinkT, tailPhase: tailPh, sitting, sleeping, legPhase: legPh });

  // Keep speech bubble above the cat's head
  bubble.style.left = posX + 'px';
  bubble.style.top  = (posY - 80) + 'px';

  requestAnimationFrame(tick);
}

// ── Click-passthrough: only receive mouse events when cursor is over the cat ──
const CAT_HOVER_RADIUS = 55;
let isIgnoring = true;

window.addEventListener('mousemove', (e) => {
  const dx = e.clientX - posX;
  const dy = e.clientY - (posY - 30); // bias toward the cat's center, not feet
  const over = Math.sqrt(dx * dx + dy * dy) < CAT_HOVER_RADIUS;
  // Only send IPC when state changes, not on every mousemove
  if (over && isIgnoring) {
    isIgnoring = false;
    ipcRenderer.send('set-ignore-mouse', false);
  } else if (!over && !isIgnoring) {
    isIgnoring = true;
    ipcRenderer.send('set-ignore-mouse', true);
  }
});

// ── Input ─────────────────────────────────────────────────────────────────────
canvas.addEventListener('click', () => {
  triggerPlay();
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showBubble('Bye bye~');
  setTimeout(() => window.close(), 800);
});

tick();
