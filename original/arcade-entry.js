import { randomBytes } from "node:crypto";

const MAX_TRANSFERS = 512;
const TRANSFER_TTL = 60000;

/** One-use proofs move an existing keeper between this game's two exact hosts. */
export function keeperTransfers(now = Date.now) {
  const pending = new Map();
  return {
    issue(cookie) {
      for (const [key, value] of pending) {
        if (value.expires <= now()) pending.delete(key);
      }
      if (!/^[a-f0-9]{64}$/.test(cookie) || pending.size >= MAX_TRANSFERS) {
        return "";
      }
      const ticket = randomBytes(32).toString("hex");
      pending.set(ticket, { cookie, expires: now() + TRANSFER_TTL });
      return ticket;
    },
    consume(ticket) {
      if (typeof ticket !== "string" || !/^[a-f0-9]{64}$/.test(ticket)) {
        return "";
      }
      const value = pending.get(ticket);
      pending.delete(ticket);
      return value && value.expires > now() ? value.cookie : "";
    },
  };
}
