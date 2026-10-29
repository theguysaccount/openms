import {
  advanceSimulation,
  applyExternalImpulse,
  createSimulation,
  relocateSimulation,
} from "../client/src/physics/simulation.js";
import { BEACONS, ENEMIES, SPAWN, createWorld, emptyInput } from "./world.js";
import {
  collectGlimmers,
  levelOf,
  lightBeacon,
  maxHealth,
} from "./progression.js";

const terrain = createWorld();
const STEP_MS = 30;
export const MAX_PLAYERS = 48;

export function createActor(id, progress) {
  return {
    id,
    progress,
    sim: createSimulation(terrain, progress),
    input: emptyInput(),
    energy: 100,
    attackMs: 0,
    castMs: 0,
    invincibleMs: 0,
    dirty: false,
    lastInput: 0,
    swing: 0,
    event: null,
    eventId: 0,
    ws: null,
  };
}

export function createEncounter() {
  const enemies = ENEMIES.map((e, id) => ({
    id,
    x: e[0],
    y: 570,
    left: e[1],
    right: e[2],
    home: e[0],
    hp: 36,
    maxHp: 36,
    facing: id % 2 ? 1 : -1,
    hurt: 0,
    respawn: 0,
    boss: false,
    attackers: new Set(),
  }));
  enemies.push({
    id: 8,
    x: 4090,
    y: 570,
    left: 3840,
    right: 4470,
    home: 4090,
    hp: 280,
    maxHp: 280,
    facing: -1,
    hurt: 0,
    respawn: 0,
    boss: true,
    attackers: new Set(),
  });
  return { enemies, projectiles: [], projectileId: 0, time: 0 };
}

export function stepWorld(actors, encounter) {
  encounter.time += STEP_MS;
  for (const enemy of encounter.enemies) stepEnemy(enemy, encounter.time);
  for (const actor of actors.values()) stepActor(actor, actors, encounter);
  stepProjectiles(actors, encounter);
}

function stepActor(actor, actors, encounter) {
  const p = actor.progress;
  actor.attackMs = Math.max(0, actor.attackMs - STEP_MS);
  actor.castMs = Math.max(0, actor.castMs - STEP_MS);
  actor.invincibleMs = Math.max(0, actor.invincibleMs - STEP_MS);
  actor.energy = Math.min(100, actor.energy + 0.45);
  if (encounter.time - actor.lastInput > 1500) {
    Object.assign(actor.input, emptyInput());
  }
  advanceSimulation(actor.sim, actor.input, STEP_MS);
  if (actor.sim.y > 800 || actor.sim.diagnostics.fault) respawn(actor);
  collectGlimmers(actor);
  if (
    (actor.input.attack || actor.input.attackPressed) &&
    actor.attackMs === 0
  ) {
    melee(actor, actors, encounter);
  }
  if ((actor.input.cast || actor.input.castPressed) && actor.castMs === 0) {
    cast(actor, encounter);
  }
  actor.input.attackPressed = false;
  actor.input.castPressed = false;
  if (actor.input.interact) interact(actor);
  actor.input.interact = false;
  for (const enemy of encounter.enemies) touchEnemy(actor, enemy);
  p.x = actor.sim.x;
  p.y = Math.max(0, Math.min(600, actor.sim.y));
}

function stepEnemy(enemy, time) {
  enemy.hurt = Math.max(0, enemy.hurt - STEP_MS);
  if (enemy.hp <= 0) {
    enemy.respawn -= STEP_MS;
    if (enemy.respawn > 0) return;
    enemy.hp = enemy.maxHp;
    enemy.x = enemy.home;
    enemy.attackers.clear();
  }
  const speed = enemy.boss ? 0.9 : 1.4;
  enemy.x += enemy.facing * speed;
  if (enemy.x < enemy.left || enemy.x > enemy.right) enemy.facing *= -1;
  enemy.pulse = enemy.boss && time % 5000 > 3800;
}

function melee(actor, actors, encounter) {
  actor.attackMs = 360;
  actor.swing++;
  for (const enemy of encounter.enemies) {
    const dx = enemy.x - actor.sim.x;
    if (enemy.hp <= 0 || dx * actor.sim.facing < -25 || Math.abs(dx) > 105) {
      continue;
    }
    if (Math.abs(actor.sim.y - enemy.y) > (enemy.boss ? 115 : 65)) continue;
    damage(actor, enemy, 14 + levelOf(actor.progress) * 3, actors);
  }
}

function cast(actor, encounter) {
  if (actor.energy < 22 || encounter.projectiles.length >= 96) return;
  actor.castMs = 480;
  actor.energy -= 22;
  encounter.projectiles.push({
    id: ++encounter.projectileId,
    owner: actor.id,
    x: actor.sim.x + actor.sim.facing * 24,
    y: actor.sim.y - 35,
    facing: actor.sim.facing,
    life: 1050,
  });
}

