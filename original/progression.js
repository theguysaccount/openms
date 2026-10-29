import { BEACONS, GLIMMERS, WIDTH } from "./world.js";

/** Saved progress is bounded and versioned independently from legacy characters. */
export function newProgress(name, color = 0) {
  return {
    version: 1,
    name,
    color,
    x: 180,
    y: 540,
    hp: 100,
    sparks: 0,
    xp: 0,
    kills: 0,
    beacons: 0,
    collected: 0,
    boss: false,
    quest: false,
    checkpoint: 0,
  };
}

export function validateProgress(value) {
  if (!value || value.version !== 1 || typeof value.name !== "string") {
    return false;
  }
  if (!/^[A-Za-z0-9 _-]{2,18}$/.test(value.name)) return false;
  const limits = {
    color: 3,
    hp: 200,
    sparks: 9999,
    xp: 99999,
    kills: 9999,
    beacons: 7,
    collected: 2 ** GLIMMERS.length - 1,
    checkpoint: 3,
  };
  for (const [key, max] of Object.entries(limits)) {
    if (!Number.isInteger(value[key]) || value[key] < 0 || value[key] > max) {
      return false;
    }
  }
  return (
    validSavedPosition(value) &&
    typeof value.boss === "boolean" &&
    typeof value.quest === "boolean"
  );
}

function validSavedPosition(value) {
  return (
    Number.isFinite(value.x) &&
    value.x >= 30 &&
    value.x <= WIDTH - 30 &&
    Number.isFinite(value.y) &&
    value.y >= 0 &&
    value.y <= 600
  );
}

export function levelOf(progress) {
  return Math.min(10, 1 + Math.floor(progress.xp / 45));
}

export function maxHealth(progress) {
  return 100 + (levelOf(progress) - 1) * 10;
}

export function collectGlimmers(actor) {
  const p = actor.progress;
  for (let i = 0; i < GLIMMERS.length; i++) {
    if ((p.collected & (1 << i)) !== 0) continue;
    const point = GLIMMERS[i];
    if (
      Math.abs(actor.sim.x - point[0]) > 35 ||
      Math.abs(actor.sim.y - 28 - point[1]) > 48
    ) {
      continue;
    }
    p.collected |= 1 << i;
    p.sparks++;
    p.xp += 3;
    actor.dirty = true;
    actor.event = { type: "collect", text: "+1 glimmer", n: ++actor.eventId };
  }
}

/** Beacon costs are paid once, in order. The final light also requires the warden. */
export function lightBeacon(actor, index) {
  const p = actor.progress;
  const beacon = BEACONS[index];
  if (
    !beacon ||
    Math.abs(actor.sim.x - beacon.x) > 90 ||
    Math.abs(actor.sim.y - beacon.y) > 85
  ) {
    return "Come closer to the beacon.";
  }
  if ((p.beacons & (1 << index)) !== 0) {
    p.hp = maxHealth(p);
    actor.dirty = true;
    return "The lantern warms you. Health restored.";
  }
  if (index > 0 && (p.beacons & (1 << (index - 1))) === 0) {
    return "Restore the earlier beacon first.";
  }
  if (index === 2 && !p.boss) {
    return "Quiet the Hollow Warden before kindling this light.";
  }
  if (p.sparks < beacon.cost) {
    return `Find ${beacon.cost - p.sparks} more glimmers to kindle this beacon.`;
  }
  p.sparks -= beacon.cost;
  p.beacons |= 1 << index;
  p.checkpoint = index + 1;
  p.xp += 20;
  p.hp = maxHealth(p);
  actor.dirty = true;
  return index === 2
    ? "The woodland is alight. You are a Keeper of the Wild!"
    : `${beacon.name} is alight. Your journey continues.`;
}
