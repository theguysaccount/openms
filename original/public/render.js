import { BEACONS, GLIMMERS, WIDTH, createWorld } from "/world.js";
import { createScenery, drawBriar, drawKeeper, drawLantern } from "/art.js";

const TAU = Math.PI * 2;
const rowan = { x: 235, y: 570, vx: 0, facing: -1, color: 3, attackMs: 0 };

export function createRenderer(canvas, background) {
  const c = canvas.getContext("2d", { alpha: false });
  const frame = {
    w: 0,
    h: 0,
    scale: 1,
    x: 0,
    y: 0,
    time: 0,
    terrain: createScenery(),
    ladders: createWorld().ladders,
    background,
  };
  function resize() {
    frame.w = canvas.clientWidth;
    frame.h = canvas.clientHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(frame.w * ratio);
    canvas.height = Math.round(frame.h * ratio);
    frame.ratio = ratio;
    frame.scale = Math.max(0.76, Math.min(1.2, frame.h / 690));
  }
  resize();
  window.addEventListener("resize", resize);
  return {
    draw(state, time) {
      frame.time = time;
      if (frame.w === 0 || frame.h === 0) return;
      updateCamera(state, frame);
      c.setTransform(frame.ratio, 0, 0, frame.ratio, 0, 0);
      drawBackground(c, frame);
      c.save();
      c.scale(frame.scale, frame.scale);
      c.translate(-frame.x, -frame.y);
      c.drawImage(frame.terrain, 0, 0);
      drawRopes(c, frame.ladders);
      drawBeacons(c, state, frame.time);
      drawGlimmers(c, state, frame.time);
      drawActors(c, state, frame.time);
      drawParticles(c, state, frame.time);
      c.restore();
      drawVignette(c, frame);
    },
    close() {
      window.removeEventListener("resize", resize);
      frame.terrain.width = 1;
    },
  };
}

function updateCamera(state, frame) {
  const me = state.players?.find((player) => player.id === state.you);
  const width = frame.w / frame.scale,
    height = frame.h / frame.scale;
  const target = Math.max(
    0,
    Math.min(WIDTH - width, (me?.x ?? 250) - width * 0.42),
  );
  frame.x += (target - frame.x) * 0.09;
  frame.y = 570 - height * 0.78;
}

function drawBackground(c, frame) {
  c.fillStyle = "#79a39b";
  c.fillRect(0, 0, frame.w, frame.h);
  const image = frame.background;
  if (!image.complete || image.naturalWidth === 0) return;
  const height = frame.h * 1.12;
  const width = Math.max(frame.w + 120, (height * image.width) / image.height);
  const offset = -((width - frame.w) * 0.35) - (frame.x / WIDTH) * 90;
  c.drawImage(image, offset, -(height - frame.h) * 0.55, width, height);
  c.fillStyle = "#477d7820";
  c.fillRect(0, 0, frame.w, frame.h);
}

function drawRopes(c, ladders) {
  c.lineWidth = 3;
  c.strokeStyle = "#d0bd85";
  for (const ladder of ladders) {
    c.beginPath();
    c.moveTo(ladder.x - 7, ladder.y1);
    c.lineTo(ladder.x - 7, ladder.y2);
    c.moveTo(ladder.x + 7, ladder.y1);
    c.lineTo(ladder.x + 7, ladder.y2);
    c.stroke();
    for (let y = ladder.y1 + 8; y < ladder.y2; y += 15) {
      c.beginPath();
      c.moveTo(ladder.x - 9, y);
      c.lineTo(ladder.x + 9, y);
      c.stroke();
    }
  }
}

function drawBeacons(c, state, time) {
  for (let i = 0; i < BEACONS.length; i++) {
    const beacon = BEACONS[i];
    const lit = ((state.progress?.beacons ?? 0) & (1 << i)) !== 0;
    c.fillStyle = "#667a65";
    c.fillRect(beacon.x - 4, beacon.y - 115, 8, 115);
    c.strokeStyle = "#b8bb85";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(beacon.x - 4, beacon.y - 115);
    c.quadraticCurveTo(
      beacon.x + 26,
      beacon.y - 138,
      beacon.x + 32,
      beacon.y - 111,
    );
    c.stroke();
    drawLantern(
      c,
      beacon.x + 30,
      beacon.y - 84 + Math.sin(time * 0.0015 + i),
      lit,
    );
    label(c, beacon.name, beacon.x, beacon.y + 30);
    if (lit) {
      c.fillStyle = "#ffdf9f1c";
      c.beginPath();
      c.arc(beacon.x + 30, beacon.y - 84, 75, 0, TAU);
      c.fill();
    }
  }
}

