// ================================================================
// UNO UI — p5.js sketch connected to UnoServer Java REST API
// ================================================================
// HOW TO USE:
//   1. Start the Java server:  java UnoServer
//   2. Open this sketch in a p5.js-compatible environment
//      (e.g. editor.p5js.org, or a local index.html that loads p5.js)
//   3. The UI will auto-connect and start a new game.
//
// API base URL — change this if your server runs elsewhere
const API = 'http://localhost:8080';

// ── Game state (populated from API) ─────────────────────────────
let state = null;           // Full state JSON from server
let errorMsg = '';          // Display error feedback to player
let loadingMsg = '';        // e.g. "Opponent thinking..."
let colorPickerOpen = false;// True when wild color picker is shown
let hoveredCardIdx = -1;    // Which card in player's hand is hovered
let unoFlash = 0;           // Counter for UNO! flash animation

// ── Colors matching Java Card.Color enum ────────────────────────
const CARD_COLORS = {
  RED:    [220, 55,  55],
  BLUE:   [55,  110, 240],
  GREEN:  [55,  180, 90],
  YELLOW: [245, 200, 50],
  BLACK:  [30,  30,  40],
};

const COLOR_PICKER_OPTIONS = ['RED', 'BLUE', 'GREEN', 'YELLOW'];

// ── p5.js lifecycle ─────────────────────────────────────────────
function setup() {
  createCanvas(1200, 700);
  textFont('Arial');
  rectMode(CENTER);
  newGame(); // Kick off a game on load
}

function draw() {
  if (!state) {
    drawLoading();
    return;
  }

  drawBackground();
  drawTopBar();
  drawOpponent();
  drawCenterArea();
  drawPlayerHand();
  drawUnoButton();

  if (colorPickerOpen) drawColorPicker();
  if (errorMsg)        drawError();
  if (loadingMsg)      drawLoadingOverlay();
  if (unoFlash > 0)    drawUnoFlash();
}

// ── API calls ────────────────────────────────────────────────────
function newGame() {
  apiPost('/new-game', {}, (s) => { state = s; });
}

function playCard(idx) {
  if (!state || state.status !== 'YOUR_TURN') return;
  apiPost('/play-card', { cardIndex: idx }, (s) => {
    state = s;
    errorMsg = '';
    if (s.status === 'AWAITING_COLOR') colorPickerOpen = true;
    else if (s.status === 'OPPONENT_TURN') doOpponentTurn();
    checkUno(s);
  }, (e) => { errorMsg = e; });
}

function drawACard() {
  if (!state || (state.status !== 'YOUR_TURN')) return;
  apiPost('/draw-card', {}, (s) => { state = s; errorMsg = ''; });
}

function endTurn() {
  if (!state) return;
  if (state.status !== 'HAS_DRAWN' && state.status !== 'SKIPPED') return;
  loadingMsg = 'Opponent thinking…';
  apiPost('/end-turn', {}, (s) => {
    state = s;
    loadingMsg = '';
    checkUno(s);
  });
}

function chooseColor(color) {
  colorPickerOpen = false;
  loadingMsg = 'Applying wild card…';
  apiPost('/choose-color', { color }, (s) => {
    state = s;
    loadingMsg = '';
    checkUno(s);
  });
}

function doOpponentTurn() {
  // The server handles the opponent move inside /end-turn.
  // This is just a short auto-delay so the UI shows "Opponent thinking..."
  loadingMsg = 'Opponent thinking…';
  setTimeout(() => {
    apiPost('/end-turn', {}, (s) => {
      state = s;
      loadingMsg = '';
      checkUno(s);
    });
  }, 900);
}

function checkUno(s) {
  if (s.playerHasUno || s.opponentHasUno) unoFlash = 90;
}

// ── Generic HTTP helpers ─────────────────────────────────────────
function apiPost(path, body, onSuccess, onError) {
  fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  .then(r => r.json())
  .then(data => {
    if (data.error) { if (onError) onError(data.error); }
    else            { onSuccess(data); }
  })
  .catch(err => {
    if (onError) onError('Network error: ' + err.message);
    else errorMsg = 'Network error: ' + err.message;
  });
}

