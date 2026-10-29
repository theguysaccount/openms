import { emptyInput } from "/world.js";
import { createRenderer } from "/render.js";
import { createSound } from "/sound.js";
import {
  closePanel,
  panelOpen,
  showHelp,
  showJournal,
  showSatchel,
  updateHud,
} from "/hud.js";

const $ = (id) => document.getElementById(id);
const input = emptyInput();
const sound = createSound();
const background = new Image();
background.src = "/art/woodland.png";
const renderer = createRenderer($("world"), background);
const keyActions = new Map([
  ["ArrowLeft", "left"],
  ["KeyA", "left"],
  ["ArrowRight", "right"],
  ["KeyD", "right"],
  ["ArrowUp", "up"],
  ["KeyW", "up"],
  ["ArrowDown", "down"],
  ["KeyS", "down"],
  ["Space", "jump"],
  ["KeyJ", "attack"],
  ["KeyK", "cast"],
  ["KeyE", "interact"],
]);
const heldCodes = new Set();
const edgeActions = new Set(["jump", "attack", "cast"]);
let state = {},
  socket = null,
  started = false,
  frameId = 0,
  eventId = 0;
let keeper = null,
  loaded = false,
  lastFrame = 0,
  lastHud = 0;

function drawFrame(time) {
  if (document.hidden) {
    frameId = 0;
    return;
  }
  if (time - lastFrame >= 16) {
    renderer.draw(state, time);
    lastFrame = time;
  }
  frameId = requestAnimationFrame(drawFrame);
}
frameId = requestAnimationFrame(drawFrame);

async function loadKeeper() {
  try {
    const response = await fetch("/api/keeper");
    if (!response.ok) {
      throw new Error("The woodland is unavailable. Please try again shortly.");
    }
    const result = await response.json();
    keeper = result.keeper;
    loaded = true;
    if (keeper) {
      $("new-keeper").hidden = true;
      $("keeper-name").required = false;
      $("returning").hidden = false;
      $("returning").textContent =
        `Welcome back, ${keeper.name}. Your lantern is waiting.`;
    }
    $("enter").textContent = keeper
      ? "Continue your journey ↗"
      : "Enter the woodland ↗";
    $("enter").disabled = false;
  } catch (error) {
    $("join-error").textContent = error.message;
    $("enter").textContent = "Retry connection ↗";
    $("enter").disabled = false;
  }
}

async function join(event) {
  event.preventDefault();
  if (!loaded) {
    await loadKeeper();
    return;
  }
  $("join-error").textContent = "";
  $("enter").disabled = true;
  $("enter").textContent = "Finding your path…";
  try {
    if (!keeper) {
      const name = $("keeper-name").value.trim();
      const color = Number(new FormData($("join-form")).get("color"));
      const response = await fetch("/api/keeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Could not create your keeper.");
      }
      keeper = result.keeper;
    }
    connect();
  } catch (error) {
    joinFailed(error.message);
  }
}

function joinFailed(message) {
  $("join-error").textContent = message;
  $("enter").disabled = false;
  $("enter").textContent = "Try again ↗";
}

