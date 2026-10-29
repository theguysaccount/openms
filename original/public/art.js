import { PLATFORMS, WIDTH } from "/world.js";

export const CLOAKS = ["#3f8e80", "#ba7054", "#9684b1", "#c6a45a"];
const TAU = Math.PI * 2;
const OVALS = {
  "5x2": [5.0, 2.0],
  "6x2": [6.0, 2.0],
  "79x38": [79.0, 38.0],
  "90x43": [90.0, 43.0],
  "94x39": [94.0, 39.0],
  "73x24": [73.0, 24.0],
  "58x25": [58.0, 25.0],
  "45x14": [45.0, 14.0],
  "40x47": [40.0, 47.0],
  "20x4": [20.0, 4.0],
  "12x15": [12.0, 15.0],
  "2x3": [2.0, 3.0],
  "23x5": [23.0, 5.0],
  "4x3": [4.0, 3.0],
  "125x13": [125.0, 13.0],
  "57x10": [57.0, 10.0],
  "17x23": [17.0, 23.0],
  "6x9": [6.0, 9.0],
};

function oval(c, x, y, radii) {
  c.beginPath();
  c.ellipse(x, y, radii[0], radii[1], 0, 0, TAU);
  c.fill();
}

/** Terrain, plants, buildings and textures are authored here and rasterized once. */
export function createScenery() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = 830;
  const c = canvas.getContext("2d");
  for (let i = 0; i < PLATFORMS.length; i++) drawIsland(c, PLATFORMS[i], i);
  drawHouse(c, 110, 570);
  drawArch(c, 3200, 570);
  return canvas;
}

function drawIsland(c, p, seed) {
  const left = p[0],
    right = p[1],
    y = p[2],
    depth = p[3];
  c.fillStyle = "#284d4b";
  c.beginPath();
  c.moveTo(left + 8, y - 3);
  c.lineTo(right - 9, y - 3);
  c.quadraticCurveTo(right + 14, y + 23, right - 25, y + depth * 0.65);
  c.lineTo(right - 65, y + depth);
  c.lineTo((left + right) / 2 + 35, y + depth * 0.78);
  c.lineTo(left + 45, y + depth + 17);
  c.lineTo(left + 16, y + depth * 0.5);
  c.quadraticCurveTo(left - 13, y + 18, left + 8, y - 3);
  c.fill();
  c.fillStyle = "#38635a";
  for (let x = left + 35; x < right - 20; x += 80) {
    c.beginPath();
    c.moveTo(x, y + 12);
    c.lineTo(x + 45, y + 18);
    c.lineTo(x + 15, y + depth * 0.8);
    c.closePath();
    c.fill();
  }
  c.fillStyle = "#54765a";
  c.fillRect(left + 5, y, right - left - 10, 15);
  c.fillStyle = "#7d9a67";
  c.fillRect(left + 8, y - 5, right - left - 16, 9);
  c.strokeStyle = "#9eb887";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(left + 14, y - 5);
  c.lineTo(right - 14, y - 5);
  c.stroke();
  for (let x = left + 15; x < right - 15; x += 16) drawGrass(c, x, y, x + seed);
  for (let x = left + 48; x < right - 30; x += 117) {
    drawVine(c, x, y + 18, 40 + (x % 55));
  }
  if (right - left > 700) {
    drawTree(c, left + (seed % 2 ? 620 : 460), y, 1 + (seed % 3) * 0.1);
  }
  for (let x = left + 30; x < right - 20; x += 93) drawFern(c, x, y, x % 3);
}

function drawGrass(c, x, y, seed) {
  c.strokeStyle = seed % 2 ? "#b4bd7e" : "#648d62";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, y - 2);
  c.lineTo(x - 3, y - 9 - (seed % 7));
  c.moveTo(x, y - 2);
  c.lineTo(x + 4, y - 12 - (seed % 5));
  c.stroke();
}

