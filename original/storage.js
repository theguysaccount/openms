import { Database } from "bun:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { validateProgress } from "./progression.js";

export function openStorage(path) {
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=2000;");
  db.exec(
    "CREATE TABLE IF NOT EXISTS keepers (id TEXT PRIMARY KEY, token TEXT UNIQUE NOT NULL, progress TEXT NOT NULL, updated INTEGER NOT NULL)",
  );
  const read = db.query("SELECT id, progress FROM keepers WHERE token=?");
  const write = db.query("UPDATE keepers SET progress=?,updated=? WHERE id=?");
  const insert = db.query("INSERT INTO keepers VALUES(?,?,?,?)");
  return {
    find(token) {
      if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
        return null;
      }
      const row = read.get(hashToken(token));
      if (!row) return null;
      const progress = JSON.parse(row.progress);
      if (!validateProgress(progress)) {
        throw new Error("Stored keeper progress is invalid");
      }
      return { id: row.id, progress };
    },
    create(progress) {
      if (!validateProgress(progress)) throw new Error("Invalid new keeper");
      if (db.query("SELECT count(*) AS n FROM keepers").get().n >= 10000) {
        return null;
      }
      const token = randomBytes(32).toString("hex");
      const id = randomBytes(12).toString("hex");
      insert.run(id, hashToken(token), JSON.stringify(progress), Date.now());
      return { id, token, progress };
    },
    save(actor) {
      if (!validateProgress(actor.progress)) {
        throw new Error("Refusing invalid keeper save");
      }
      write.run(JSON.stringify(actor.progress), Date.now(), actor.id);
      actor.dirty = false;
    },
    close() {
      db.close();
    },
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
