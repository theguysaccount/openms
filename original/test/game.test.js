import { expect, test } from "bun:test";
import {
  advanceSimulation,
  relocateSimulation,
} from "../../client/src/physics/simulation.js";
import { createActor, createEncounter, stepWorld } from "../game.js";
import { lightBeacon, newProgress, validateProgress } from "../progression.js";
import { BEACONS, GLIMMERS, createWorld, emptyInput } from "../world.js";
import { openStorage } from "../storage.js";

test("authored world supports OpenMS walking, ground jumps and landings", () => {
  const actor = createActor("test", newProgress("Keeper"));
  const input = emptyInput();
  for (let i = 0; i < 20; i++) advanceSimulation(actor.sim, input, 30);
  expect(actor.sim.state).toBe("ground");
  input.right = true;
  for (let i = 0; i < 20; i++) advanceSimulation(actor.sim, input, 30);
  expect(actor.sim.x).toBeGreaterThan(300);
  input.jump = true;
  input.jumpPressed = true;
  advanceSimulation(actor.sim, input, 30);
  expect(actor.sim.vy).toBeLessThan(0);
  expect(actor.sim.state).toBe("air");
  expect(actor.sim.diagnostics.fault).toBeNull();
  expect(createWorld().footholds.length).toBe(13);
});

test("beacons reject distant, out-of-order, unpaid and uncleared interactions", () => {
  const actor = createActor("test", newProgress("Keeper"));
  actor.progress.sparks = 100;
  expect(lightBeacon(actor, 0)).toContain("closer");
  relocateSimulation(actor.sim, BEACONS[1]);
  expect(lightBeacon(actor, 1)).toContain("earlier");
  relocateSimulation(actor.sim, BEACONS[0]);
  actor.progress.sparks = 0;
  expect(lightBeacon(actor, 0)).toContain("3 more");
  actor.progress.sparks = 20;
  lightBeacon(actor, 0);
  expect(actor.progress.sparks).toBe(17);
  lightBeacon(actor, 0);
  expect(actor.progress.sparks).toBe(17);
  relocateSimulation(actor.sim, BEACONS[1]);
  lightBeacon(actor, 1);
  relocateSimulation(actor.sim, BEACONS[2]);
  expect(lightBeacon(actor, 2)).toContain("Warden");
  actor.progress.boss = true;
  expect(lightBeacon(actor, 2)).toContain("Keeper of the Wild");
  expect(actor.progress.beacons).toBe(7);
  expect(actor.progress.sparks).toBe(4);
});

test("glimmers reward each keeper once and cannot be collected remotely", () => {
  const actor = createActor("test", newProgress("Keeper"));
  const actors = new Map([[actor.id, actor]]),
    encounter = createEncounter();
  stepWorld(actors, encounter);
  expect(actor.progress.sparks).toBe(0);
  relocateSimulation(actor.sim, { x: GLIMMERS[0][0], y: GLIMMERS[0][1] + 28 });
  stepWorld(actors, encounter);
  stepWorld(actors, encounter);
  expect(actor.progress.sparks).toBe(1);
  expect(actor.progress.collected & 1).toBe(1);
});

test("server combat checks reach and rewards contributors once per defeat", () => {
  const actor = createActor("test", newProgress("Keeper"));
  const actors = new Map([[actor.id, actor]]),
    encounter = createEncounter();
  actor.input.attack = true;
  stepWorld(actors, encounter);
  expect(encounter.enemies[0].hp).toBe(36);
  relocateSimulation(actor.sim, { x: 1120, y: 570 });
  for (let i = 0; i < 60; i++) {
    actor.lastInput = encounter.time;
    encounter.enemies[0].x = 1180;
    stepWorld(actors, encounter);
  }
  expect(actor.progress.kills).toBe(1);
  expect(actor.progress.sparks).toBe(2);
  expect(encounter.enemies[0].hp).toBe(0);
});

test("new saves round-trip through opaque sessions without legacy data", () => {
  const store = openStorage(":memory:");
  const keeper = store.create(newProgress("First Keeper", 2));
  const actor = createActor(keeper.id, keeper.progress);
  actor.progress.sparks = 12;
  actor.progress.beacons = 3;
  store.save(actor);
  expect(store.find(keeper.token).progress.sparks).toBe(12);
  expect(store.find(keeper.token).progress.beacons).toBe(3);
  expect(store.find("invalid")).toBeNull();
  expect(validateProgress({ ...actor.progress, collected: 2 ** 30 })).toBe(
    false,
  );
  expect(validateProgress({ ...actor.progress, x: NaN })).toBe(false);
  expect(validateProgress({ ...actor.progress, name: "<script>" })).toBe(false);
  store.close();
});
