# CodeCast

A live-coding classroom. The instructor starts a **cast**, shares its link or QR code, and everyone
watching sees the code as it is typed. Any viewer can run their own copy of it beside the lesson —
that copy lives in their browser, so trying something can never overwrite what is being taught.

- **Live feed** — one server-sent event stream per cast. Events carry no payload but the fact that
  something changed; the client refetches through its normal query keys, so the server stays the only
  source of truth and large run output is never pushed twice.
- **Scratch runs** — anyone holding a live cast link can run code in a private tab, no account, no
  effect on the cast.
- **Recorded runs** — each run keeps its compile and run stages, output, exit code and duration. A
  cast keeps its last 50.
- **Casts expire** — 24 hours after they start, or the moment the instructor stops one. Expired casts
  are deleted seven days later, run history and all.
- **Sign-in is for instructors** — GitHub OAuth through Better Auth. Viewers never need an account.

## Screenshots

The instructor's cast — the code, its compile/run output, and the run history beside it:

![The instructor's workspace: the cast's Python code, its stdout, and two runs in the history panel](docs/screenshots/instructor.png)

Everyone else follows the same code, and gets a private tab to run their own version of it in — the
edits and the output stay on their device:

![A student running their own version of the lesson in the "Your code" tab](docs/screenshots/student.png)

The link is shared by QR code, so a classroom can scan its way in:

![The share dialog showing a QR code and the cast link](docs/screenshots/share.png)

## Stack

