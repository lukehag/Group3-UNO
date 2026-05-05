// ================================================================
// UNO UI — p5.js sketch
// ================================================================
// Use this file alongside an index.html that loads p5.js and sets
// up the status bar. Your index.html should look like this:
//
//   <!DOCTYPE html>
//   <html lang="en">
//   <head>
//     <meta charset="UTF-8" />
//     <title>UNO</title>
//     <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
//     <style>
//       * { margin:0; padding:0; box-sizing:border-box; }
//       body { background:#0a1f1a; display:flex; flex-direction:column;
//              align-items:center; justify-content:center; min-height:100vh;
//              font-family:'Segoe UI',sans-serif; }
//       canvas { display:block; border-radius:18px; box-shadow:0 8px 48px rgba(0,0,0,0.6); }
//       #status-bar { width:1200px; max-width:98vw; display:flex; align-items:center;
//                     justify-content:space-between; padding:8px 16px; margin-bottom:10px;
//                     background:#0e2e26; border-radius:10px; color:#aaa; font-size:13px; }
//       #conn-dot { width:10px; height:10px; border-radius:50%; background:#555;
//                   display:inline-block; margin-right:8px; transition:background 0.3s; }
//       #conn-dot.connected    { background:#4caf50; box-shadow:0 0 6px #4caf50; }
//       #conn-dot.disconnected { background:#f44336; box-shadow:0 0 6px #f44336; }
//       #conn-dot.waiting      { background:#ff9800; box-shadow:0 0 6px #ff9800; }
//       #server-url-form { display:flex; gap:8px; align-items:center; }
//       #server-url-form input { background:#1a3d33; border:1px solid #2e6050; color:#fff;
//                                padding:4px 10px; border-radius:6px; font-size:12px; width:220px; }
//       #server-url-form button { background:#1e6b50; color:#fff; border:none;
//                                 padding:4px 12px; border-radius:6px; cursor:pointer; font-size:12px; }
//       #server-url-form button:hover { background:#27886a; }
//     </style>
//   </head>
//   <body>
//     <div id="status-bar">
//       <div>
//         <span id="conn-dot" class="waiting"></span>
//         <span id="conn-label">Connecting to UNO server...</span>
//       </div>
//       <form id="server-url-form" onsubmit="return false;">
//         <label style="color:#888">Server:</label>
//         <input id="api-input" type="text" value="http://localhost:8080" />
//         <button onclick="reconnect()">Connect</button>
//       </form>
//     </div>
//     <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.3/p5.min.js"></script>
//     <script src="uno_ui_p5_sketch.js"></script>
//   </body>
//   </html>
// ================================================================

const getAPI = () => {
  const el = document.getElementById('api-input');
  return el ? el.value.replace(/\/$/, '') : 'http://localhost:8080';
};

function setStatus(st, msg) {
  const dot   = document.getElementById('conn-dot');
  const label = document.getElementById('conn-label');
  if (dot)   dot.className = st;
  if (label) label.textContent = msg;
}

function reconnect() { newGame(); }

// ── Game state ───────────────────────────────────────────────────
let state           = null;
let errorMsg        = '';
let loadingMsg      = '';
let colorPickerOpen = false;
let hoveredCardIdx  = -1;
let unoFlash        = 0;
let unoWho          = null; // 'player' or 'opponent'
let particles       = [];
let winner          = null;  // 'player' | 'opponent' | null
let winnerAnim      = 0;
let opponentPeek    = null;  // card opponent is about to play
let peekTimer       = 0;
let skipAnim        = 0;     // counts up while skip screen is showing
let skipTriggered   = false; // prevents endTurn firing multiple times
let turnTimer       = 120;   // seconds remaining on player's turn
let turnTimerActive = false; // only ticks during player's turn
let timerFired      = false; // prevents timerExpired firing multiple times
let oppSkipAnim     = 0;     // counts up when opponent's turn is skipped
let prevOppSkipped  = false; // tracks previous skip state to detect transition
let oppDrawAnim     = 0;     // counts up when opponent draws a card

// ── Card colors matching Java Card.Color enum ────────────────────
const CARD_COLORS = {
  RED:    [220, 55,  55],
  BLUE:   [55,  110, 240],
  GREEN:  [55,  180, 90],
  YELLOW: [245, 200, 50],
  BLACK:  [30,  30,  40],
};
const COLOR_PICKER_OPTIONS = ['RED', 'BLUE', 'GREEN', 'YELLOW'];

// ── p5.js lifecycle ──────────────────────────────────────────────
function setup() {
  let cnv = createCanvas(1200, 700);
  cnv.parent('game-wrapper');
  cnv.style('max-width', '98vw');
  textFont('Georgia');
  rectMode(CENTER);
  newGame();
}

function windowResized() {
  // Keep canvas proportional — max 1200x700, scale down if window is smaller
  let w = min(windowWidth - 40, 1200);
  let h = w * (700 / 1200);
  resizeCanvas(w, h);
}

function draw() {
  if (!state) { drawLoading(); return; }
  drawBackground();
  updateParticles();

  // Only draw game elements if game is still going
  if (!winner) {
    drawTopBar();
    drawOpponent();
    drawCenterArea();
    drawPlayerHand();
    drawUnoButton();
    if (colorPickerOpen) drawColorPicker();
    if (errorMsg)        drawError();
    if (loadingMsg)      drawLoadingOverlay();
    if (unoFlash > 0)    drawUnoFlash();
    if (opponentPeek)    drawOpponentPeek();
    if (skipAnim > 0)    drawSkipAnimation();
    if (oppSkipAnim > 0) drawOpponentSkipAnimation();
    if (oppDrawAnim > 0) drawOpponentDrawAnimation();

    // Timer
    let isActiveTurn = state.status === 'YOUR_TURN' || state.status === 'HAS_DRAWN';
    if (isActiveTurn && !colorPickerOpen) drawTurnTimer();
    if (isActiveTurn && !colorPickerOpen && !timerFired) {
      turnTimerActive = true;
      if (frameCount % 60 === 0 && turnTimer > 0) {
        turnTimer--;
        if (turnTimer <= 0) {
          turnTimer = 0;
          turnTimerActive = false;
          timerFired = true;
          timerExpired();
        }
      }
    } else if (!isActiveTurn) {
      turnTimer = 60; turnTimerActive = false; timerFired = false;
    }

    // Skip animation trigger
    if (state.status === 'SKIPPED' && !skipTriggered) {
      skipTriggered = true;
      skipAnim = 1;
      setTimeout(() => {
        skipAnim = 0;
        endTurnAfterSkip();
        // Note: skipTriggered stays true until state is no longer SKIPPED
        // It gets reset in newGame() or when state.status changes
      }, 2500);
    }

    // Reset skipTriggered once state is no longer SKIPPED
    if (state.status !== 'SKIPPED' && skipTriggered && skipAnim === 0) {
      skipTriggered = false;
    }
  }

  // Win screen drawn absolutely last — always on top of everything
  if (winner) drawWinScreen();
}