function stepProjectiles(actors, encounter) {
  for (let i = encounter.projectiles.length - 1; i >= 0; i--) {
    const shot = encounter.projectiles[i];
    shot.life -= STEP_MS;
    shot.x += shot.facing * 18;
    const actor = actors.get(shot.owner);
    if (actor) hitProjectile(shot, actor, actors, encounter);
    if (shot.life <= 0 || !actor) encounter.projectiles.splice(i, 1);
  }
}

function hitProjectile(shot, actor, actors, encounter) {
  for (const enemy of encounter.enemies) {
    if (enemy.hp <= 0 || Math.abs(shot.x - enemy.x) > (enemy.boss ? 50 : 28)) {
      continue;
    }
    if (Math.abs(shot.y - (enemy.y - 33)) > (enemy.boss ? 90 : 42)) continue;
    damage(actor, enemy, 24 + levelOf(actor.progress) * 4, actors);
    shot.life = 0;
    return;
  }
}

function damage(actor, enemy, amount, actors) {
  enemy.hp = Math.max(0, enemy.hp - amount);
  enemy.hurt = 180;
  enemy.attackers.add(actor.id);
  actor.event = {
    type: "hit",
    text: `${amount}`,
    x: enemy.x,
    y: enemy.y - 80,
    n: ++actor.eventId,
  };
  if (enemy.hp > 0) return;
  enemy.respawn = enemy.boss ? 90000 : 24000;
  for (const id of enemy.attackers) {
    const keeper = actors.get(id);
    if (keeper) reward(keeper, enemy);
  }
}

function reward(actor, enemy) {
  const p = actor.progress;
  p.kills = Math.min(9999, p.kills + 1);
  p.sparks = Math.min(9999, p.sparks + (enemy.boss ? 8 : 2));
  p.xp = Math.min(99999, p.xp + (enemy.boss ? 60 : 12));
  p.hp = Math.min(maxHealth(p), p.hp + 10);
  if (enemy.boss) p.boss = true;
  actor.dirty = true;
  actor.event = {
    type: "reward",
    text: enemy.boss
      ? "The Hollow Warden is at peace. +8 glimmers"
      : "+2 glimmers · +12 XP",
    n: ++actor.eventId,
  };
}

function touchEnemy(actor, enemy) {
  if (enemy.hp <= 0 || actor.invincibleMs > 0) return;
  const range = enemy.boss ? (enemy.pulse ? 125 : 55) : 30;
  if (
    Math.abs(actor.sim.x - enemy.x) > range ||
    Math.abs(actor.sim.y - enemy.y) > 80
  ) {
    return;
  }
  actor.progress.hp -= enemy.boss ? 18 : 9;
  actor.invincibleMs = 1200;
  actor.dirty = true;
  applyExternalImpulse(actor.sim, actor.sim.x < enemy.x ? -220 : 220, -300);
  if (actor.progress.hp <= 0) respawn(actor);
}

export function respawn(actor) {
  const checkpoint = actor.progress.checkpoint;
  const target = checkpoint ? BEACONS[checkpoint - 1] : SPAWN;
  relocateSimulation(actor.sim, { x: target.x - 45, y: target.y - 15 });
  actor.progress.hp = maxHealth(actor.progress);
  actor.invincibleMs = 2000;
  actor.dirty = true;
  actor.event = {
    type: "rest",
    text: "Your lantern guides you safely home.",
    n: ++actor.eventId,
  };
}

function interact(actor) {
  let text = "Find a lantern or speak to Rowan at Thistledock.";
  if (actor.sim.x < 310 && actor.sim.y > 480) {
    actor.progress.quest = true;
    actor.progress.hp = maxHealth(actor.progress);
    actor.dirty = true;
    text =
      "Rowan: The woodland is losing its light. Gather glimmers, quiet the briarlings, and kindle all three beacons. Start above the dock!";
  } else {
    for (let i = 0; i < BEACONS.length; i++) {
      if (Math.abs(actor.sim.x - BEACONS[i].x) < 100) {
        text = lightBeacon(actor, i);
        break;
      }
    }
  }
  actor.event = { type: "dialogue", text, n: ++actor.eventId };
}

export function actorView(actor) {
  const sim = actor.sim;
  return {
    id: actor.id,
    name: actor.progress.name,
    color: actor.progress.color,
    x: sim.x,
    y: sim.y,
    vx: sim.vx,
    vy: sim.vy,
    facing: sim.facing,
    action: sim.action,
    swing: actor.swing,
    attackMs: actor.attackMs,
    invincible: actor.invincibleMs > 0,
    level: levelOf(actor.progress),
  };
}

export function snapshot(actor, actors, encounter) {
  return {
    type: "world",
    time: encounter.time,
    you: actor.id,
    players: Array.from(actors.values(), actorView),
    progress: actor.progress,
    energy: actor.energy,
    event: actor.event,
    enemies: encounter.enemies.map(enemyView),
    projectiles: encounter.projectiles,
  };
}

function enemyView(enemy) {
  return {
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    boss: enemy.boss,
    facing: enemy.facing,
    hurt: enemy.hurt > 0,
    pulse: enemy.pulse,
  };
}
