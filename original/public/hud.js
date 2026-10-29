import { BEACONS, REGIONS, WIDTH } from "/world.js";

const $ = (id) => document.getElementById(id);
const panel = $("panel"),
  body = $("panel-body");
let current = null,
  toastUntil = 0,
  lastEvent = 0;

export function updateHud(state) {
  current = state;
  const p = state.progress;
  const level = Math.min(10, 1 + Math.floor(p.xp / 45));
  const maxHp = 100 + (level - 1) * 10;
  setText("player-name", p.name);
  setText("player-level", `LEVEL ${level} · LANTERN KEEPER`);
  setText("health-text", `${p.hp} / ${maxHp} health`);
  $("health-fill").style.width = `${Math.max(0, (p.hp / maxHp) * 100)}%`;
  $("energy-fill").style.width = `${state.energy}%`;
  setText("sparks", `${p.sparks} ✧`);
  setText(
    "region",
    REGIONS.find((region) => p.x < region.until)?.name ?? "The Hollow Crown",
  );
  setText(
    "online",
    `${state.players.length} keeper${state.players.length === 1 ? "" : "s"} wandering`,
  );
  setText(
    "beacon-progress",
    BEACONS.map((_b, i) => (p.beacons & (1 << i) ? "✦" : "○")).join("　"),
  );
  setText("objective", objective(p));
  $("journey-fill").style.width = `${Math.min(100, (p.x / WIDTH) * 100)}%`;
  updateInteraction(p);
  const event = state.event;
  if (event && event.n !== lastEvent) {
    lastEvent = event.n;
    showToast(event);
  }
  if (Date.now() > toastUntil) $("toast").classList.remove("visible");
}

function setText(id, value) {
  const node = $(id);
  if (node.textContent !== value) node.textContent = value;
}

function objective(p) {
  if (!p.quest) return "Speak to Rowan at the dock";
  if (p.beacons === 7) return "The woodland is alight. Explore freely.";
  if (!(p.beacons & 1)) return "Kindle the beacon above Thistledock";
  if (!(p.beacons & 2)) return "Restore the Amber Canopy beacon";
  return p.boss ? "Kindle the final beacon" : "Quiet the Hollow Warden";
}

function updateInteraction(p) {
  let text = "";
  if (Math.abs(p.x - 235) < 85 && Math.abs(p.y - 570) < 85) {
    text = "Speak to Rowan · Rest";
  }
  for (let i = 0; i < BEACONS.length; i++) {
    const beacon = BEACONS[i];
    if (Math.abs(p.x - beacon.x) < 90 && Math.abs(p.y - beacon.y) < 85) {
      text =
        p.beacons & (1 << i)
          ? "Rest at the beacon"
          : `Kindle beacon · ${beacon.cost} glimmers`;
    }
  }
  $("interaction").hidden = !text;
  if (text) $("interaction").lastElementChild.textContent = text;
}

function showToast(event) {
  if (event.type === "hit") return;
  $("toast").textContent = event.text;
  $("toast").classList.add("visible");
  toastUntil = Date.now() + (event.type === "dialogue" ? 9000 : 3500);
}

function showPanel(html) {
  body.innerHTML = html;
  if (!panel.open) panel.showModal();
}

export function showHelp() {
  showPanel(`<p class="eyebrow">FIELD NOTES</p><h2>A little light goes a long way.</h2>
    <p>Move with <kbd>← →</kbd> or <kbd>A D</kbd>. Jump with <kbd>Space</kbd>. Climb the rope ladders with <kbd>↑ ↓</kbd> or <kbd>W S</kbd>. Drop through a ledge with <kbd>↓ Space</kbd>.</p>
    <p>Sweep nearby briarlings with <kbd>J</kbd>. Cast a lantern bolt with <kbd>K</kbd>. Lantern energy replenishes on its own. Walk into floating glimmers to collect them.</p>
    <p>Press <kbd>E</kbd> beside Rowan or a beacon. Restore the three beacons in order. Beacons restore health and remember your checkpoint. Quiet the Hollow Warden to kindle the last light.</p>
    <p><kbd>I</kbd> opens your satchel. <kbd>Q</kbd> opens the journal. Closing the tab saves your keeper. Returning in this browser continues your journey; clearing its cookies loses access to this guest keeper.</p>
    <h3>Original world. Open roots.</h3><p>Lanternwild is an original arcade.fun prototype. Movement and collision use GPL-3.0-or-later code by Tensorfish and OpenMS contributors. The world, characters, interface, quests, scenery and synthesized sound are newly authored for Lanternwild. Environment painting generated for this project.</p>
    <p><a href="/lanternwild-source.tar.gz">Download this build’s source</a> · <a href="/LICENSE.txt">GPL license</a> · <a href="/ASSETS.md">Asset provenance</a> · <a href="https://github.com/tensorfish/openms" target="_blank" rel="noopener noreferrer">OpenMS upstream</a></p>`);
}

export function showJournal() {
  if (!current) {
    showHelp();
    return;
  }
  const p = current.progress;
  showPanel(`<p class="eyebrow">KEEPER’S JOURNAL</p><h2>The light we carry</h2>
    <p>“The beacons are more than lanterns,” Rowan told you. “They are the woodland’s way of remembering we are here.”</p>
    <p>Gather glimmers from the branches and from briarlings. Restore the lights in order, then bring peace to the Hollow Warden.</p>
    ${BEACONS.map((beacon, i) => `<div class="quest-step"><strong>${i + 1}. ${beacon.name}</strong><span>${p.beacons & (1 << i) ? "✦ Alight" : `${beacon.cost} glimmers`}</span></div>`).join("")}
    <div class="quest-step"><strong>The Hollow Warden</strong><span>${p.boss ? "At peace" : "Waiting in the eastern grove"}</span></div>
    <p>${p.beacons === 7 ? "You have restored the woodland. Thank you, Keeper of the Wild. This first chapter is complete; you can keep wandering." : objective(p)}</p>`);
}

export function showSatchel() {
  if (!current) {
    showHelp();
    return;
  }
  const p = current.progress;
  const level = Math.min(10, 1 + Math.floor(p.xp / 45));
  showPanel(`<p class="eyebrow">THE KEEPER’S SATCHEL</p><h2>A pocketful of wonder.</h2>
    <div class="satchel-grid"><div class="satchel-item"><b>${p.sparks} ✧</b><small>Glimmers gathered</small></div><div class="satchel-item"><b>${level}</b><small>Keeper level · ${p.xp} XP</small></div><div class="satchel-item"><b>${p.kills}</b><small>Creatures quieted</small></div><div class="satchel-item"><b>${BEACONS.filter((_b, i) => p.beacons & (1 << i)).length} / 3</b><small>Beacons restored</small></div></div>
    <h3>Your first lantern</h3><p>A brass lantern, a travelling cloak, and a sweep of warm light. Every 45 XP strengthens your keeper. Briarlings restore a little health when defeated; lit beacons restore it fully.</p><small>Progress is saved on the game server and linked to this browser’s keeper cookie.</small>`);
}

export function panelOpen() {
  return panel.open;
}
export function closePanel() {
  panel.close();
}
$("panel-close").addEventListener("click", closePanel);
$("help").addEventListener("click", showHelp);
$("quest-toggle").addEventListener("click", showJournal);
$("bag").addEventListener("click", showSatchel);
