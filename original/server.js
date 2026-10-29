import { readdirSync } from "node:fs";
import { resolve, extname } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { openStorage } from "./storage.js";
import { newProgress } from "./progression.js";
import {
  MAX_PLAYERS,
  createActor,
  createEncounter,
  snapshot,
  stepWorld,
} from "./game.js";
import { WORLD_VERSION, emptyInput } from "./world.js";

const options = parseArgs({
  options: {
    port: { type: "string", default: "3114" },
    host: { type: "string", default: "127.0.0.1" },
    origin: { type: "string", default: "http://127.0.0.1:3114" },
    data: { type: "string", default: ":memory:" },
  },
  strict: true,
  allowPositionals: false,
}).values;
const root = fileURLToPath(new URL("./public/", import.meta.url));
const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const storage = openStorage(options.data);
const actors = new Map();
const encounter = createEncounter();
const attempts = new Map();
const files = publicFiles(root);
const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
let stopping = false;

function publicFiles(directory) {
  const result = new Map();
  const pending = [directory];
  for (let i = 0; i < pending.length && i < 20; i++) {
    for (const entry of readdirSync(pending[i], { withFileTypes: true })) {
      const path = resolve(pending[i], entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile()) {
        result.set(`/${path.slice(directory.length)}`, path);
      }
      if (result.size > 200 || pending.length > 20) {
        throw new Error("Public asset limit exceeded");
      }
    }
  }
  result.set("/", resolve(directory, "index.html"));
  result.set("/world.js", resolve(sourceRoot, "original/world.js"));
  result.set("/LICENSE.txt", resolve(sourceRoot, "LICENSE"));
  return result;
}

function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...jsonHeaders, ...extra },
  });
}

function cookieToken(request) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.match(/(?:^|;\s*)lw_session=([a-f0-9]{64})(?:;|$)/)?.[1] ?? "";
}

function admitCreation(request, server) {
  const ip = server.requestIP(request)?.address ?? "unknown";
  const now = Date.now();
  let rate = attempts.get(ip);
  if (!rate || now - rate.start >= 60000) {
    if (attempts.size >= 2000 && !rate) return false;
    rate = { start: now, count: 0 };
    attempts.set(ip, rate);
  }
  return ++rate.count <= 8;
}

async function createKeeper(request, server) {
  if (request.headers.get("origin") !== options.origin) {
    return json({ error: "Open the game on its own host." }, 403);
  }
  const existing = storage.find(cookieToken(request));
  if (existing) return json({ keeper: existing.progress });
  if (!admitCreation(request, server)) {
    return json(
      { error: "Please wait a minute before creating another keeper." },
      429,
    );
  }
  const raw = await request.text();
  if (raw.length > 512) {
    return json({ error: "That request is too large." }, 413);
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return json({ error: "Use a valid keeper name." }, 400);
  }
  if (!validKeeper(value)) {
    return json(
      { error: "Use 2–18 letters, numbers, spaces, underscores or hyphens." },
      400,
    );
  }
  const keeper = storage.create(newProgress(value.name.trim(), value.color));
  if (!keeper) {
    return json({ error: "The woodland has reached its keeper limit." }, 503);
  }
  const secure = options.origin.startsWith("https:") ? "; Secure" : "";
  return json({ keeper: keeper.progress }, 201, {
    "Set-Cookie": `lw_session=${keeper.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`,
  });
}

function validKeeper(value) {
  return (
    value &&
    typeof value.name === "string" &&
    /^[A-Za-z0-9 _-]{2,18}$/.test(value.name.trim()) &&
    Number.isInteger(value.color) &&
    value.color >= 0 &&
    value.color <= 3
  );
}

function upgrade(request, server) {
  if (request.headers.get("origin") !== options.origin) {
    return json({ error: "Invalid game origin." }, 403);
  }
  const keeper = storage.find(cookieToken(request));
  if (!keeper) return json({ error: "Create your keeper first." }, 401);
  if (actors.size >= MAX_PLAYERS && !actors.has(keeper.id)) {
    return json({ error: "This woodland is full. Try again shortly." }, 503);
  }
  const old = actors.get(keeper.id);
  if (old) {
    storage.save(old);
    keeper.progress = old.progress;
    actors.delete(keeper.id);
    old.ws.close(4001, "Your keeper continued in another tab.");
  }
  return server.upgrade(request, {
    data: { keeper, actor: null, count: 0, window: 0 },
  })
    ? undefined
    : json({ error: "Connection failed." }, 400);
}

