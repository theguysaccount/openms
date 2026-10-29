import { expect, test } from "bun:test";
import { createActor, createEncounter, stepWorld } from "../game.js";
import { newProgress } from "../progression.js";
import { emptyInput, PLATFORMS } from "../world.js";
const a = createActor("journey", newProgress("Journey Keeper"));
const actors = new Map([[a.id, a]]),
  e = createEncounter();
function tick(controls = {}) {
  Object.assign(a.input, emptyInput(), controls);
  a.lastInput = e.time;
  stepWorld(actors, e);
}
function idle(n = 20) {
  for (let i = 0; i < n; i++) tick();
}

function go(x) {
  for (let i = 0; i < 1500; i++) {
    const dx = x - a.sim.x;
    if (Math.abs(dx) < 8 && Math.abs(a.sim.vx) < 65) {
      idle(4);
      return;
    }
    const p = PLATFORMS[a.sim.footholdId - 1];
    const jump = Boolean(
      p && a.sim.footholdId <= 3 && dx > 0 && a.sim.x > p[1] - 65,
    );
    const brake =
      dx * a.sim.vx > 0 && Math.abs(dx) < (a.sim.vx * a.sim.vx) / 3900 + 8;
    tick({
      left: dx < 0 && !brake,
      right: dx > 0 && !brake,
      jump,
      jumpPressed: jump,
    });
  }
  throw Error("walk timed out " + x);
}
function climb(y) {
  for (let i = 0; i < 500; i++) {
    if (a.sim.y <= y && a.sim.state !== "ladder") {
      idle(15);
      return;
    }
    tick({ up: true });
  }
  throw Error("climb timed out " + y);
}
function fight(id) {
  for (let i = 0; i < 2500; i++) {
    const enemy = e.enemies[id];
    if (enemy.hp <= 0) {
      idle();
      return;
    }
    const dx = enemy.x - a.sim.x;
    tick({ left: dx < -65, right: dx > 65, attack: true, cast: true });
  }
  throw Error("fight timed out " + id);
}
test("the complete chapter can be finished using only normal movement and action inputs", () => {
  idle();
  tick({ interact: true });
  go(420);
  climb(449);
  go(365);
  go(555);
  go(730);
  climb(344);
  go(780);
  tick({ interact: true });
  go(1180);
  fight(0);
  go(1690);
  fight(1);
  go(2200);
  climb(339);
  go(2280);
  tick({ interact: true });
  go(3400);
  fight(5);
  go(3920);
  fight(8);
  go(4320);
  tick({ interact: true });
  expect(a.progress.beacons).toBe(7);
  expect(a.progress.boss).toBe(true);
  expect(a.sim.diagnostics.fault).toBeNull();
});
