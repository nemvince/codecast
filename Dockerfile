# Pinned to the bun the lockfile was resolved with; bump both together.
FROM oven/bun:1.4.2-alpine AS build
WORKDIR /app

# Manifests first, so a source change does not reinstall the world.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Migrations run from here: this stage has the tooling, node_modules and `drizzle/` that the runtime
# image deliberately does not. `--bun` is required — the runtime image has no `node` to run
# drizzle-kit's shebang. Declared before `runtime` so the app stays the default build target.
FROM build AS migrate
CMD ["bun", "--bun", "drizzle-kit", "migrate"]


FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app

ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production

# Nitro bundles the server and its dependencies, so the runtime image carries no node_modules and
# needs no `.env` at build time: every value is read from the environment when the server starts.
COPY --from=build /app/.output ./.output

USER bun
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD bun -e "process.exit(await fetch('http://127.0.0.1:3000/').then((r) => r.ok, () => false) ? 0 : 1)"

CMD ["bun", "run", ".output/server/index.mjs"]
