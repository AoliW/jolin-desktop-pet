const { ipcRenderer } = require('electron');
const canvas = document.getElementById('cat');
const ctx = canvas.getContext('2d');
const bubble = document.getElementById('bubble');

// ── Sprite loader helper ──────────────────────────────────────────────────────
function loadSprites(folder, names) {
  let loaded = 0;
  const imgs = names.map(name => {
    const img = new Image();
    img.src = `assets/sprites/${folder}/${name}`;
    img.onload = () => loaded++;
    return img;
  });
  return { imgs, ready: () => loaded === imgs.length };
}

// ── Walk sprites ──────────────────────────────────────────────────────────────
const walk = loadSprites('walk', [
  'frame_0165.png', 'frame_0168.png', 'frame_0171.png', 'frame_0174.png',
  'frame_0177.png', 'frame_0180.png', 'frame_0183.png', 'frame_0186.png', 'frame_0189.png'
]);

// ── Sleep sprites ─────────────────────────────────────────────────────────────
const sleep = loadSprites('sleep', [
  'frame_0004.png', 'frame_0013.png', 'frame_0022.png', 'frame_0031.png',
  'frame_0040.png', 'frame_0049.png', 'frame_0058.png', 'frame_0067.png',
  'frame_0076.png', 'frame_0085.png', 'frame_0094.png'
]);

// ── Buttom sprites ────────────────────────────────────────────────────────────
const buttom = loadSprites('buttom', [
  'frame_0014.png', 'frame_0023.png', 'frame_0032.png', 'frame_0041.png',
  'frame_0050.png', 'frame_0059.png', 'frame_0068.png', 'frame_0077.png',
  'frame_0095.png', 'frame_0098.png', 'frame_0102.png', 'frame_0105.png',
  'frame_0109.png', 'frame_0117.png', 'frame_0121.png', 'frame_0125.png', 'frame_0129.png',
  'frame_0133.png', 'frame_0159.png', 'frame_0168.png', 'frame_0183.png', 'frame_0195.png',
  'frame_0206.png', 'frame_0214.png', 'frame_0220.png', 'frame_0231.png'
]);

const SIZE_WALK   = 200;  // walk sprite height in px
const SIZE_SLEEP  = 100;  // sleep sprite height in px
const SIZE_BUTTOM = 150;  // buttom sprite height in px
const WALK_Y_OFFSET = 50; // push walk sprite down (increase to move lower)

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
const STATE = { WALK: 'walk', SLEEP: 'sleep', PLAY: 'play' };

let state     = STATE.WALK;
let frame     = 0;
let direction = 1;
let posX      = SW / 2;
let posY      = SH - 50;
let bubbleTimer = 0;

let walkTarget = posX;
const walkSpeed  = 0.25;
let stateTimer = 0;

let isDragging = false;
let dragOffX = 0, dragOffY = 0;
let didDrag  = false;

function startWalk() {
  state      = STATE.WALK;
  if (posX < SW / 2) {
    walkTarget = SW * 0.6 + Math.random() * SW * 0.35;
  } else {
    walkTarget = SW * 0.05 + Math.random() * SW * 0.35;
  }
  direction  = walkTarget > posX ? 1 : -1;
}

function startSleep() {
  state      = STATE.SLEEP;
  stateTimer = 300 + Math.random() * 300;
}

function pickNewState() {
  Math.random() < 0.5 ? startWalk() : startSleep();
}

startWalk();

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

// ── Play state ────────────────────────────────────────────────────────────────
let playFrames = 0;

function triggerPlay() {
  if (state === STATE.PLAY) return;
  state      = STATE.PLAY;
  playFrames = 0;
}

function showBubble(text) {
  bubble.textContent = text;
  bubble.classList.add('show');
  bubbleTimer = 120;
}

// ── Sprite drawing ────────────────────────────────────────────────────────────
function drawSprite(spriteSet, tickDivisor, cx, baseline, flipX, frameOverride, size) {
  if (!spriteSet.ready()) return false;
  const idx = frameOverride !== undefined ? frameOverride : Math.floor(frame / tickDivisor) % spriteSet.imgs.length;
  const img = spriteSet.imgs[Math.min(idx, spriteSet.imgs.length - 1)];
  if (!img.complete || img.naturalWidth === 0) return false;
  const h = size || 150;
  const w = h * (img.naturalWidth / img.naturalHeight);
  ctx.save();
  ctx.translate(cx, baseline);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
  return true;
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

  stateTimer--;
  if (stateTimer <= 0 && state === STATE.SLEEP) pickNewState();

  switch (state) {
    case STATE.WALK:
      if (!isDragging) {
        posX += direction * walkSpeed;
        if (Math.abs(posX - walkTarget) < 2) { posX = walkTarget; startSleep(); }
        if (posX < 20)       { posX = 20;       direction =  1; walkTarget = SW - 20; }
        if (posX > SW - 20)  { posX = SW - 20;  direction = -1; walkTarget = 20; }
      }
      drawSprite(walk, 7, posX, posY + WALK_Y_OFFSET, direction === -1, undefined, SIZE_WALK);
      break;

    case STATE.SLEEP:
      drawSprite(sleep, 12, posX, posY, false, undefined, SIZE_SLEEP);
      break;

    case STATE.PLAY:
      playFrames++;
      if (playFrames === 9 * 5) showBubble('Love you~ 🩷');
      drawSprite(buttom, 15, posX, posY, false, Math.floor(playFrames / 6), SIZE_BUTTOM);
      if (playFrames >= buttom.imgs.length * 5) startWalk();
      break;
  }

  // Keep speech bubble above the cat's head
  bubble.style.left = (posX + 20) + 'px';
  bubble.style.top  = (posY - 180) + 'px';

  requestAnimationFrame(tick);
}

// ── Click-passthrough: only receive mouse events when cursor is over the cat ──
const CAT_HOVER_RADIUS = 55;
let isIgnoring = true;

window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const newX = e.clientX + dragOffX;
    const newY = e.clientY + dragOffY;
    if (Math.abs(newX - posX) > 2 || Math.abs(newY - posY) > 2) didDrag = true;
    posX = Math.max(20, Math.min(SW - 20, newX));
    posY = Math.max(80, Math.min(SH - 10, newY));
    return;
  }
  const dx = e.clientX - posX;
  const dy = e.clientY - (posY - 30);
  const over = Math.sqrt(dx * dx + dy * dy) < CAT_HOVER_RADIUS;
  if (over && isIgnoring) {
    isIgnoring = false;
    ipcRenderer.send('set-ignore-mouse', false);
  } else if (!over && !isIgnoring) {
    isIgnoring = true;
    ipcRenderer.send('set-ignore-mouse', true);
  }
});

// ── Input ─────────────────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const dx = e.clientX - posX;
  const dy = e.clientY - (posY - 60);
  if (Math.sqrt(dx * dx + dy * dy) > CAT_HOVER_RADIUS) return;
  isDragging = true;
  didDrag    = false;
  dragOffX   = posX - e.clientX;
  dragOffY   = posY - e.clientY;
  ipcRenderer.send('set-ignore-mouse', false);
});

window.addEventListener('mouseup', (e) => {
  if (!isDragging || e.button !== 0) return;
  isDragging = false;
  if (didDrag) {
    startWalk();
  } else {
    triggerPlay();
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  showBubble('Bye bye~');
  setTimeout(() => window.close(), 800);
});

tick();
