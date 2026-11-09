/* The Arcade header and feedback remain in the parent, on arcade.fun. */
window.LanternwildTransfer = (async () => {
  const hash = new URLSearchParams(location.hash.slice(1));
  const ticket = hash.get("lanternwildTransfer");
  if (!ticket) return;
  history.replaceState(null, "", location.pathname + location.search);
  if (!/^[a-f0-9]{64}$/.test(ticket)) throw Error("Invalid keeper transfer.");
  const response = await fetch("/api/arcade-entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw Error("Keeper transfer expired. Reopen the woodland.");
  }
})();

if (parent !== window) {
  document.documentElement.dataset.arcadeHosted = "yes";
  window.LanternwildTransfer.then(() => {
    parent.postMessage(
      {
        type: "arcade:hosted-state",
        game: "lanternwild",
        state: "external",
        ready: true,
      },
      "https://arcade.fun",
    );
  }).catch(() => {
    parent.postMessage(
      { type: "arcade:hosted-state", game: "lanternwild", action: "recover" },
      "https://arcade.fun",
    );
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || new URL(link.href).origin !== "https://arcade.fun") return;
    event.preventDefault();
    parent.postMessage(
      { type: "arcade:hosted-state", game: "lanternwild", action: "exit" },
      "https://arcade.fun",
    );
  });
}