function connect() {
  if (socket && socket.readyState < 2) return;
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/socket`,
  );
  socket.addEventListener("message", receiveWorld);
  socket.addEventListener("close", disconnected);
  socket.addEventListener("error", connectionError);
  $("rejoin").disabled = true;
  $("rejoin").textContent = "Reconnecting…";
}

function receiveWorld(event) {
  let next;
  try {
    next = JSON.parse(event.data);
  } catch {
    socket.close(1002, "Unreadable world update");
    return;
  }
  if (next.type !== "world" || !Array.isArray(next.players) || !next.progress) {
    return;
  }
  retainPresentation(next);
  state = next;
  if (!started || !$("reconnect").hidden) enterWorld();
  if (Date.now() - lastHud > 120) {
    updateHud(state);
    lastHud = Date.now();
  }
  if (state.event && state.event.n !== eventId) {
    eventId = state.event.n;
    sound.event(state.event.type);
  }
  $("connection").textContent = "Connected to the woodland";
}

function retainPresentation(next) {
  for (const player of next.players) {
    const previous = state.players?.find((entry) => entry.id === player.id);
    player.drawX = previous?.drawX ?? player.x;
    player.drawY = previous?.drawY ?? player.y;
    if (Math.abs(player.drawX - player.x) > 220) player.drawX = player.x;
    if (Math.abs(player.drawY - player.y) > 220) player.drawY = player.y;
  }
}

function enterWorld() {
  started = true;
  eventId = 0;
  $("welcome").hidden = true;
  $("hud").hidden = false;
  $("reconnect").hidden = true;
  $("rejoin").disabled = false;
  $("rejoin").textContent = "Reconnect";
  updateHud(state);
  $("world").focus();
}

function disconnected(event) {
  clearInput();
  $("connection").textContent = "Connection paused";
  if (!started) {
    joinFailed(
      "Could not enter the woodland. It may be full or restarting. Try again shortly.",
    );
    return;
  }
  $("reconnect").hidden = false;
  $("rejoin").disabled = false;
  $("rejoin").textContent = "Reconnect";
  $("reconnect-reason").textContent =
    event.reason || "Your saved journey is safe. Reconnect to continue.";
}

function connectionError() {
  $("connection").textContent = "Connection unavailable";
}

function sendInput() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(input));
  input.jumpPressed = false;
  input.attackPressed = false;
  input.castPressed = false;
  input.interact = false;
}

function clearInput() {
  heldCodes.clear();
  Object.assign(input, emptyInput());
  sendInput();
}

function keydown(event) {
  if (!started || !$("reconnect").hidden) return;
  if (panelOpen()) {
    clearInput();
    return;
  }
  const action = keyActions.get(event.code);
  if (action) {
    event.preventDefault();
    if (heldCodes.has(event.code)) return;
    heldCodes.add(event.code);
    input[action] = true;
    if (edgeActions.has(action)) input[`${action}Pressed`] = true;
    sendInput();
    return;
  }
  if (event.repeat) return;
  if (event.code === "KeyI") {
    clearInput();
    showSatchel();
  }
  if (event.code === "KeyQ") {
    clearInput();
    showJournal();
  }
  if (event.code === "KeyH") {
    clearInput();
    showHelp();
  }
}

function keyup(event) {
  heldCodes.delete(event.code);
  const action = keyActions.get(event.code);
  if (!action) return;
  input[action] = false;
  for (const code of heldCodes) {
    if (keyActions.get(code) === action) input[action] = true;
  }
  sendInput();
}

async function toggleSound() {
  try {
    const enabled = await sound.toggle();
    $("sound").textContent = enabled ? "Sound on" : "Sound off";
    $("sound").setAttribute("aria-pressed", String(enabled));
  } catch {
    $("sound").textContent = "Sound unavailable";
  }
}

function visibility() {
  clearInput();
  if (!document.hidden && !frameId) frameId = requestAnimationFrame(drawFrame);
}

const inputTimer = setInterval(sendInput, 100);
$("join-form").addEventListener("submit", join);
$("sound").addEventListener("click", toggleSound);
$("rejoin").addEventListener("click", connect);
$("world").addEventListener("pointerdown", function focusWorld() {
  $("world").focus();
});
$("panel").addEventListener("close", clearInput);
window.addEventListener("keydown", keydown);
window.addEventListener("keyup", keyup);
window.addEventListener("blur", clearInput);
document.addEventListener("visibilitychange", visibility);
window.addEventListener(
  "pagehide",
  function teardown() {
    clearInterval(inputTimer);
    clearInput();
    socket?.close(1000, "Keeper left the woodland");
    cancelAnimationFrame(frameId);
    renderer.close();
    closePanel();
    sound.close().catch(function audioError(error) {
      console.warn("Audio close failed", error.message);
    });
  },
  { once: true },
);
loadKeeper();