// ── Mouse interaction ────────────────────────────────────────────
function mousePressed() {
  if (!state) return;

  // Color picker buttons
  if (colorPickerOpen) {
    handleColorPickerClick();
    return;
  }

  // New game button (shown when game over)
  if (!state.ongoing) {
    if (dist(mouseX, mouseY, width / 2, height / 2 + 80) < 70) {
      newGame();
    }
    return;
  }

  // Draw pile click → draw card
  let centerY = height / 2 + 10;
  if (dist(mouseX, mouseY, width / 2 - 120, centerY) < 55) {
    if (state.status === 'YOUR_TURN')  drawACard();
    if (state.status === 'HAS_DRAWN' || state.status === 'SKIPPED') endTurn();
    return;
  }

  // Player hand cards
  if (state.status === 'YOUR_TURN' || state.status === 'HAS_DRAWN') {
    let cards = state.playerCards;
    if (!cards) return;
    let totalW = (cards.length - 1) * 85 + 80;
    let startX = width / 2 - totalW / 2;
    let y = height - 100;
    for (let i = 0; i < cards.length; i++) {
      let x = startX + i * 85 + 40;
      if (dist(mouseX, mouseY, x, y) < 50 && cards[i].playable) {
        playCard(cards[i].index);
        return;
      }
    }
  }
}

function mouseMoved() {
  if (!state || !state.playerCards) { hoveredCardIdx = -1; return; }
  let cards = state.playerCards;
  let totalW = (cards.length - 1) * 85 + 80;
  let startX = width / 2 - totalW / 2;
  let y = height - 100;
  hoveredCardIdx = -1;
  for (let i = 0; i < cards.length; i++) {
    let x = startX + i * 85 + 40;
    if (dist(mouseX, mouseY, x, y) < 50) { hoveredCardIdx = i; break; }
  }
}

function handleColorPickerClick() {
  let bx = width / 2, by = height / 2;
  let offsets = [[-80, -40], [80, -40], [-80, 40], [80, 40]];
  for (let i = 0; i < 4; i++) {
    let px = bx + offsets[i][0];
    let py = by + offsets[i][1];
    if (dist(mouseX, mouseY, px, py) < 36) {
      chooseColor(COLOR_PICKER_OPTIONS[i]);
      return;
    }
  }
}

// ── Drawing helpers ──────────────────────────────────────────────

function drawLoading() {
  background(18, 92, 74);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(24);
  text('Connecting to UNO server…', width / 2, height / 2);
  textSize(14);
  text('Make sure UnoServer is running on localhost:8080', width / 2, height / 2 + 40);
}

function drawBackground() {
  background(18, 92, 74);
  noStroke();
  fill(14, 74, 60);
  rect(width / 2, height / 2, 1100, 600, 36);
}

function drawTopBar() {
  let topCard = state.topCard;
  let colorName = topCard ? topCard.color : 'GREEN';
  let col = CARD_COLORS[colorName] || [100, 180, 100];

  fill(col[0], col[1], col[2]);
  rect(width / 2, 45, 1100, 60, 18);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  textStyle(BOLD);

  let dirText = '↻ Clockwise';
  let turnText = state.isPlayerTurn ? '  ·  Your Turn' : '  ·  Opponent\'s Turn';
  let colorText = colorName + '  ·  ' + dirText + turnText;
  text(colorText, width / 2, 45);
  textStyle(NORMAL);
}

function drawOpponent() {
  let y = 145;
  let count = state.opponentHandSize || 0;

  fill(255);
  ellipse(width / 2, y - 30, 50);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  text('Opponent', width / 2, y);

  stroke(255, 100);
  line(width / 2 - 90, y + 12, width / 2 + 90, y + 12);
  noStroke();

  // Draw face-down cards
  let spacing = min(26, 520 / max(count, 1));
  let startX  = width / 2 - ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    drawCardBack(startX + i * spacing, y + 48, 34, 50);
  }

  fill(255);
  textSize(13);
  let unoTag = state.opponentHasUno ? ' — UNO! 🔴' : '';
  text(count + ' card' + (count !== 1 ? 's' : '') + unoTag, width / 2, y + 90);
}