function drawVine(c, x, y, length) {
  c.strokeStyle = "#5a8b70";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x, y);
  c.bezierCurveTo(x - 12, y + 15, x + 13, y + length - 15, x - 9, y + length);
  c.stroke();
  c.fillStyle = "#6d9570";
  for (let j = 10; j < length; j += 14) {
    oval(c, x + ((j % 3) - 1) * 5, y + j, OVALS["5x2"]);
  }
}

function drawFern(c, x, y, seed) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = "#b2b97a";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(-5, -20, -17, -23);
  c.moveTo(0, 0);
  c.quadraticCurveTo(10, -22, 20, -16);
  c.stroke();
  c.fillStyle = seed ? "#759775" : "#b5b47b";
  for (let i = 0; i < 4; i++) {
    oval(c, -i * 4, -i * 5, OVALS["6x2"]);
    oval(c, i * 5, -i * 4 - 3, OVALS["6x2"]);
  }
  c.restore();
}

function drawTree(c, x, y, size) {
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  c.fillStyle = "#345650";
  c.beginPath();
  c.moveTo(-24, 0);
  c.quadraticCurveTo(13, -85, -4, -190);
  c.lineTo(13, -200);
  c.quadraticCurveTo(30, -75, 39, 0);
  c.fill();
  c.strokeStyle = "#345650";
  c.lineWidth = 15;
  c.beginPath();
  c.moveTo(8, -110);
  c.lineTo(-65, -171);
  c.moveTo(17, -145);
  c.lineTo(80, -190);
  c.stroke();
  c.fillStyle = "#3f7161";
  oval(c, -45, -191, OVALS["79x38"]);
  oval(c, 54, -206, OVALS["90x43"]);
  oval(c, 0, -231, OVALS["94x39"]);
  c.fillStyle = "#60886a";
  oval(c, -12, -251, OVALS["73x24"]);
  oval(c, 76, -224, OVALS["58x25"]);
  c.fillStyle = "#849b70";
  oval(c, 38, -258, OVALS["45x14"]);
  drawSmallLantern(c, -53, -125, 0.65);
  c.restore();
}

function drawHouse(c, x, y) {
  c.save();
  c.translate(x, y);
  c.fillStyle = "#c8b184";
  c.fillRect(-64, -116, 125, 114);
  c.fillStyle = "#527364";
  c.beginPath();
  c.moveTo(-88, -111);
  c.lineTo(-21, -179);
  c.quadraticCurveTo(15, -151, 86, -110);
  c.closePath();
  c.fill();
  c.strokeStyle = "#a9b881";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-89, -110);
  c.lineTo(-21, -180);
  c.lineTo(86, -110);
  c.stroke();
  c.fillStyle = "#284a45";
  c.fillRect(-13, -71, 33, 69);
  c.fillStyle = "#f1d495";
  c.fillRect(-45, -88, 20, 25);
  c.fillRect(32, -88, 18, 25);
  c.strokeStyle = "#507063";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-35, -88);
  c.lineTo(-35, -63);
  c.moveTo(41, -88);
  c.lineTo(41, -63);
  c.stroke();
  drawSmallLantern(c, 62, -76, 0.75);
  c.fillStyle = "#a5b37f";
  c.fillRect(-74, -8, 150, 8);
  c.restore();
}

function drawArch(c, x, y) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = "#60746d";
  c.lineWidth = 23;
  c.beginPath();
  c.moveTo(-42, 0);
  c.lineTo(-42, -130);
  c.quadraticCurveTo(10, -185, 68, -125);
  c.lineTo(68, 0);
  c.stroke();
  c.strokeStyle = "#91a57e";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(-46, -2);
  c.lineTo(-46, -132);
  c.quadraticCurveTo(10, -193, 72, -126);
  c.stroke();
  drawVine(c, -32, -110, 80);
  c.restore();
}