function drawGlimmers(c, state, time) {
  const collected = state.progress?.collected ?? 0;
  for (let i = 0; i < GLIMMERS.length; i++) {
    if (collected & (1 << i)) continue;
    const point = GLIMMERS[i];
    const y = point[1] + Math.sin(time * 0.003 + i) * 5;
    c.fillStyle = "#ffe39a22";
    c.beginPath();
    c.arc(point[0], y, 18, 0, TAU);
    c.fill();
    c.fillStyle = "#ffedb5";
    c.beginPath();
    c.moveTo(point[0], y - 10);
    c.lineTo(point[0] + 5, y);
    c.lineTo(point[0], y + 10);
    c.lineTo(point[0] - 5, y);
    c.closePath();
    c.fill();
  }
}

function drawActors(c, state, time) {
  drawKeeper(c, rowan, time);
  label(c, "Rowan · Keeper of the Dock", rowan.x, rowan.y - 119);
  for (const enemy of state.enemies ?? []) {
    if (enemy.hp <= 0) continue;
    drawBriar(c, enemy, time);
    if (enemy.boss || enemy.hp < enemy.maxHp) enemyHealth(c, enemy);
  }
  for (const player of state.players ?? []) {
    player.drawX ??= player.x;
    player.drawY ??= player.y;
    player.drawX += (player.x - player.drawX) * 0.4;
    player.drawY += (player.y - player.drawY) * 0.4;
    c.save();
    c.translate(player.drawX - player.x, player.drawY - player.y);
    drawKeeper(c, player, time);
    label(
      c,
      player.id === state.you ? `${player.name} · you` : player.name,
      player.x,
      player.y - 92,
    );
    c.restore();
  }
}

function enemyHealth(c, enemy) {
  const width = enemy.boss ? 110 : 42;
  const y = enemy.y - (enemy.boss ? 175 : 65);
  c.fillStyle = "#243e43c9";
  c.fillRect(enemy.x - width / 2, y, width, 5);
  c.fillStyle = enemy.boss ? "#e5b37c" : "#b6c1a2";
  c.fillRect(enemy.x - width / 2, y, (width * enemy.hp) / enemy.maxHp, 5);
  if (enemy.boss) label(c, "The Hollow Warden", enemy.x, y - 13);
}

function drawParticles(c, state, time) {
  for (const shot of state.projectiles ?? []) {
    c.fillStyle = "#ffd38538";
    c.beginPath();
    c.ellipse(shot.x - shot.facing * 14, shot.y, 26, 8, 0, 0, TAU);
    c.fill();
    c.fillStyle = "#fff1b1";
    c.beginPath();
    c.arc(shot.x, shot.y, 6, 0, TAU);
    c.fill();
  }
  c.fillStyle = "#fff0b6a0";
  for (let i = 0; i < 32; i++) {
    const x = (i * 167 + Math.sin(time * 0.0004 + i) * 20) % WIDTH;
    const y = 130 + ((i * 71) % 380) + Math.cos(time * 0.0007 + i) * 14;
    c.beginPath();
    c.arc(x, y, i % 3 === 0 ? 2 : 1, 0, TAU);
    c.fill();
  }
}

function drawVignette(c, frame) {
  c.fillStyle = "#112f332b";
  c.fillRect(0, frame.h - 24, frame.w, 24);
}

function label(c, text, x, y) {
  c.save();
  c.font = "14px system-ui, sans-serif";
  c.textAlign = "center";
  const width = c.measureText(text).width;
  c.fillStyle = "#143b3ddc";
  c.beginPath();
  c.roundRect(x - width / 2 - 9, y - 15, width + 18, 22, 5);
  c.fill();
  c.fillStyle = "#f7e9c5";
  c.fillText(text, x, y);
  c.restore();
}