function drawCenterArea() {
  let cx = width / 2;
  let cy = height / 2 + 10;

  // Draw pile
  drawCardStack(cx - 120, cy);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);

  // Label changes based on game status
  if (state.status === 'SKIPPED')       text('SKIP TURN\n(click)', cx - 120, cy + 80);
  else if (state.status === 'HAS_DRAWN') text('END TURN\n(click)', cx - 120, cy + 80);
  else if (state.status === 'YOUR_TURN') text('DRAW\n(click)', cx - 120, cy + 80);
  else                                   text('DRAW PILE', cx - 120, cy + 80);

  // Discard pile — top card
  let top = state.topCard;
  if (top) {
    let col = CARD_COLORS[top.color] || [80, 80, 80];
    drawUnoCard(cx + 120, cy, 90, 130, col, top.label);
  }
  fill(255);
  textSize(13);
  text('DISCARD', cx + 120, cy + 80);

  // Game over overlay
  if (!state.ongoing) {
    fill(0, 0, 0, 160);
    rect(cx, cy, 360, 200, 20);
    fill(255);
    textSize(30);
    textStyle(BOLD);
    text(state.status === 'GAME_OVER' ? 'Game Over!' : 'Game Over!', cx, cy - 30);
    textStyle(NORMAL);
    textSize(16);
    text('Click below to play again', cx, cy + 10);
    // New game button
    fill(220, 45, 45);
    rect(cx, cy + 60, 160, 50, 25);
    fill(255);
    textSize(18);
    textStyle(BOLD);
    text('New Game', cx, cy + 60);
    textStyle(NORMAL);
  }
}

function drawUnoButton() {
  if (unoFlash > 0) return; // replaced by flash anim

  let active = state.playerHasUno || state.opponentHasUno;
  fill(active ? color(255, 80, 80) : color(160, 40, 40));
  rect(width / 2, height / 2 + 148, 130, 48, 24);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(22);
  textStyle(BOLD);
  text('UNO!', width / 2, height / 2 + 148);
  textStyle(NORMAL);
}

function drawPlayerHand() {
  let cards = state.playerCards;
  if (!cards || cards.length === 0) return;

  let y = height - 100;

  // Hand background panel
  let panelW = min(1060, cards.length * 85 + 120);
  fill(255, 245);
  rect(width / 2, y, panelW, 150, 28);

  // Status label above panel
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);
  let label = 'YOUR HAND';
  if (state.status === 'SKIPPED')    label = 'YOUR HAND — You\'ve been skipped!';
  if (state.status === 'HAS_DRAWN')  label = 'YOUR HAND — You drew. Play it or end turn.';
  if (!state.isPlayerTurn)           label = 'YOUR HAND — Opponent\'s turn…';
  text(label, width / 2, height - 18);

  let totalW = (cards.length - 1) * 85 + 80;
  let startX = width / 2 - totalW / 2;

  for (let i = 0; i < cards.length; i++) {
    let x = startX + i * 85 + 40;
    let hovered = (hoveredCardIdx === i);
    let playable = cards[i].playable;
    let card = cards[i].card;
    let col = CARD_COLORS[card.color] || [80, 80, 80];

    let yOff = hovered && playable ? -18 : 0;

    // Glow effect for playable cards
    if (playable) {
      noFill();
      stroke(255, 230, 100, hovered ? 200 : 100);
      strokeWeight(hovered ? 3 : 1.5);
      rect(x, y + yOff, 76, 116, 14);
      noStroke();
    }

    drawUnoCard(x, y + yOff, 72, 110, col, card.label);

    // Dim non-playable cards
    if (!playable && state.status === 'YOUR_TURN') {
      fill(0, 0, 0, 80);
      noStroke();
      rect(x, y + yOff, 72, 110, 14);
    }
  }

  // UNO badge
  if (state.playerHasUno) {
    fill(220, 45, 45);
    rect(width / 2 + totalW / 2 + 50, y, 60, 32, 16);
    fill(255);
    textSize(14);
    textStyle(BOLD);
    text('UNO!', width / 2 + totalW / 2 + 50, y);
    textStyle(NORMAL);
  }
}