export function drawLantern(c, x, y, lit) {
  c.save();
  c.translate(x, y);
  if (lit) {
    c.globalAlpha = 0.12;
    c.fillStyle = "#ffdc80";
    oval(c, 0, 0, OVALS["40x47"]);
    c.globalAlpha = 1;
  }
  c.strokeStyle = "#d4b374";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, -19, 7, Math.PI, 0);
  c.stroke();
  c.fillStyle = lit ? "#edc77a" : "#58756c";
  c.beginPath();
  c.moveTo(-11, -15);
  c.lineTo(11, -15);
  c.lineTo(8, 12);
  c.lineTo(0, 18);
  c.lineTo(-8, 12);
  c.closePath();
  c.fill();
  c.strokeStyle = "#273f39";
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = lit ? "#fff2bf" : "#91a38d";
  c.beginPath();
  c.moveTo(0, -9);
  c.lineTo(4, 3);
  c.lineTo(0, 11);
  c.lineTo(-4, 3);
  c.closePath();
  c.fill();
  c.restore();
}

function drawSmallLantern(c, x, y, size) {
  c.save();
  c.translate(x, y);
  c.scale(size, size);
  drawLantern(c, 0, 0, true);
  c.restore();
}

export function drawKeeper(c, actor, time) {
  c.save();
  c.translate(actor.x, actor.y);
  c.scale(actor.facing, 1);
  const moving = Math.abs(actor.vx) > 15;
  const walk = moving ? Math.sin(time * 0.014) * 5 : 0;
  if (actor.invincible && Math.floor(time / 80) % 2) c.globalAlpha = 0.5;
  c.fillStyle = "#173b3a33";
  oval(c, 0, 1, OVALS["20x4"]);
  c.strokeStyle = "#233f3e";
  c.lineWidth = 7;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-7, -12);
  c.lineTo(-8 + walk, -2);
  c.moveTo(6, -12);
  c.lineTo(7 - walk, -2);
  c.stroke();
  c.translate(
    0,
    moving ? -Math.abs(walk) * 0.35 : Math.sin(time * 0.002) * 0.7,
  );
  c.fillStyle = CLOAKS[actor.color] ?? CLOAKS[0];
  c.beginPath();
  c.moveTo(-11, -45);
  c.quadraticCurveTo(-16, -28, -23, -12);
  c.quadraticCurveTo(-2, -4, 20, -13);
  c.lineTo(11, -46);
  c.closePath();
  c.fill();
  c.fillStyle = "#c9dbb7";
  c.beginPath();
  c.moveTo(-11, -45);
  c.lineTo(-3, -12);
  c.lineTo(4, -45);
  c.closePath();
  c.fill();
  c.fillStyle = CLOAKS[actor.color] ?? CLOAKS[0];
  c.beginPath();
  c.moveTo(-17, -47);
  c.quadraticCurveTo(-20, -69, -4, -75);
  c.quadraticCurveTo(20, -69, 17, -45);
  c.closePath();
  c.fill();
  c.fillStyle = "#f3e4bb";
  oval(c, 2, -55, OVALS["12x15"]);
  c.fillStyle = "#1a4140";
  oval(c, 0, -56, OVALS["2x3"]);
  oval(c, 9, -56, OVALS["2x3"]);
  drawKeeperAccessories(c, walk);
  if (actor.attackMs > 170) drawSweep(c, actor.attackMs);
  c.restore();
}

function drawKeeperAccessories(c, walk) {
  c.fillStyle = "#c5835c";
  c.fillRect(-14, -43, 28, 5);
  c.beginPath();
  c.moveTo(-13, -42);
  c.lineTo(-33, -33 + walk * 0.5);
  c.lineTo(-18, -35);
  c.closePath();
  c.fill();
  c.strokeStyle = "#dac995";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(12, -35);
  c.lineTo(26, -25);
  c.stroke();
  drawSmallLantern(c, 29, -18, 0.46);
}

