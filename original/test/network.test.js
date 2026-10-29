import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyInput } from "../world.js";

const origin = "http://127.0.0.1:3115";
const directory = mkdtempSync(join(tmpdir(), "lanternwild-test-"));
const serverPath = new URL("../server.js", import.meta.url).pathname;
const child = Bun.spawn(
  [
    process.execPath,
    serverPath,
    "--port",
    "3115",
    "--origin",
    origin,
    "--data",
    join(directory, "keepers.sqlite"),
  ],
  { stdout: "ignore", stderr: "inherit" },
);
const peers = [];

beforeAll(async () => {
  let lastError;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${origin}/api/health`)).ok) return;
    } catch (error) {
      lastError = error;
    }
    await Bun.sleep(20);
  }
  throw lastError ?? new Error("Game server did not become ready");
});

afterAll(async () => {
  for (const peer of peers) peer.ws.close();
  child.kill("SIGTERM");
  await child.exited;
  rmSync(directory, { recursive: true, force: true });
});

async function createPeer(name) {
  const response = await fetch(`${origin}/api/keeper`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ name, color: 0 }),
  });
  expect(response.status).toBe(201);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const ws = new WebSocket("ws://127.0.0.1:3115/socket", {
    headers: { Origin: origin, Cookie: cookie },
  });
  const peer = { ws, cookie, state: null, closeCode: null };
  ws.addEventListener("message", (event) => {
    peer.state = JSON.parse(event.data);
  });
  ws.addEventListener("close", (event) => {
    peer.closeCode = event.code;
  });
  peers.push(peer);
  await waitFor(() => peer.state !== null);
  return peer;
}

async function waitFor(condition) {
  for (let i = 0; i < 100; i++) {
    if (condition()) return;
    await Bun.sleep(30);
  }
  throw new Error("Expected game state did not arrive");
}

test("retired assets, credentials, old APIs and arbitrary files are inaccessible", async () => {
  for (const path of [
    "/generated/catalog.json",
    "/openms-icon.png",
    "/dist/online/main.js",
    "/.env",
    "/data/lanternwild.sqlite",
    "/api/auth/register",
    "/server.js",
  ]) {
    expect((await fetch(origin + path)).status).toBe(404);
  }
  const health = await (await fetch(`${origin}/api/health`)).json();
  expect(health.legacyAssets).toBe(false);
  expect((await fetch(origin + "/world.js")).status).toBe(200);
  const wrongOrigin = await fetch(origin + "/api/keeper", {
    method: "POST",
    headers: { Origin: "https://other.example" },
    body: "{}",
  });
  expect(wrongOrigin.status).toBe(403);
});

test("real network inputs move and jump; peers observe; reconnect preserves progress", async () => {
  const first = await createPeer("First Keeper");
  const second = await createPeer("Second Keeper");
  await waitFor(() => first.state.players.length === 2);
  const initial = first.state.progress.x;
  const input = emptyInput();
  input.right = true;
  first.ws.send(JSON.stringify(input));
  await waitFor(() => first.state.progress.x > initial + 90);
  input.right = false;
  input.jump = true;
  input.jumpPressed = true;
  first.ws.send(JSON.stringify(input));
  await waitFor(
    () => first.state.players.find((p) => p.id === first.state.you).vy < -100,
  );
  const id = first.state.you;
  expect(
    second.state.players.some((p) => p.id === id && p.x > initial + 70),
  ).toBe(true);
  const tap = emptyInput();
  tap.attackPressed = true;
  tap.castPressed = true;
  first.ws.send(JSON.stringify(tap));
  first.ws.send(JSON.stringify(emptyInput()));
  await waitFor(() => first.state.energy < 90);
  expect(first.state.players.find((p) => p.id === id).swing).toBe(1);
  first.ws.close();
  await waitFor(() => first.closeCode !== null);
  await Bun.sleep(60);
  const saved = await (
    await fetch(origin + "/api/keeper", { headers: { Cookie: first.cookie } })
  ).json();
  expect(saved.keeper.x).toBeGreaterThan(initial + 70);
  const joined = new WebSocket("ws://127.0.0.1:3115/socket", {
    headers: { Origin: origin, Cookie: first.cookie },
  });
  const resumed = { state: null, ws: joined };
  peers.push(resumed);
  joined.addEventListener("message", (event) => {
    resumed.state = JSON.parse(event.data);
  });
  await waitFor(() => resumed.state !== null);
  expect(resumed.state.you).toBe(id);
  expect(resumed.state.progress.name).toBe("First Keeper");
});
