# Lanternwild

An original woodland adventure for arcade.fun, built on OpenMS's GPL-3.0-or-later
movement/collision implementation. The original world, movement coefficients,
character and creature drawings, scenery, interface, quests and sound are authored
for this game. No MapleStory assets, extracted data, maps, dialogue, sound recordings,
original client or game definitions are loaded or served by this runtime.

## Play and develop

With Bun 1.4.4, from the repository root:

```sh
bun original/server.js --host 127.0.0.1 --port 3114 --origin http://127.0.0.1:3114 --data /absolute/path/to/lanternwild.sqlite
```

Omit `--data` for a temporary in-memory world. Open the exact configured origin.
No dependencies, extraction, legacy database or external asset download is needed.
Arrow keys or WASD move/climb, Space jumps, J sweeps, K casts, E interacts,
I opens the satchel and Q opens the journal. Sound is synthesized after explicit
opt-in. The desktop minimum is 800px; phones receive a useful desktop notice.

The first chapter covers three connected woodland regions and three beacons.
The last beacon requires defeating the Hollow Warden. Player positions, hits,
rewards, energy and quest eligibility are server-controlled. Connected keepers
share creatures; each contributor to a creature's defeat earns the reward.
Collectibles and beacons are personal progress. The instance admits at most 48
concurrent keepers; this is an admission limit, not a tested capacity claim.

Guest keeper access uses an opaque Secure/HttpOnly/SameSite=Strict cookie on the
production HTTPS origin. SQLite stores the token's SHA-256 and progress; there
are no passwords. Saves occur every 4.8 seconds, on disconnect and on graceful
shutdown. Closing or restarting the game resumes the same keeper in that browser.
Clearing cookies loses access; cross-device accounts and guest recovery are not
implemented. A second tab takes over the same keeper and closes the older session.

## Code, assets and deployment

Retain the root GPL license and the OpenMS attribution. The selected OpenMS
implementation is `client/src/physics/`; `original/` supplies a new rendering,
networking, gameplay, persistence and presentation layer. This is a focused first
chapter, not a full conversion of every upstream RPG system. New code is
GPL-3.0-or-later; see `public/ASSETS.md` for original art provenance and rights.

`Dockerfile.lanternwild` copies only these selected code paths and the root license.
It creates the exact corresponding source at `/lanternwild-source.tar.gz`.
It does not copy or launch the legacy extractor, original assets, game definitions,
client or database. HTTP serves only an explicit list of files in `original/public/`,
`world.js`, and `LICENSE`; `/generated/`, old APIs, dotfiles and paths outside this
allowlist return 404. The legacy volume is retained privately for the owner's data;
the new server uses only `/data/lanternwild.sqlite` and cannot route HTTP to that volume.

Deploy from this checkout with `fly deploy --config fly.arcade.toml --remote-only --ha=false`.
The `openms-arcade` infrastructure hostname is retained, but it now serves only
Lanternwild. The old machine was stopped with autostart disabled before development.
Do not use `fly.bootstrap.toml` or `Dockerfile.arcade` to republish the retired build.

Focused verification: `bun test original/test` and the changed-file ESLint and
Prettier checks. Native browser acceptance must cover movement, jumping, collecting,
combat, beacons, the last encounter, reconnect/save, multiplayer and absent legacy
network requests before publishing.