function drawSweep(c, milliseconds) {
  c.strokeStyle = "#ffedb4";
  c.lineWidth = 5;
  c.globalAlpha = Math.min(1, (milliseconds - 170) / 100);
  c.beginPath();
  c.ellipse(15, -39, 74, 46, -0.5, -1.2, 1.1);
  c.stroke();
  c.strokeStyle = "#f2ca7c66";
  c.lineWidth = 13;
  c.stroke();
}

export function drawBriar(c, enemy, time) {
  if (enemy.boss) {
    drawWarden(c, enemy, time);
    return;
  }
  c.save();
  c.translate(enemy.x, enemy.y);
  c.scale(enemy.facing, 1);
  const bob = Math.sin(time * 0.006 + enemy.id) * 2;
  c.fillStyle = "#173b3a33";
  oval(c, 0, -1, OVALS["23x5"]);
  c.strokeStyle = "#384c55";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-10, -17);
  c.lineTo(-22, -2);
  c.moveTo(8, -17);
  c.lineTo(16, -2);
  c.stroke();
  c.translate(0, bob);
  c.fillStyle = enemy.hurt ? "#f0c68b" : "#5d6575";
  c.beginPath();
  c.moveTo(-24, -23);
  c.lineTo(-16, -43);
  c.lineTo(-7, -34);
  c.lineTo(2, -53);
  c.lineTo(12, -35);
  c.lineTo(25, -40);
  c.lineTo(22, -16);
  c.lineTo(5, -7);
  c.closePath();
  c.fill();
  c.fillStyle = "#87958b";
  c.beginPath();
  c.moveTo(-15, -31);
  c.quadraticCurveTo(-37, -40, -36, -22);
  c.lineTo(-10, -19);
  c.fill();
  c.fillStyle = "#ffce89";
  oval(c, 10, -26, OVALS["4x3"]);
  c.restore();
}

function drawWarden(c, enemy, time) {
  c.save();
  c.translate(enemy.x, enemy.y);
  if (enemy.pulse) {
    c.fillStyle = "#cf9b7133";
    oval(c, 0, -5, OVALS["125x13"]);
  }
  c.fillStyle = "#183e3c44";
  oval(c, 0, -2, OVALS["57x10"]);
  const float = Math.sin(time * 0.002) * 4;
  c.translate(0, float - 7);
  c.fillStyle = enemy.hurt ? "#dfbd8e" : "#64796e";
  c.beginPath();
  c.moveTo(-45, -19);
  c.lineTo(-49, -85);
  c.lineTo(-28, -122);
  c.lineTo(-28, -153);
  c.lineTo(-8, -130);
  c.lineTo(10, -155);
  c.lineTo(22, -131);
  c.lineTo(45, -146);
  c.lineTo(39, -116);
  c.lineTo(53, -75);
  c.lineTo(40, -16);
  c.lineTo(0, 0);
  c.closePath();
  c.fill();
  c.fillStyle = "#94a58b";
  c.beginPath();
  c.moveTo(-39, -95);
  c.lineTo(-75, -72);
  c.lineTo(-85, -36);
  c.lineTo(-51, -48);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(43, -97);
  c.lineTo(75, -65);
  c.lineTo(82, -30);
  c.lineTo(48, -50);
  c.closePath();
  c.fill();
  drawWardenFace(c);
  c.restore();
}

function drawWardenFace(c) {
  c.fillStyle = "#254a47";
  oval(c, -18, -89, OVALS["17x23"]);
  oval(c, 19, -89, OVALS["17x23"]);
  c.fillStyle = "#f4ce83";
  oval(c, -17, -86, OVALS["6x9"]);
  oval(c, 18, -86, OVALS["6x9"]);
  c.fillStyle = "#d2bc83";
  c.beginPath();
  c.moveTo(-8, -71);
  c.lineTo(9, -71);
  c.lineTo(0, -53);
  c.closePath();
  c.fill();
  c.strokeStyle = "#a9b483";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-23, -49);
  c.lineTo(-11, -22);
  c.moveTo(19, -47);
  c.lineTo(10, -20);
  c.stroke();
}