// ── API calls ────────────────────────────────────────────────────
function newGame() {
  setStatus('waiting', 'Starting new game…');
  winner = null; winnerAnim = 0;
  errorMsg = ''; loadingMsg = '';
  colorPickerOpen = false;
  skipAnim = 0; skipTriggered = false;
  turnTimer = 60; turnTimerActive = false; timerFired = false;
  oppSkipAnim = 0; prevOppSkipped = false;
  oppDrawAnim = 0;
  unoWho = null;
  apiPost('/new-game', {}, s => {
    state = s;
    setStatus('connected', 'Connected · Game running');
    spawnParticles(20);
  }, () => setStatus('disconnected', 'Cannot reach server — is java UnoServer running?'));
}

function playCard(idx) {
  if (!state || (state.status !== 'YOUR_TURN' && state.status !== 'HAS_DRAWN')) return;
  apiPost('/play-card', { cardIndex: idx }, s => {
    state = s; errorMsg = '';
    if (!s.ongoing) { detectWinner(s); return; }
    spawnParticles(8);
    if (s.status === 'AWAITING_COLOR') { colorPickerOpen = true; return; }
    peekThenCommit(s);
    checkUno(s);
  }, e => { errorMsg = e; });
}

function drawACard() {
  if (!state || state.status !== 'YOUR_TURN') return;
  apiPost('/draw-card', {}, s => {
    state = s; errorMsg = '';
    if (!s.ongoing) { detectWinner(s); return; }
    // If no playable cards after drawing, auto-advance to opponent
    if (s.status !== 'HAS_DRAWN') {
      peekThenCommit(s);
    }
    // If HAS_DRAWN, player can choose to play the drawn card or click Skip Turn
    // Check if drawn card is actually playable — if not, auto end turn
    if (s.status === 'HAS_DRAWN') {
      let hasPlayable = s.playerCards && s.playerCards.some(c => c.playable);
      if (!hasPlayable) {
        endTurn();
      }
    }
  });
}

function endTurn() {
  if (!state) return;
  if (state.status !== 'HAS_DRAWN' && state.status !== 'SKIPPED') return;
  turnTimer = 60; turnTimerActive = false; timerFired = false;
  loadingMsg = 'Opponent thinking…';
  apiPost('/end-turn', {}, s => {
    state = s; loadingMsg = '';
    if (!s.ongoing) { detectWinner(s); return; }
    // Fetch fresh state so stale opponentDrew/Skipped flags don't block the peek flow
    fetch(getAPI() + '/state').then(r => r.json()).then(fresh => {
      state = fresh;
      if (!fresh.ongoing) { detectWinner(fresh); return; }
      peekThenCommit(fresh);
      checkUno(fresh);
    });
  });
}

// Called specifically after the player's skip animation finishes —
// delays peekThenCommit so opponent notifications don't overlap with the skip screen
function endTurnAfterSkip() {
  if (!state) return;
  turnTimer = 60; turnTimerActive = false; timerFired = false;
  loadingMsg = 'Opponent thinking…';
  apiPost('/end-turn', {}, s => {
    state = s; loadingMsg = '';
    if (!s.ongoing) { detectWinner(s); return; }
    // Fetch fresh state after delay so stale opponentDrew/Skipped flags
    // from previous turns don't interfere with the peek flow
    setTimeout(() => {
      fetch(getAPI() + '/state').then(r => r.json()).then(fresh => {
        state = fresh;
        if (!fresh.ongoing) { detectWinner(fresh); return; }
        peekThenCommit(fresh);
        checkUno(fresh);
      });
    }, 1000);
  });
}