| Piece    | Choice                                                                          |
| -------- | ------------------------------------------------------------------------------- |
| App      | TanStack Start (React 19), Tailwind v4, Base UI / shadcn components             |
| API      | oRPC — the app talks to `/api/rpc`, the same router is served as REST at `/api` |
| Data     | PostgreSQL through Drizzle ORM                                                  |
| Editor   | CodeMirror 6                                                                    |
| Auth     | Better Auth, GitHub OAuth (admin plugin for roles and bans)                     |
| Executor | self-hosted [Piston](https://github.com/engineer-man/piston)                    |

## How it works

A cast is a row: an 8-character slug (lowercase, minus look-alike letters), the code, the language
and version, and an `expires_at`. The slug is the whole of the viewer's access — anyone with the link
may watch and run against the cast while it is live. Editing follows the account that created the
cast: there is no shareable edit credential, and every owner route checks the session against
`casts.user_id`.

The app is deliberately **one process**. The change feed, the rate limiters and the feed cap live in
memory, so a second instance would silently split the room: an edit made through one would never
reach the viewers the other is streaming to. Restarts are safe: viewers reconnect, refetch what they
missed, and carry on.

What a client may ask for is bounded:

| Bound                       | Value                                             |
| --------------------------- | ------------------------------------------------- |
| Code runs, per client       | 120 / minute (Piston's `MAX_CONCURRENT_JOBS` = 8) |
| Casts created, per client   | 5 / minute                                        |
| Live feeds held, per client | 64 concurrent (512 process-wide)                  |
| Code / stdin per request    | 100 kB / 10 kB                                    |
| Cast lifetime               | 24 h, then kept for 7 days before deletion        |

## Requirements

- [Bun](https://bun.sh) 1.4.2 or newer (the version in `engines` and in the Docker image)
- Docker, for PostgreSQL and Piston
- A GitHub OAuth app, for sign-in

## Local setup

```bash
docker compose up -d postgres piston   # Postgres 18 and Piston, on the loopback
cp .env.example .env                   # then fill it in, see below
bun install
bun run db:migrate                     # create the schema from drizzle/
bun run piston:setup                   # install the pinned language runtimes
bun run dev                            # http://localhost:3000
```

Piston ships no runtimes of its own, so `piston:setup` is not optional: it installs the versions
pinned in `scripts/piston-setup.ts` and prints what the engine now offers. `bun scripts/verify-languages.ts`
then runs every offered language's starter program against it, which is the quickest way to tell a
broken install from a broken cast.

To sign in, create an OAuth app at <https://github.com/settings/developers> with the callback URL
`<BASE_URL>/api/auth/callback/github` — `http://localhost:3000/api/auth/callback/github` in
development. The first admin is granted from the command line, once that account has signed in at
least once:

```bash
bun run admin:grant you@example.com
```

### Environment

`bun` loads `.env` automatically, and the compose services take it as `env_file`.

| Variable               | Required | Notes                                                                               |
| ---------------------- | -------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`         | yes      | `postgresql://codecast:codecast@localhost:5432/codecast`                            |
| `PISTON_URL`           | no       | Defaults to `http://localhost:2000`                                                 |
| `AUTH_SECRET`          | yes      | Better Auth signing key — `openssl rand -base64 32`. Rotating it signs everyone out |
| `BASE_URL`             | yes      | Public origin of this deployment. Drives the OAuth callback and `Secure` cookies    |
| `GITHUB_CLIENT_ID`     | yes      | GitHub OAuth app                                                                    |
| `GITHUB_CLIENT_SECRET` | yes      | GitHub OAuth app — never commit it                                                  |
| `HOST` / `PORT`        | no       | Built server only; defaults to `0.0.0.0:3000`                                       |

Configuration is read and validated on first use, not at boot: the server starts, and the first
request that needs a value answers `500` while the log names what it wanted —
`Invalid environment: AUTH_SECRET: Invalid input: …`. Check the log before blaming the proxy.

### Scripts

| Command                              | What it does                                           |
| ------------------------------------ | ------------------------------------------------------ |
| `bun run dev`                        | Vite dev server with HMR                               |
| `bun run build`                      | Production build into `.output` (Nitro, `bun` preset)  |
| `bun run preview`                    | Serve the built output                                 |
| `bun run lint` / `format` / `check`  | oxlint, oxfmt, and oxfmt in check mode (CI's gate)     |
| `bun run db:push`                    | Push the schema as coded (scratch databases)           |
| `bun run db:generate` / `db:migrate` | Write a migration into `drizzle/`, then apply it       |
| `bun run db:studio`                  | Drizzle Studio                                         |
| `bun run piston:setup`               | Install the pinned runtimes into the engine            |
| `bun run admin:grant <email>`        | Make an existing account an admin                      |
| `bun scripts/verify-languages.ts`    | Run each language's starter program against the engine |

`drizzle-kit` starts through `node`; where node is not installed, prefix the call with
`bun --bun` (`bun --bun drizzle-kit push`).

## Deployment

`Dockerfile` builds the app and nothing else: Nitro bundles the server and its dependencies, so the
runtime image carries no `node_modules`, runs as the unprivileged `bun` user, and reports health
through `HEALTHCHECK`. Every value is read from the environment at startup, so no secret is baked
into a layer.

```bash
docker build -t codecast .
docker run -d --name codecast --env-file .env -p 127.0.0.1:3000:3000 codecast
```

To run it beside the rest of the stack, give it a service built from this Dockerfile in the same
compose file, with `DATABASE_URL` and `PISTON_URL` pointing at the service names (`postgres`,
`piston`) rather than `localhost` — inside a compose network they are reached by name.

Before going live:

- **Set `BASE_URL` to the public `https://` origin.** It is what GitHub redirects back to, and what
  decides whether session cookies are marked `Secure`. Serve the app behind a reverse proxy that
  terminates TLS, and leave the app itself on the loopback.
- **Overwrite the client IP at the proxy.** The rate limits are keyed on `x-real-ip`, or the first
  `x-forwarded-for` hop. A visitor who can set that header can lift their own limit, and a proxy that
  forwards it untouched lets one visitor spend everyone else's budget. Better Auth's own limiter
  (100 requests / 10 s per IP on `/api/auth`) needs the same treatment.
- **Keep Piston off the network.** The engine authenticates nobody and runs its sandboxes in
  privileged containers — anything that can reach port 2000 can run code on the host. Bind it to
  `127.0.0.1`, and never port-forward it.
- **Run exactly one app process.** See "How it works": the in-memory bus is the design, not an
  oversight.
- **Run the migrations before the app.** They are idempotent and ordered, so every deploy can apply
  them without thinking about it — see [Migrations](#migrations).
- **Back up `postgres-data` and `.env`.** Losing the database loses every cast; losing `AUTH_SECRET`
  signs everyone out.

### Migrations

`drizzle/` holds the schema's history. `drizzle-kit migrate` applies whatever has not been applied
yet and records each one in `drizzle.__drizzle_migrations`, so running it on every deploy is safe and
running it twice does nothing. There are no down migrations: to undo a change, write the migration
that reverses it, and take a dump first if the change drops anything.

The compose file has a one-shot service for it, built from the same Dockerfile so the runtime image
never has to carry the tooling:

```bash
docker compose run --rm migrate         # then start whatever runs the app
```

Let the app wait on it and a deploy stays one command:

```yaml
depends_on:
  migrate: { condition: service_completed_successfully }
```

After changing `src/db/schema.ts`:

```bash
bun run db:generate   # writes drizzle/000N_*.sql and updates the snapshot
bun run db:migrate    # review the SQL it wrote, then apply it
```

**A database that predates `drizzle/`** — one created with `db:push` — has the tables but no record
of them, so a migration would try to create tables that already exist and fail. Tell it the first
migration is already applied; both values come from the generated files:

```bash
sha256sum drizzle/0000_*.sql                        # hash
jq '.entries[0].when' drizzle/meta/_journal.json    # created_at
```

```sql
create schema if not exists drizzle;
create table if not exists drizzle."__drizzle_migrations" (
  id serial primary key,
  hash text not null,
  created_at bigint
);
insert into drizzle."__drizzle_migrations" (hash, created_at) values ('<hash>', <created_at>);
```

One migration per entry, oldest first. `db:push` remains the quick way to shape a scratch database
you are happy to throw away.

### Coolify

`compose.coolify.yml` is the deployment file for [Coolify](https://coolify.io). Create it as an
**Application** from this repository — build pack **Docker Compose**, **Base Directory** `/`,
**Docker Compose Location** `/compose.coolify.yml` — then:

1. **Domains**, on the `app` service only: `https://<your-domain>:3000`. The suffix is the container
   port the proxy routes to; nothing in the stack publishes a port to the host.
2. **Environment Variables**. Coolify lists every `${VAR:?}` in the file and refuses to deploy while
   one is empty:

   | Variable                                   | Value                                         |
   | ------------------------------------------ | --------------------------------------------- |
   | `BASE_URL`                                 | `https://<your-domain>`, no trailing slash    |
   | `AUTH_SECRET`                              | `openssl rand -base64 32`                     |
   | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | from the GitHub OAuth app                     |
   | `DATABASE_URL`                             | internal URL of a Coolify PostgreSQL resource |

3. **Deploy**. `migrate` and `piston-setup` run once and exit; `app` waits for the migration to
   finish before it starts.

Why this file differs from `compose.yml`, which stays as the local development file:

|                 | `compose.yml` (local)                                    | `compose.coolify.yml`                                                                      |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Postgres        | in the compose file, on `127.0.0.1:5432`                 | a Coolify database resource, so its scheduled backups cover it                             |
| Ports           | published on the loopback, for `bun run dev` on the host | none: the proxy reaches `app:3000` over the compose network, and Piston is never published |
| Env             | `env_file: .env`                                         | `${VAR:?}` references the resource owns                                                    |
| Container names | fixed, which is convenient locally                       | unset: Coolify names containers, and fixed names collide across environments               |
| Runtimes        | `bun run piston:setup` by hand                           | a one-shot `piston-setup` service, idempotent, every deploy                                |

Things that bite on Coolify specifically:

- **Register a second OAuth app.** GitHub OAuth apps accept one callback URL, so production needs an
  app whose callback is `https://<your-domain>/api/auth/callback/github`. A GitHub App instead allows
  several callback URLs.
- **Keep Piston on the internal network.** It authenticates nobody and runs privileged containers, so
  it gets no domain and no published port — the app reaches it at `http://piston:2000`.
- **Leave the app at one replica.** Coolify can scale a compose service, but the change feed, the rate
  limiters and the feed cap are in-memory: a second replica would silently split the room.
- **The live feed is one long-lived response.** If viewers get disconnected on a schedule, that is the
  proxy's idle timeout, not the app: raise it on the Coolify proxy.
- **Enable Coolify's scheduled backup on the Postgres resource.** The only volume in the compose file
  holds Piston's runtimes, which `piston-setup` can rebuild at any time.

### API reference

The app documents itself: `/api` serves the reference UI, `/api/spec.json` the OpenAPI document, and
`/api/auth/reference` the auth endpoints. Authentication in the spec is the Better Auth session
cookie, the same one the app's own requests carry.

## Adding a language

1. Add it to `LANGUAGES` in `src/lib/languages.ts` — id, label, Piston package, file name, and the
   starter program. The file name matters: Piston writes it verbatim, and only some runtimes append
   an extension of their own.
2. Pin its version in `PINNED_VERSIONS` in `scripts/piston-setup.ts`.
3. `bun run piston:setup`, then `bun scripts/verify-languages.ts`.

## Buy me a coffee

If my work is useful to you, please consider [buying me a coffee.](https://www.buymeacoffee.com/nemvince).

## License

[AGPL-3.0-only](LICENSE), © 2026 nemvince.

Use it, change it, self-host it.
