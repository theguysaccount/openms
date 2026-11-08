import { expect, test } from "bun:test";
import { keeperTransfers } from "../arcade-entry.js";

test("keeper transfers are unguessable, single-use and expire after one minute", () => {
  let now = 0;
  const transfers = keeperTransfers(() => now);
  const cookie = "a".repeat(64);
  const first = transfers.issue(cookie);
  const second = transfers.issue(cookie);
  expect(first).toMatch(/^[a-f0-9]{64}$/);
  expect(first).not.toBe(second);
  expect(transfers.consume("bad")).toBe("");
  expect(transfers.consume(first)).toBe(cookie);
  expect(transfers.consume(first)).toBe("");
  now = 60000;
  expect(transfers.consume(second)).toBe("");
});

test("the transfer queue is bounded and rejects invalid session cookies", () => {
  const transfers = keeperTransfers(() => 0);
  expect(transfers.issue("invalid")).toBe("");
  for (let i = 0; i < 512; i++) {
    expect(transfers.issue("b".repeat(64))).not.toBe("");
  }
  expect(transfers.issue("b".repeat(64))).toBe("");
});