// Called when the 2-minute turn timer expires
function timerExpired() {
  if (!state) return;
  turnTimer = 60;
  loadingMsg = "Time's up!";

  function afterExpiry() {
    fetch(getAPI() + '/state').then(r => r.json()).then(fresh => {
      state = fresh; loadingMsg = '';
      if (!fresh.ongoing) { detectWinner(fresh); return; }
      peekThenCommit(fresh);
      checkUno(fresh);
    });
  }

  // Always force-end regardless of current status
  // Use fetch directly so we can handle both success and error the same way
  fetch(getAPI() + '/force-end-turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  })
  .then(() => afterExpiry())  // success or error — always fetch fresh state
  .catch(() => afterExpiry());
}

function chooseColor(colorName) {
  colorPickerOpen = false;
  loadingMsg = 'Applying wild card…';
  apiPost('/choose-color', { color: colorName }, s => {
    state = s; loadingMsg = '';
    if (!s.ongoing) { detectWinner(s); return; }
    // Wild ends the player's turn — opponent goes next
    peekThenCommit(s);
    checkUno(s);
  });
}

// Show the opponent's card for 1.5s then commit the move
function peekThenCommit(s) {
  if (!s.ongoing) return;

  console.log('[PEEK] called — isPlayerTurn:', s.isPlayerTurn, 'opponentDrew:', s.opponentDrew, 'opponentWasSkipped:', s.opponentWasSkipped, 'status:', s.status);

  // ── Case 1: Server flagged opponent drew ─────────────────────
  if (s.opponentDrew) {
    console.log('[PEEK] → opponent drew, showing notification');
    oppDrawAnim = 1;
    fetch(getAPI() + '/clear-drew', { method: 'POST' });
    setTimeout(() => {
      oppDrawAnim = 0;
      fetch(getAPI() + '/state').then(r => r.json()).then(ns => {
        state = ns;
        if (!ns.ongoing) { detectWinner(ns); return; }
        checkUno(ns);
      });
    }, 2500);
    return;
  }

  // ── Case 2: Server flagged opponent was skipped ───────────────
  if (s.opponentWasSkipped) {
    console.log('[PEEK] → opponent was skipped, showing notification');
    oppSkipAnim = 1;
    fetch(getAPI() + '/clear-skip', { method: 'POST' });
    setTimeout(() => {
      oppSkipAnim = 0;
      fetch(getAPI() + '/state').then(r => r.json()).then(ns => {
        state = ns;
        if (!ns.ongoing) { detectWinner(ns); return; }
        checkUno(ns);
      });
    }, 2500);
    return;
  }

  // ── Case 3: It's the player's turn — nothing to do ───────────
  if (s.isPlayerTurn) {
    console.log('[PEEK] → isPlayerTurn=true, returning early');
    return;
  }

  console.log('[PEEK] → calling /peek-opponent');
  fetch(getAPI() + '/peek-opponent')
    .then(r => r.json())
    .then(peek => {
      console.log('[PEEK] /peek-opponent response:', JSON.stringify(peek));
      if (!peek.pending) {
        fetch(getAPI() + '/state').then(r => r.json()).then(ns => {
          state = ns;
          if (!ns.ongoing) { detectWinner(ns); return; }
          checkUno(ns);
        });
        return;
      }
      opponentPeek = peek.card;
      peekTimer = 90;
      setTimeout(() => {
        opponentPeek = null;
        peekTimer = 0;
        apiPost('/commit-opponent', {}, ns => {
          console.log('[PEEK] /commit-opponent response — isPlayerTurn:', ns.isPlayerTurn, 'ongoing:', ns.ongoing);
          if (!ns.ongoing) {
            setTimeout(() => { state = ns; detectWinner(ns); }, 800);
            return;
          }
          state = ns;
          if (!ns.isPlayerTurn) {
            setTimeout(() => {
              fetch(getAPI() + '/state').then(r => r.json()).then(fresh => {
                state = fresh;
                if (!fresh.ongoing) { detectWinner(fresh); return; }
                if (!fresh.isPlayerTurn) peekThenCommit(fresh);
                else checkUno(fresh);
              });
            }, 800);
            return;
          }
          if (ns.opponentDrew || ns.opponentWasSkipped) {
            peekThenCommit(ns);
          }
          checkUno(ns);
        });
      }, 1500);
    });
}

function checkUno(s) {
  if (s.playerHasUno && unoWho !== 'player') {
    unoFlash = 120; unoWho = 'player'; spawnParticles(30);
  } else if (s.opponentHasUno && unoWho !== 'opponent') {
    unoFlash = 120; unoWho = 'opponent'; spawnParticles(15);
  } else if (!s.playerHasUno && !s.opponentHasUno) {
    unoWho = null; // reset when neither has uno
  }
}

function detectWinner(s) {
  winner = (s.opponentHandSize === 0) ? 'opponent' : 'player';
  winnerAnim = 0;
  console.log('detectWinner called — winner:', winner, 'playerHandSize:', s.playerHandSize, 'opponentHandSize:', s.opponentHandSize);
  spawnParticles(winner === 'player' ? 80 : 20);
}

function apiPost(path, body, onSuccess, onError) {
  fetch(getAPI() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  .then(r => r.json())
  .then(data => {
    if (data.error) { if (onError) onError(data.error); else errorMsg = data.error; }
    else onSuccess(data);
  })
  .catch(() => {
    let msg = 'Cannot reach server — make sure java UnoServer is running on port 8080';
    if (onError) onError(msg);
    else { errorMsg = msg; setStatus('disconnected', msg); }
  });
}

// ── Mouse ────────────────────────────────────────────────────────
function mousePressed() {
  if (!state) return;
  if (winner) {
    if (dist(mouseX, mouseY, width/2, height/2 + 148) < 80) newGame();
    return;
  }
  if (colorPickerOpen) { handleColorPickerClick(); return; }
  if (!state.ongoing) {
    if (dist(mouseX, mouseY, width/2, height/2 + 70) < 75) newGame();
    return;
  }

  // Skip Turn button below timer — only when player has drawn
  if (state.status === 'HAS_DRAWN') {
    let cx = width/2 - 270, btnY = height/2 + 88;
    if (dist(mouseX, mouseY, cx, btnY) < 52) { endTurn(); return; }
  }

  let cy = height/2 + 10;
  if (dist(mouseX, mouseY, width/2 - 120, cy) < 60) {
    if (state.status === 'YOUR_TURN') drawACard();
    // Do nothing if HAS_DRAWN — player already drew this turn
    return;
  }
  if (state.status === 'YOUR_TURN' || state.status === 'HAS_DRAWN') {
    let cards = state.playerCards;
    if (!cards) return;
    let spacing = cards.length <= 10 ? 88 : min(88, floor(1020 / cards.length));
    let cardW   = cards.length <= 10 ? 72 : max(36, floor(72 * min(1.0, spacing / 88)));
    let totalW  = (cards.length - 1) * spacing + cardW;
    let startX  = width/2 - totalW/2;
    let y = height - 100;
    for (let i = 0; i < cards.length; i++) {
      let x = startX + i * spacing + cardW/2;
      if (dist(mouseX, mouseY, x, y) < cardW/2 + 8 && cards[i].playable) {
        playCard(cards[i].index); return;
      }
    }
  }
}

function mouseMoved() {
  if (!state || !state.playerCards) { hoveredCardIdx = -1; return; }
  let cards = state.playerCards;
  let spacing = cards.length <= 10 ? 88 : min(88, floor(1020 / cards.length));
  let cardW   = cards.length <= 10 ? 72 : max(36, floor(72 * min(1.0, spacing / 88)));
  let totalW  = (cards.length - 1) * spacing + cardW;
  let startX  = width/2 - totalW/2;
  let y = height - 100;
  hoveredCardIdx = -1;
  for (let i = 0; i < cards.length; i++) {
    let x = startX + i * spacing + cardW/2;
    if (dist(mouseX, mouseY, x, y) < cardW/2 + 8) { hoveredCardIdx = i; break; }
  }
}

function handleColorPickerClick() {
  let px = width/2, py = height/2;
  let positions = [
    { name: 'RED',    ox: -120, oy: -38 },
    { name: 'BLUE',   ox:  120, oy: -38 },
    { name: 'GREEN',  ox: -120, oy:  88 },
    { name: 'YELLOW', ox:  120, oy:  88 },
  ];
  for (let i = 0; i < positions.length; i++) {
    let cx = px + positions[i].ox;
    let cy = py + positions[i].oy;
    if (dist(mouseX, mouseY, cx, cy) < 72) {
      chooseColor(positions[i].name); return;
    }
  }
}

// ── Particles ────────────────────────────────────────────────────
function spawnParticles(n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x: random(200, width-200), y: random(200, height-200),
      vx: random(-3,3), vy: random(-4,-1),
      life: 255, size: random(6,14),
      col: random([[220,55,55],[55,110,240],[55,180,90],[245,200,50],[255,255,255]])
    });
  }
}