async function fetchRequest(request, server) {
  if (stopping) {
    return json({ error: "The woodland is resting. Reconnect shortly." }, 503);
  }
  const url = new URL(request.url);
  if (url.pathname === "/socket") return upgrade(request, server);
  if (url.pathname === "/api/health") {
    return json({
      ok: true,
      game: WORLD_VERSION,
      players: actors.size,
      legacyAssets: false,
    });
  }
  if (url.pathname === "/api/keeper" && request.method === "POST") {
    return createKeeper(request, server);
  }
  if (url.pathname === "/api/keeper" && request.method === "GET") {
    const keeper = storage.find(cookieToken(request));
    return json({ keeper: keeper?.progress ?? null });
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    return json({ error: "Method not allowed." }, 405);
  }
  return staticResponse(url.pathname, request.method);
}

function staticResponse(path, method) {
  const file = files.get(path);
  if (!file) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".gz": "application/gzip",
    ".txt": "text/plain",
    ".md": "text/plain",
  };
  const headers = {
    "Content-Type": types[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  };
  return new Response(method === "HEAD" ? null : Bun.file(file), { headers });
}

function onOpen(ws) {
  const keeper = ws.data.keeper;
  const actor = createActor(keeper.id, keeper.progress);
  actor.ws = ws;
  actor.lastInput = encounter.time;
  ws.data.actor = actor;
  actors.set(actor.id, actor);
  ws.send(JSON.stringify(snapshot(actor, actors, encounter)));
}

function onMessage(ws, raw) {
  const data = ws.data;
  const now = Date.now();
  if (now - data.window > 1000) {
    data.window = now;
    data.count = 0;
  }
  if (++data.count > 45 || typeof raw !== "string" || raw.length > 512) {
    ws.close(1008, "Input limit exceeded");
    return;
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    ws.close(1008, "Invalid input");
    return;
  }
  const actor = data.actor;
  if (!actor || actors.get(actor.id) !== actor) return;
  const keys = Object.keys(emptyInput());
  if (!value || keys.some((key) => typeof value[key] !== "boolean")) {
    ws.close(1008, "Invalid input");
    return;
  }
  assignInput(actor, value, keys);
  actor.lastInput = encounter.time;
}

function assignInput(actor, value, keys) {
  for (const key of keys) {
    if (key.endsWith("Pressed") || key === "interact") {
      actor.input[key] ||= value[key];
    } else actor.input[key] = value[key];
  }
}

function onClose(ws) {
  const actor = ws.data.actor;
  if (!actor || actors.get(actor.id) !== actor) return;
  storage.save(actor);
  actors.delete(actor.id);
}

const server = Bun.serve({
  hostname: options.host,
  port: Number(options.port),
  maxRequestBodySize: 1024,
  fetch: fetchRequest,
  error(error) {
    console.error("Request failed:", error.message);
    return json({ error: "The woodland could not finish that request." }, 500);
  },
  websocket: {
    maxPayloadLength: 512,
    idleTimeout: 30,
    sendPings: true,
    open: onOpen,
    message: onMessage,
    close: onClose,
  },
});
let tick = 0;
const timer = setInterval(function simulate() {
  if (actors.size === 0) return;
  stepWorld(actors, encounter);
  if (++tick % 2 === 0) {
    for (const actor of actors.values()) {
      if (actor.ws.getBufferedAmount() > 131072) {
        actor.ws.close(1013, "Connection is too slow. Rejoin to continue.");
        continue;
      }
      actor.ws.send(JSON.stringify(snapshot(actor, actors, encounter)));
    }
  }
  if (tick % 160 === 0) {
    for (const actor of actors.values()) storage.save(actor);
  }
}, 30);
const cleanup = setInterval(function clearAttempts() {
  for (const [key, rate] of attempts) {
    if (Date.now() - rate.start > 60000) attempts.delete(key);
  }
}, 60000);

async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  clearInterval(cleanup);
  for (const actor of actors.values()) {
    storage.save(actor);
    actor.ws.close(1001, "The woodland is resting. Reconnect shortly.");
  }
  await server.stop(true);
  storage.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
console.log(
  `Lanternwild ready on ${options.host}:${server.port}. Original content only.`,
);
