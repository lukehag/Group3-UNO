// Upgraded UNO 2-player UI (cleaner layout + spacing)

function setup() {
  createCanvas(1200, 700);
  textFont('Arial');
  rectMode(CENTER);
}

function draw() {
  drawBackground();
  drawTopBar();
  drawOpponent();
  drawCenterArea();
  drawUnoButton();
  drawPlayerHand();
}

// ---------- BACKGROUND ----------
function drawBackground() {
  background(18, 92, 74);

  noStroke();
  fill(14, 74, 60);
  rect(width / 2, height / 2, 1080, 580, 36);
}

// ---------- TOP BAR ----------
function drawTopBar() {
  fill(255);
  rect(width / 2, 45, 1100, 60, 18);

  fill(40);
  textAlign(CENTER, CENTER);
  textSize(20);
  text('🔴 RED        ↻ Clockwise        Your Turn', width / 2, 45);
}

// ---------- OPPONENT ----------
function drawOpponent() {
  let y = 140;

  // avatar
  fill(255);
  ellipse(width / 2, y - 30, 50);

  fill(255);
  textSize(16);
  text('Player 2', width / 2, y);

  // divider
  stroke(255, 120);
  line(width / 2 - 80, y + 10, width / 2 + 80, y + 10);
  noStroke();

  // cards
  for (let i = 0; i < 6; i++) {
    drawMiniCard(width / 2 - 60 + i * 20, y + 40);
  }

  textSize(14);
  text('6 Cards', width / 2, y + 85);
}

// ---------- CENTER AREA ----------
function drawCenterArea() {
  let centerY = height / 2 + 20;

  // draw pile
  drawCardStack(width / 2 - 100, centerY);
  fill(255);
  textSize(14);
  text('DRAW', width / 2 - 100, centerY + 90);

  // discard pile
  drawUnoCard(width / 2 + 100, centerY, 90, 130, [220, 60, 60], '8');
  fill(255);
  text('DISCARD', width / 2 + 100, centerY + 90);
}

// ---------- UNO BUTTON ----------
function drawUnoButton() {
  fill(220, 45, 45);
  rect(width / 2, height / 2 + 140, 160, 60, 30);

  fill(255);
  textSize(26);
  text('UNO!', width / 2, height / 2 + 140);
}

// ---------- PLAYER HAND ----------
function drawPlayerHand() {
  let y = height - 90;

  fill(255, 240);
  rect(width / 2, y, 900, 140, 30);

  let cards = [
    { c: [220, 60, 60], t: '5' },
    { c: [70, 120, 255], t: '2' },
    { c: [70, 180, 90], t: '↻' },
    { c: [245, 210, 60], t: '7' },
    { c: [50, 50, 50], t: 'W' },
    { c: [220, 60, 60], t: '+2' }
  ];

  for (let i = 0; i < cards.length; i++) {
    let x = width / 2 - 250 + i * 90;
    let hover = dist(mouseX, mouseY, x, y) < 50;
    drawUnoCard(x, hover ? y - 12 : y, 80, 120, cards[i].c, cards[i].t);
  }

  fill(40);
  textSize(16);
  text('YOUR HAND', width / 2, height - 20);
}

// ---------- CARD DRAWING ----------
function drawUnoCard(x, y, w, h, c, label) {
  push();
  translate(x, y);

  noStroke();
  fill(255);
  rect(0, 0, w, h, 14);

  fill(c[0], c[1], c[2]);
  rect(0, 0, w - 10, h - 10, 12);

  fill(255);
  ellipse(0, 0, w * 0.65, h * 0.45);

  fill(255);
  textSize(28);
  textStyle(BOLD);
  text(label, 0, 3);

  textSize(14);
  text(label, -w / 2 + 12, -h / 2 + 16);
  text(label, w / 2 - 12, h / 2 - 16);

  pop();
}

function drawCardStack(x, y) {
  for (let i = 0; i < 3; i++) {
    drawCardBack(x + i * 3, y - i * 3);
  }
}

function drawCardBack(x, y) {
  push();
  translate(x, y);

  fill(30, 30, 45);
  rect(0, 0, 80, 120, 14);

  fill(255);
  ellipse(0, 0, 50, 30);

  fill(220, 60, 60);
  textSize(16);
  text('UNO', 0, 2);

  pop();
}

function drawMiniCard(x, y) {
  drawCardBack(x, y);
}
