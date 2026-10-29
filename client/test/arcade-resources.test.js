import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStaticResources } from "../tools/static-resources.js";

/** Keep source delivery separate from private configuration and generated assets. */
test("Arcade serves the exact source and license resources in production", async () => {
  const root = await mkdtemp(join(tmpdir(), "openms-source-"));
  try {
    const directory = join(root, "public/arcade");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "arcade-source.tar.gz"), "source bytes");
    await writeFile(join(directory, "arcade-LICENSE.txt"), "GPL license");
    await writeFile(join(directory, ".env.server"), "private");
    const resources = createStaticResources({
      root,
      siteRoot: join(root, "dist/site"),
      html: "<title>Game</title>",
    });
    const source = await resources.fetch(
      new Request("http://game/arcade-source.tar.gz"),
    );
    expect(source.status).toBe(200);
    expect(await source.text()).toBe("source bytes");
    const license = await resources.fetch(
      new Request("http://game/arcade-LICENSE.txt"),
    );
    expect(await license.text()).toBe("GPL license");
    const privateFile = await resources.fetch(
      new Request("http://game/.env.server"),
    );
    expect(privateFile.status).toBe(404);
    const write = await resources.fetch(
      new Request("http://game/arcade-source.tar.gz", { method: "POST" }),
    );
    expect(write.status).toBe(405);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** An allowlisted source filename still cannot follow a link out of its public root. */
test("Arcade source delivery refuses symlink escapes", async () => {
  const root = await mkdtemp(join(tmpdir(), "openms-source-"));
  try {
    const directory = join(root, "public/arcade");
    await mkdir(directory, { recursive: true });
    await writeFile(join(root, "private"), "private");
    await symlink(
      join(root, "private"),
      join(directory, "arcade-source.tar.gz"),
    );
    const resources = createStaticResources({ root, html: "Game" });
    const response = await resources.fetch(
      new Request("http://game/arcade-source.tar.gz"),
    );
    expect(response.status).toBe(403);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