function updateParticles() {
  noStroke();
  for (let i = particles.length-1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 4;
    fill(p.col[0], p.col[1], p.col[2], p.life);
    ellipse(p.x, p.y, p.size * (p.life/255));
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ── Drawing ──────────────────────────────────────────────────────
function drawLoading() {
  background(14, 50, 40);
  fill(255); textAlign(CENTER,CENTER); textSize(22);
  text('Connecting to UNO server…', width/2, height/2);
  fill(180); textSize(14);
  text('Make sure UnoServer is running: java UnoServer', width/2, height/2+36);
}

function drawBackground() {
  background(16, 88, 70);
  noStroke(); fill(12, 68, 54);
  rect(width/2, height/2, 1130, 618, 36);
  stroke(255, 8); strokeWeight(1);
  for (let x = 0; x < width; x += 40) line(x, 75, x, height-30);
  for (let y = 75; y < height-30; y += 40) line(60, y, width-60, y);
  noStroke();
}

function drawTopBar() {
  let top = state.topCard;
  let col = top ? (CARD_COLORS[top.color] || [80,160,120]) : [40,130,100];
  noStroke();
  fill(col[0]*0.6, col[1]*0.6, col[2]*0.6);
  rect(width/2, 44, 1110, 62, 16);
  fill(col[0], col[1], col[2], 200);
  rect(width/2, 44, 1110, 58, 14);
  fill(255); textAlign(CENTER,CENTER); textSize(17); textStyle(BOLD);
  let colorName = top ? top.color : '—';
  let turnTxt = state.isPlayerTurn ? '  ·  ✦ Your Turn' : '  ·  Opponent\'s Turn';
  text('⬤  ' + colorName + '    ↻ Clockwise' + turnTxt, width/2, 44);
  textStyle(NORMAL);
}

function drawOpponent() {
  let y = 148;
  let count = state.opponentHandSize || 0;

  // Avatar circle with drawn robot face
  fill(255, 230); noStroke(); ellipse(width/2, y-32, 52);
  drawRobotFace(width/2, y-32, 38);

  fill(255); textSize(15); textAlign(CENTER,CENTER);
  text('Opponent', width/2, y+2);
  stroke(255,90); line(width/2-100, y+14, width/2+100, y+14); noStroke();

  let spacing = min(28, 520/max(count,1));
  let sx = width/2 - ((count-1)*spacing)/2;
  for (let i = 0; i < count; i++) drawCardBack(sx + i*spacing, y+50, 34, 50);

  if (state.opponentHasUno) {
    // Red UNO badge replaces the card count
    let pulse = 0.5 + 0.5 * sin(frameCount * 0.12);
    let bw = 70 + pulse * 6;

    // Glow
    fill(220, 50, 50, 60 + pulse * 40); noStroke();
    ellipse(width/2, y+92, bw + 20, 36);

    // Badge
    fill(210, 35, 35); noStroke();
    rect(width/2, y+92, bw, 28, 14);

    // Text
    fill(255); textSize(14); textStyle(BOLD);
    text('UNO', width/2, y+92);
    textStyle(NORMAL);
  } else {
    fill(255); textSize(13);
    text(count + ' card' + (count!==1?'s':''), width/2, y+92);
  }
}

// Drawn robot face using p5.js shapes
function drawRobotFace(x, y, size) {
  push(); translate(x, y);
  let s = size / 38; // scale factor

  // Head rectangle
  fill(180, 195, 210); noStroke();
  rect(0, 0, 28*s, 24*s, 5*s);

  // Eyes
  fill(40, 120, 220);
  ellipse(-8*s, -3*s, 9*s, 7*s);
  ellipse(8*s, -3*s, 9*s, 7*s);

  // Eye shine
  fill(255);
  ellipse(-6*s, -4*s, 3*s, 3*s);
  ellipse(10*s, -4*s, 3*s, 3*s);

  // Mouth — small rectangles like a grid
  fill(60, 80, 100);
  rect(0, 7*s, 18*s, 5*s, 2*s);
  fill(140, 200, 255, 180);
  for (let i = -2; i <= 2; i++) {
    rect(i * 4*s, 7*s, 2*s, 4*s, 1);
  }

  // Antenna
  fill(180, 195, 210);
  rect(0, -14*s, 3*s, 8*s, 2);
  fill(220, 80, 80);
  ellipse(0, -18*s, 6*s, 6*s);

  pop();
}

function drawCenterArea() {
  let cx = width/2, cy = height/2 + 10;
  drawCardStack(cx-120, cy);
  fill(255); textAlign(CENTER,CENTER); textSize(12);
  if      (state.status === 'YOUR_TURN') text('DRAW\n▶ click', cx-120, cy+82);
  else if (state.status === 'HAS_DRAWN') { fill(255, 80); text('DRAW\n(used)', cx-120, cy+82); }
  else                                   text('DRAW PILE',     cx-120, cy+82);
  let top = state.topCard;
  if (top) {
    let col = CARD_COLORS[top.color] || [80,80,80];
    fill(0,0,0,60); noStroke(); rect(cx+124, cy+6, 94, 136, 14);
    drawUnoCard(cx+120, cy, 90, 130, col, top.label);
  }
  fill(255); textSize(12); text('DISCARD', cx+120, cy+82);
}

function drawUnoButton() {
  if (!state.playerHasUno) return; // only show for player
  if (unoFlash > 0) return;
  fill(color(255, 70, 70));
  noStroke(); rect(width/2, height/2+150, 128, 46, 23);
  fill(255); textAlign(CENTER,CENTER); textSize(21); textStyle(BOLD);
  text('UNO!', width/2, height/2+150);
  textStyle(NORMAL);
}

function drawTurnTimer() {
  // Position closer to center — just left of the draw pile
  let cx = width/2 - 270, cy = height/2;
  let pct = turnTimer / 60;

  // Always red, pulses faster when low
  let pulse = (pct < 0.2) ? 0.5 + 0.5 * sin(frameCount * 0.25) : 1.0;
  let timerRed = color(220, 55, 55);

  // Background track
  noFill(); stroke(255, 30); strokeWeight(6);
  ellipse(cx, cy, 90, 90);

  // Red arc
  stroke(timerRed); strokeWeight(6);
  arc(cx, cy, 90, 90, -HALF_PI, -HALF_PI + TWO_PI * pct);
  noStroke();

  // Dark center
  fill(0, 0, 0, 160); ellipse(cx, cy, 76, 76);

  // Number
  fill(220, 55, 55, 255 * pulse);
  textAlign(CENTER, CENTER);
  textSize(pct < 0.2 ? 24 : 20); textStyle(BOLD);
  text(turnTimer, cx, cy);
  textStyle(NORMAL);

  // Label
  fill(255, 140); textSize(10);
  text('seconds', cx, cy + 52);

  // ── Skip Turn button — only when player has drawn ────────────
  if (state.status === 'HAS_DRAWN') {
    let btnY = cy + 88;
    let hov = dist(mouseX, mouseY, cx, btnY) < 52;
    fill(hov ? color(200, 45, 45) : color(150, 30, 30));
    noStroke(); rect(cx, btnY, hov ? 106 : 100, hov ? 36 : 32, 16);
    fill(255); textAlign(CENTER, CENTER); textSize(13); textStyle(BOLD);
    text('Skip Turn', cx, btnY);
    textStyle(NORMAL);
  }
}

function drawPlayerHand() {
  let cards = state.playerCards;
  if (!cards || cards.length === 0) return;
  let y = height - 100;

  // Panel is always fixed width — cards must fit inside it
  let panelW = 1080;
  fill(0,0,0,50); noStroke(); rect(width/2+4, y+6, panelW, 154, 28);
  fill(255,242); rect(width/2, y, panelW, 150, 28);

  fill(40); textAlign(CENTER,CENTER); textSize(12); textStyle(BOLD);
  let lbl = 'YOUR HAND';
  if (state.status === 'SKIPPED')   lbl = 'YOUR HAND  —  You\'ve been skipped!';
  if (state.status === 'HAS_DRAWN') lbl = 'YOUR HAND  —  Play the drawn card or end turn';
  if (!state.isPlayerTurn)          lbl = 'YOUR HAND  —  Opponent\'s turn…';
  text(lbl, width/2, height-17);
  textStyle(NORMAL);

  // Calculate card size and spacing so all cards always fit inside the panel
  let maxPanelCards = panelW - 60; // usable width inside panel
  let cardW, cardH, spacing;
  if (cards.length <= 10) {
    // Enough room for full size cards
    cardW = 72; cardH = 110; spacing = 88;
  } else {
    // Shrink spacing so cards overlap and stay within panel
    spacing = min(88, floor(maxPanelCards / cards.length));
    // Also shrink card size proportionally when very crowded
    let scaleFactor = min(1.0, spacing / 88);
    cardW = max(36, floor(72 * scaleFactor));
    cardH = max(54, floor(110 * scaleFactor));
  }

  let totalW = (cards.length - 1) * spacing + cardW;
  let startX = width/2 - totalW/2;

  for (let i = 0; i < cards.length; i++) {
    let x = startX + i * spacing + cardW/2;
    let hov = (hoveredCardIdx === i);
    let playable = cards[i].playable;
    let card = cards[i].card;
    let col = CARD_COLORS[card.color] || [80,80,80];
    let yOff = hov && playable ? -20 : 0;
    if (playable) {
      noFill();
      stroke(255, 210, 80, hov ? 220 : 90);
      strokeWeight(hov ? 4 : 2);
      rect(x, y+yOff, cardW+6, cardH+8, 14);
      noStroke();
    }
    fill(0,0,0,40); noStroke(); rect(x+3, y+yOff+5, cardW, cardH, 13);
    drawUnoCard(x, y+yOff, cardW, cardH, col, card.label);
    if (!playable && state.status === 'YOUR_TURN') {
      fill(0,0,0,90); noStroke(); rect(x, y+yOff, cardW, cardH, 13);
    }
  }

  if (state.playerHasUno) {
    fill(220,45,45); noStroke();
    rect(width/2 + totalW/2 + 55, y, 62, 30, 15);
    fill(255); textSize(13); textStyle(BOLD);
    text('UNO!', width/2 + totalW/2 + 55, y);
    textStyle(NORMAL);
  }
}

// ── Card primitives ──────────────────────────────────────────────
function drawUnoCard(x, y, w, h, col, label) {
  push(); translate(x, y); noStroke();

  // White border
  fill(255); rect(0, 0, w, h, 13);

  // Colored face
  fill(col[0],col[1],col[2]); rect(0,0,w-8,h-8,11);

  // Center oval
  fill(255,210); ellipse(0,0,w*0.68,h*0.46);

  // Center label — scale with card size
  fill(col[0],col[1],col[2]);
  textAlign(CENTER,CENTER);
  let centerSize = label.length > 2 ? w * 0.32 : w * 0.48;
  textSize(centerSize); textStyle(BOLD);
  text(label, 0, centerSize * 0.08);
  textStyle(NORMAL);

  // Corner labels — scale with card size
  let cornerSize = w * 0.18;
  fill(255); textSize(cornerSize);
  text(label, -w/2 + w*0.15, -h/2 + h*0.12);
  text(label,  w/2 - w*0.15,  h/2 - h*0.12);

  pop();
}

function drawCardStack(x, y) {
  for (let i=2; i>=0; i--) drawCardBack(x+i*3, y-i*3, 80, 120);
}

function drawCardBack(x, y, w=80, h=120) {
  push(); translate(x,y); noStroke();
  fill(22,22,38); rect(0,0,w,h,13);
  fill(190,35,35); rect(0,0,w-10,h-10,10);
  fill(255, 235, 120, 200); ellipse(0,0,w*0.6,h*0.35);
  fill(255); textAlign(CENTER,CENTER);
  textSize(w * 0.26); textStyle(BOLD);
  text('UNO',0, w * 0.03); textStyle(NORMAL);
  pop();
}

// ── Overlays ─────────────────────────────────────────────────────
function drawColorPicker() {
  // Dark backdrop
  fill(0, 0, 0, 200); noStroke(); rect(width/2, height/2, width, height);

  // Panel
  let px = width/2, py = height/2;
  fill(18, 28, 36); noStroke(); rect(px, py, 520, 400, 28);

  // Panel border glow
  noFill(); stroke(255, 255, 255, 30); strokeWeight(1.5);
  rect(px, py, 524, 404, 30); noStroke();

  // Title
  fill(255); textAlign(CENTER, CENTER); textSize(26); textStyle(BOLD);
  text('Choose a Color', px, py - 158);
  textStyle(NORMAL);

  // Subtitle
  let topCard = state && state.topCard ? state.topCard : null;
  let isPlus4 = topCard && topCard.label === '+4';
  fill(180, 210, 200); textSize(14);
  text(isPlus4 ? 'Wild Draw Four — pick the new active color'
               : 'Wild Card — pick the new active color', px, py - 128);

  // Four color tiles arranged in a 2x2 grid
  let positions = [
    { name: 'RED',    ox: -120, oy: -38 },
    { name: 'BLUE',   ox:  120, oy: -38 },
    { name: 'GREEN',  ox: -120, oy:  88 },
    { name: 'YELLOW', ox:  120, oy:  88 },
  ];

  for (let i = 0; i < positions.length; i++) {
    let opt  = positions[i];
    let cx   = px + opt.ox;
    let cy   = py + opt.oy;
    let col  = CARD_COLORS[opt.name];
    let hov  = dist(mouseX, mouseY, cx, cy) < 72;
    let tw   = hov ? 148 : 136;
    let th   = hov ? 100 : 92;

    // Tile shadow
    fill(0, 0, 0, 60); noStroke();
    rect(cx + 4, cy + 6, tw, th, 18);

    // Tile background
    fill(col[0] * 0.55, col[1] * 0.55, col[2] * 0.55);
    rect(cx, cy, tw, th, 16);
    fill(col[0], col[1], col[2]);
    rect(cx, cy, tw - 6, th - 6, 14);

    // Shine overlay
    fill(255, 255, 255, hov ? 40 : 22);
    rect(cx, cy - th/4, tw - 6, th/2, 14, 14, 0, 0);

    // Hover border
    if (hov) {
      noFill(); stroke(255, 255, 255, 200); strokeWeight(3);
      rect(cx, cy, tw, th, 16); noStroke();
    }

    // Draw the color's icon inside each tile
    drawColorIcon(cx, cy, opt.name, col, hov);

    // Color name label below icon
    fill(255); textAlign(CENTER, CENTER); textSize(hov ? 15 : 13); textStyle(BOLD);
    text(opt.name, cx, cy + th/2 - 14);
    textStyle(NORMAL);
  }
}

// Draws a unique icon for each color inside its picker tile
function drawColorIcon(x, y, name, col, hov) {
  push(); translate(x, y - 8);
  let s = hov ? 1.1 : 1.0;
  scale(s);
  noStroke();

  if (name === 'RED') {
    // Flame shape
    fill(255, 220, 60);
    ellipse(0, 4, 22, 28);
    fill(255, 140, 30);
    ellipse(-6, 8, 14, 20);
    ellipse(6, 6, 14, 22);
    fill(220, 50, 50);
    ellipse(0, 0, 18, 26);
    fill(255, 180, 80, 180);
    ellipse(0, -2, 8, 16);

  } else if (name === 'BLUE') {
    // Water drop
    fill(120, 180, 255);
    beginShape();
    vertex(0, -22);
    bezierVertex(18, -8, 20, 8, 0, 20);
    bezierVertex(-20, 8, -18, -8, 0, -22);
    endShape(CLOSE);
    fill(255, 255, 255, 120);
    ellipse(-5, -6, 7, 12);

  } else if (name === 'GREEN') {
    // Leaf shape
    fill(80, 200, 80);
    beginShape();
    vertex(0, -22);
    bezierVertex(22, -10, 22, 14, 0, 20);
    bezierVertex(-22, 14, -22, -10, 0, -22);
    endShape(CLOSE);
    // Stem
    fill(60, 150, 60);
    rect(0, 14, 4, 12, 2);
    // Vein
    stroke(60, 160, 60, 180); strokeWeight(1.5);
    line(0, -18, 0, 16);
    line(0, -6, 10, 2);
    line(0, 2, -10, 8);
    noStroke();

  } else if (name === 'YELLOW') {
    // Sun
    fill(255, 220, 50);
    ellipse(0, 0, 30, 30);
    // Rays
    for (let a = 0; a < TWO_PI; a += TWO_PI / 8) {
      fill(255, 200, 40);
      push();
      rotate(a);
      rect(0, -24, 6, 10, 3);
      pop();
    }
    // Sun center shine
    fill(255, 240, 120);
    ellipse(0, 0, 20, 20);
    fill(255, 255, 200, 180);
    ellipse(-4, -4, 8, 8);
  }

  pop();
}

function drawError() {
  fill(200,40,40,210); noStroke();
  rect(width/2, height-16, 560, 26, 7);
  fill(255); textAlign(CENTER,CENTER); textSize(12);
  text('⚠  ' + errorMsg, width/2, height-16);
}

function drawLoadingOverlay() {
  fill(0,0,0,150); noStroke();
  rect(width/2, height/2, 320, 62, 16);
  fill(255); textAlign(CENTER,CENTER); textSize(18);
  text(loadingMsg, width/2, height/2);
}

function drawUnoFlash() {
  unoFlash--;
  if (unoFlash <= 0) { unoFlash = 0; return; }

  let totalFrames = 120;
  let elapsed = totalFrames - unoFlash; // 0 = just started, 120 = done

  // Target positions:
  // player UNO button: (width/2, height/2 + 150)
  // opponent badge:    (width/2, 148 + 92) = (width/2, 240)
  let targetX = width/2;
  let targetY = (unoWho === 'player') ? height/2 + 150 : 240;

  // Start position: center of screen
  let startX = width/2;
  let startY = height/2;

  // Phase 1 (frames 0-30): big in center, fully visible
  // Phase 2 (frames 30-100): travels from center to target, shrinks
  // Phase 3 (frames 100-120): fades out at target

  let x, y, sz, alpha;

  if (elapsed < 30) {
    // Big in center
    x = startX; y = startY;
    sz = map(elapsed, 0, 30, 200, 160);
    alpha = map(elapsed, 0, 10, 0, 255);
  } else if (elapsed < 100) {
    // Travel to target
    let t = map(elapsed, 30, 100, 0, 1);
    t = 1 - pow(1 - t, 2); // ease out
    x = lerp(startX, targetX, t);
    y = lerp(startY, targetY, t);
    sz = map(elapsed, 30, 100, 160, 50);
    alpha = 255;
  } else {
    // Fade out at target
    x = targetX; y = targetY;
    sz = 50;
    alpha = map(elapsed, 100, totalFrames, 255, 0);
  }

  let btnW = sz * 1.5;
  let btnH = sz * 0.55;

  push();
  translate(x, y);
  fill(220, 45, 45, alpha); noStroke();
  rect(0, 0, btnW, btnH, btnH/2);
  fill(255, alpha); textAlign(CENTER, CENTER);
  textSize(sz * 0.38); textStyle(BOLD);
  text('UNO!', 0, 0);
  textStyle(NORMAL);
  pop();
}

function drawOpponentPeek() {
  if (!opponentPeek) return;
  peekTimer = max(peekTimer - 1, 0);

  // Safety — if peekTimer runs out (shouldn't normally happen), clear the peek
  if (peekTimer === 0 && opponentPeek) {
    opponentPeek = null; return;
  }

  let col = CARD_COLORS[opponentPeek.color] || [80, 80, 80];
  let pulse = 0.5 + 0.5 * sin(frameCount * 0.15);

  // Single glow ellipse instead of a loop — much lighter
  fill(col[0], col[1], col[2], 60 + pulse * 40); noStroke();
  ellipse(width/2, 210, 160, 120);

  // Label
  fill(255); textAlign(CENTER, CENTER); textSize(14); textStyle(BOLD);
  text('Opponent plays…', width/2, 130); textStyle(NORMAL);

  // Floating card
  let floatY = sin(frameCount * 0.12) * 5;
  drawUnoCard(width/2, 210 + floatY, 90, 130, col, opponentPeek.label);

  // Outline — use filled rect trick instead of stroke for JavaFX reliability
  fill(255, 220, 80, 120 + pulse * 80); noStroke();
  rect(width/2, 210 + floatY, 100, 140, 16);
  fill(col[0], col[1], col[2]); noStroke();
  rect(width/2, 210 + floatY, 94, 134, 14);
  drawUnoCard(width/2, 210 + floatY, 90, 130, col, opponentPeek.label);
}

// ── Drawn icon replacements for emojis ───────────────────────────
function drawTrophy(x, y, size, alpha) {
  push(); translate(x, y);
  textAlign(CENTER, CENTER);
  // Bold gold star — simple, readable, no rendering issues
  fill(0, alpha * 0.5); textSize(size * 1.1); textStyle(BOLD);
  text('*', 3, 3); // shadow
  fill(255, 200, 30, alpha); textSize(size * 1.1); textStyle(BOLD);
  text('*', 0, 0);
  textStyle(NORMAL);
  pop();
}

function drawSkull(x, y, size, alpha) {
  push(); translate(x, y);
  textAlign(CENTER, CENTER);
  // Bold red X — simple, readable, no rendering issues
  fill(0, alpha * 0.5); textSize(size * 1.1); textStyle(BOLD);
  text('X', 3, 3); // shadow
  fill(220, 55, 55, alpha); textSize(size * 1.1); textStyle(BOLD);
  text('X', 0, 0);
  textStyle(NORMAL);
  pop();
}

function drawOpponentSkipAnimation() {
  oppSkipAnim++;
  let totalFrames = 150; // 2.5 seconds
  let alpha;
  if      (oppSkipAnim < 15)                  alpha = map(oppSkipAnim, 0, 15, 0, 255);
  else if (oppSkipAnim > totalFrames - 15)     alpha = map(oppSkipAnim, totalFrames-15, totalFrames, 255, 0);
  else                                         alpha = 255;
  if (oppSkipAnim >= totalFrames) { oppSkipAnim = 0; return; }
  let cx = width/2, cy = 250;
  fill(20, 20, 30, alpha * 0.85); noStroke(); rect(cx, cy, 290, 44, 22);
  noFill(); stroke(240, 160, 40, alpha); strokeWeight(1.5); rect(cx, cy, 290, 44, 22); noStroke();
  fill(255, 210, 80, alpha); textAlign(CENTER, CENTER); textSize(16); textStyle(BOLD);
  text('Opponent turn skipped!', cx, cy); textStyle(NORMAL);
}

function drawOpponentDrawAnimation() {
  oppDrawAnim++;
  let totalFrames = 150; // 2.5 seconds
  let alpha;
  if      (oppDrawAnim < 15)                  alpha = map(oppDrawAnim, 0, 15, 0, 255);
  else if (oppDrawAnim > totalFrames - 15)     alpha = map(oppDrawAnim, totalFrames-15, totalFrames, 255, 0);
  else                                         alpha = 255;
  if (oppDrawAnim >= totalFrames) { oppDrawAnim = 0; return; }
  let cx = width/2, cy = 250;
  fill(20, 20, 30, alpha * 0.85); noStroke(); rect(cx, cy, 290, 44, 22);
  noFill(); stroke(100, 160, 240, alpha); strokeWeight(1.5); rect(cx, cy, 290, 44, 22); noStroke();
  fill(160, 210, 255, alpha); textAlign(CENTER, CENTER); textSize(16); textStyle(BOLD);
  text('Opponent draws a card!', cx, cy); textStyle(NORMAL);
}


function drawSkipAnimation() {
  skipAnim++;
  let totalFrames = 150; // 2.5 seconds at 60fps
  let alpha;
  if      (skipAnim < 15)                  alpha = map(skipAnim, 0, 15, 0, 255);
  else if (skipAnim > totalFrames - 15)    alpha = map(skipAnim, totalFrames-15, totalFrames, 255, 0);
  else                                     alpha = 255;

  if (skipAnim >= totalFrames) { skipAnim = 0; return; }

  let cx = width/2, cy = height/2;

  // Black overlay
  fill(0, 0, 0, alpha * 0.82); noStroke();
  rect(cx, cy, width, height);

  // ── Circle-slash graphic ─────────────────────────────────────
  let r = 90;

  // Draw ring using two filled circles (outer red, inner black cutout)
  fill(220, 50, 50, alpha); noStroke();
  ellipse(cx, cy - 50, r*2, r*2);

  // Inner black cutout to make it look like a ring
  fill(0, 0, 0, alpha * 0.82); noStroke();
  ellipse(cx, cy - 50, r*2 - 28, r*2 - 28);

  // Diagonal slash — drawn as a thick filled rotated rectangle
  push();
  translate(cx, cy - 50);
  rotate(PI / 4);
  fill(220, 50, 50, alpha); noStroke();
  rect(0, 0, 22, r*2 + 10, 6);
  pop();

  // "SKIP TURN" text below
  fill(255, alpha);
  textAlign(CENTER, CENTER); textSize(52); textStyle(BOLD);
  text('SKIP TURN', cx, cy + 72);
  textStyle(NORMAL);
}

function drawWinScreen() {
  winnerAnim++;
  let isWin = (winner === 'player');

  // Simple fade in over 40 frames — one solid rect, no row loops
  let fadeAlpha = constrain(map(winnerAnim, 0, 40, 0, 230), 0, 230);
  noStroke();
  if (isWin) {
    fill(10, 10, 35, fadeAlpha);
  } else {
    fill(28, 6, 6, fadeAlpha);
  }
  rect(width/2, height/2, width, height);

  // Wait until mostly faded in before drawing content
  if (winnerAnim < 15) return;
  let contentAlpha = constrain(map(winnerAnim, 15, 50, 0, 255), 0, 255);

  let cx = width/2, cy = height/2 - 40;

  // Starburst lines
  strokeWeight(1); noFill();
  for (let a = 0; a < TWO_PI; a += TWO_PI / 24) {
    let len = map(sin(winnerAnim * 0.04 + a), -1, 1, 80, 220);
    stroke(isWin ? color(255, 210, 60, contentAlpha * 0.3)
                 : color(200, 60, 60, contentAlpha * 0.25));
    line(cx, cy, cx + cos(a)*len, cy + sin(a)*len);
  }
  noStroke();

  // Single glow circle — one ellipse with alpha, no loop
  let pulse = 0.97 + 0.03 * sin(winnerAnim * 0.07);
  fill(isWin ? color(255, 200, 50, contentAlpha * 0.18)
             : color(200, 50, 50, contentAlpha * 0.18));
  ellipse(cx, cy, 280 * pulse, 280 * pulse);
  fill(isWin ? color(255, 200, 50, contentAlpha * 0.12)
             : color(200, 50, 50, contentAlpha * 0.12));
  ellipse(cx, cy, 200 * pulse, 200 * pulse);

  // Trophy or skull
  let bounce = isWin ? -abs(sin(winnerAnim * 0.06)) * 14 : 0;
  if (isWin) {
    drawTrophy(cx, cy - 60 + bounce, 80, contentAlpha);
  } else {
    drawSkull(cx, cy - 60, 80, contentAlpha);
  }

  // Headline
  push();
  translate(cx, cy + 30);
  let headScale = constrain(map(winnerAnim, 15, 45, 0.5, 1.0), 0.5, 1.0);
  scale(headScale);
  textAlign(CENTER, CENTER);
  fill(0, contentAlpha * 0.6); textSize(62); textStyle(BOLD);
  text(isWin ? 'YOU WIN!' : 'YOU LOSE', 3, 3);
  fill(isWin ? color(map(sin(winnerAnim*0.08),-1,1,200,255), 200, 40, contentAlpha)
             : color(210, 55, 55, contentAlpha));
  textSize(62); textStyle(BOLD);
  text(isWin ? 'YOU WIN!' : 'YOU LOSE', 0, 0);
  textStyle(NORMAL);
  pop();

  // Subtitle
  fill(isWin ? color(255, 235, 150, contentAlpha)
             : color(200, 200, 200, contentAlpha));
  textAlign(CENTER, CENTER); textSize(18);
  text(isWin ? 'Congratulations — all cards played!'
             : 'The opponent played all their cards.', cx, cy + 88);

  // Confetti particles — win only
  if (isWin && winnerAnim % 8 === 0 && winnerAnim < 300) spawnParticles(3);

  // Play Again button
  let btnY = cy + 148;
  let btnAlpha = constrain(map(winnerAnim, 35, 55, 0, 255), 0, 255);
  let btnHov = dist(mouseX, mouseY, cx, btnY) < 80;
  if (btnHov) { fill(255, 255, 255, 25); noStroke(); ellipse(cx, btnY, 220, 80); }
  fill(isWin ? color(34, 160, 90, btnAlpha) : color(55, 55, 170, btnAlpha));
  noStroke(); rect(cx, btnY, btnHov ? 196 : 184, btnHov ? 58 : 54, 28);
  fill(255, btnAlpha); textSize(20); textStyle(BOLD);
  text('▶  Play Again', cx, btnY);
  textStyle(NORMAL);
}