// ── Card drawing primitives ──────────────────────────────────────
function drawUnoCard(x, y, w, h, col, label) {
  push();
  translate(x, y);
  noStroke();

  // White border
  fill(255);
  rect(0, 0, w, h, 13);

  // Colored face
  fill(col[0], col[1], col[2]);
  rect(0, 0, w - 8, h - 8, 11);

  // Oval
  fill(255, 220);
  ellipse(0, 0, w * 0.7, h * 0.5);

  // Center label
  fill(col[0], col[1], col[2]);
  textAlign(CENTER, CENTER);
  textSize(label.length > 2 ? 18 : 24);
  textStyle(BOLD);
  text(label, 0, 2);
  textStyle(NORMAL);

  // Corner labels
  textSize(11);
  fill(255);
  text(label, -w / 2 + 11, -h / 2 + 14);
  text(label, w / 2 - 11, h / 2 - 14);

  pop();
}

function drawCardStack(x, y) {
  for (let i = 2; i >= 0; i--) {
    drawCardBack(x + i * 3, y - i * 3, 80, 120);
  }
}

function drawCardBack(x, y, w = 80, h = 120) {
  push();
  translate(x, y);
  noStroke();

  fill(30, 30, 48);
  rect(0, 0, w, h, 13);

  fill(200, 40, 40);
  rect(0, 0, w - 10, h - 10, 10);

  fill(255, 220);
  ellipse(0, 0, w * 0.6, h * 0.35);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(w * 0.2);
  textStyle(BOLD);
  text('UNO', 0, 2);
  textStyle(NORMAL);

  pop();
}

// ── Overlay elements ─────────────────────────────────────────────
function drawColorPicker() {
  // Dim background
  fill(0, 0, 0, 180);
  noStroke();
  rect(width / 2, height / 2, width, height);

  // Panel
  fill(40, 40, 50);
  rect(width / 2, height / 2, 280, 200, 20);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  textStyle(BOLD);
  text('Choose a Color', width / 2, height / 2 - 70);
  textStyle(NORMAL);

  let bx = width / 2, by = height / 2;
  let offsets = [[-80, -30], [80, -30], [-80, 30], [80, 30]];
  let names   = COLOR_PICKER_OPTIONS;

  for (let i = 0; i < 4; i++) {
    let px = bx + offsets[i][0];
    let py = by + offsets[i][1];
    let col = CARD_COLORS[names[i]];
    let hov = dist(mouseX, mouseY, px, py) < 36;

    fill(col[0], col[1], col[2]);
    stroke(255);
    strokeWeight(hov ? 3 : 1);
    ellipse(px, py, hov ? 76 : 68, hov ? 76 : 68);
    noStroke();

    fill(255);
    textSize(11);
    text(names[i], px, py);
  }
}

function drawError() {
  fill(220, 50, 50, 220);
  noStroke();
  rect(width / 2, height - 18, 500, 28, 8);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(13);
  text('⚠ ' + errorMsg, width / 2, height - 18);
}

function drawLoadingOverlay() {
  fill(0, 0, 0, 140);
  noStroke();
  rect(width / 2, height / 2, 300, 60, 16);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(loadingMsg, width / 2, height / 2);
}

function drawUnoFlash() {
  unoFlash--;
  let alpha = map(unoFlash, 0, 90, 0, 255);
  let scale = map(unoFlash, 90, 60, 1.4, 1.0);

  push();
  translate(width / 2, height / 2 + 148);
  scale(max(scale, 1.0));
  fill(220, 45, 45, alpha);
  noStroke();
  rect(0, 0, 160, 60, 30);
  fill(255, alpha);
  textAlign(CENTER, CENTER);
  textSize(28);
  textStyle(BOLD);
  text('UNO!', 0, 0);
  textStyle(NORMAL);
  pop();
}
