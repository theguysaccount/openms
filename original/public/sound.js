/** Synthesized notes, not recordings or samples. Sound starts only on a user action. */
export function createSound() {
  let context = null,
    enabled = false;
  function note(frequency, duration, delay = 0) {
    if (!enabled || !context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.06, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.onended = function release() {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  return {
    async toggle() {
      if (!context) context = new AudioContext();
      enabled = !enabled;
      if (enabled) {
        await context.resume();
        note(440, 0.3);
        note(660, 0.4, 0.12);
      } else await context.suspend();
      return enabled;
    },
    event(type) {
      if (type === "collect") {
        note(880, 0.18);
        note(1174.66, 0.3, 0.08);
      }
      if (type === "hit") note(196, 0.1);
      if (type === "reward") {
        note(523.25, 0.3);
        note(659.25, 0.3, 0.12);
        note(783.99, 0.5, 0.24);
      }
      if (type === "dialogue") note(587.33, 0.25);
    },
    async close() {
      if (context) await context.close();
    },
  };
}
