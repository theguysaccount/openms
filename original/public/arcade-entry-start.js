/* A same-origin fetch after navigation restores the old Strict cookie context. */
async function continueInArcade() {
  try {
    const response = await fetch("/api/arcade-entry-ticket", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw Error("The woodland could not reconnect.");
    const { ticket } = await response.json();
    if (ticket !== "" && !/^[a-f0-9]{64}$/.test(ticket)) {
      throw Error("The keeper proof could not be verified.");
    }
    location.replace(
      "https://arcade.fun/play/lanternwild?woodlandEntry=1" +
        (ticket ? "#lanternwildTransfer=" + ticket : ""),
    );
  } catch {
    document.getElementById("transfer-status").textContent =
      "Your keeper is kept. Retry to continue in Arcade.";
    document.getElementById("transfer-retry").hidden = false;
  }
}
document.getElementById("transfer-retry").onclick = () => location.reload();
continueInArcade();
