# OpenMS for arcade.fun

This deployment runs a separate `openms-arcade` Fly app in `iad`. One shared CPU Machine owns the browser proxy, game authority and PostgreSQL; its `openms_data` volume is mounted at `/data`. The persistent volume starts at 20 GB. This is one world on one Machine; do not scale the Machine count with independent volumes.

The upstream source is [tensorfish/openms](https://github.com/tensorfish/openms) at commit `07994de02756356e3e025e3aca9e79433898d2c8`, with the arcade.fun integration changes included in this checkout. OpenMS is GPL-3.0-or-later. The matching source archive and license are served as `/arcade-source.tar.gz` and `/arcade-LICENSE.txt`; the Docker build generates the archive from the clean application source before installing dependencies. Original MapleStory WZ artwork, audio and data are separate from that source license and remain their owners' property, as explained in the upstream README.

## First deployment

Use the OpenMS repository as the build context. The Docker image pins Bun `1.4.4` and PostgreSQL `18.6-bookworm`, and installs the full frozen Bun dependency set because extraction imports `acorn` from the root development dependencies.

```sh
fly deploy --config fly.bootstrap.toml --wait-timeout 45m --ha=false
```

`fly.bootstrap.toml` explicitly selects two performance CPUs and 16 GB RAM. During the actual first deployment, CLI `--vm-*` flags did not override the final configuration's `[[vm]]` block and a 2 GB Machine was created; use the bootstrap configuration directly rather than depending on those flags. Provision `openms_data` in `iad` before deployment if it does not already exist. The configuration can also create a 20 GB initial volume. The startup script generates random database credentials directly on the volume; no database password belongs in a Docker build argument, source archive, deployment output or public client environment.

The final configuration targets 2 GB RAM. A successful local extraction took 163.95 seconds, reached 4.18 GB maximum resident memory, and reported a 10.28 GB peak memory footprint. Use 16 GB RAM for first-bootstrap headroom, with a CPU size that supports that memory allocation. After `/data/extraction.complete` exists, the production game is ready, and its working memory has been measured, reduce the Machine memory if 2 GB is sufficient:

```sh
fly deploy --config fly.arcade.toml --wait-timeout 15m --ha=false
```

Fly shared CPUs support up to 2 GB per CPU; the temporary 16 GB bootstrap uses two performance CPUs. After measuring the runtime, return both CPU kind/count and memory to the final shared-CPU target by deploying `fly.arcade.toml`, rather than leaving the bootstrap allocation active. Do not assume the target is sufficient until the production runtime has been measured. Both configurations use a 60-second HTTP-check grace; the first asset conversion can take much longer, so the initial deployment allows a 45-minute readiness wait. Keep the bootstrap Machine running and inspect its logs while the first health check is waiting. Fly's current sizing options are described in its [Machine configuration reference](https://fly.io/docs/reference/configuration/#the-vm-section) and [resource pricing table](https://fly.io/docs/about/pricing/).

## Startup and persistence

The owned bootstrap stages are explicit:

1. Start PostgreSQL on `127.0.0.1:55432` with SCRAM host authentication, 40 connections and 32 MB shared buffers. Only the local `openms` database/role is admitted over TCP. The application role has no superuser, database-creation, role-creation or replication privilege. PostgreSQL administration uses a private local socket and the `postgres` OS user.
2. Apply numbered SQL migrations with `bun --smol tools/migrate.js --database-url URL`. The URL is passed privately from the persisted credentials; it is never printed.
3. On the first bootstrap, download the upstream HTTPS ZIP resumably to the volume, verify its pinned SHA-256, and extract only explicitly listed, top-level `Maplestory-Client/*.wz` members. Executables and DLLs are excluded.
4. Run `bun --smol client/tools/extract.js --assets /data/assets/Maplestory-Client --preflight-report /data/cache/preflight.json`. Reuse completed generated assets only when the completion marker matches both the original ZIP hash and the extraction-source hash. An interrupted extraction creates no success marker and retries incrementally on restart.
5. Start the production authority on loopback port 3200 and the production browser proxy on `0.0.0.0:8080`, with the exact origin `https://openms-arcade.fly.dev` and no Studio origin. Production does not seed the published development accounts. Use the normal account-registration flow.

`client/public/generated` points to `/data/generated`; `client/.cache` points to `/data/cache`. PostgreSQL data, credentials, the original ZIP/WZ files, generated assets, extraction cache, preflight report and `/data/bootstrap.log` persist across image replacement. PostgreSQL-specific diagnostics are in `/data/postgres/server.log`. Tini reaps child processes; the bootstrap trap stops its active worker, both game processes and PostgreSQL on shutdown or failure.

The ZIP is pinned to `https://bucket.openms.dev/Maplestory-Assets.zip`, 1,765,661,358 bytes, SHA-256 `3aa8979738b571f2eae325e5fc01c9ab146247ba18a24bfbf5355e62b8ff710e`. These values are recorded in `assets.url` and `assets.sha256`. The original archive remains on the volume for verified recovery. A partial `.zip.part` resumes on the next launch; a checksum mismatch fails startup. Remove only the corrupt partial/archive after reviewing that failure, then restart to download it again.

The volume must have room for the ZIP, original WZ files, generated browser assets, extraction cache, PostgreSQL and logs. Bootstrap has bounded download retries and a one-hour download deadline. Conversion runtime and peak memory depend on the supported content; the default world extraction is used, not a promised full original-game conversion. Content expansion may require a larger volume or bootstrap Machine. A production world also needs a backup/recovery plan for the PostgreSQL data and its matching volume credentials.

## Review and validation

Configuration-only checks do not launch a server or modify cloud resources:

```sh
bash -n deploy/arcade/bootstrap.sh
fly config validate --config fly.arcade.toml
fly config validate --config fly.bootstrap.toml
```

The deployment uses a single persistent Machine. Avoid a Fly release command for migrations: release Machines do not mount the application volume. Shutdown/restart and database recovery happen through the same bootstrap owner.
