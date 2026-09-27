# Pinned to the bun the lockfile was resolved with; bump both together.
FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app

# Manifests first, so a source change does not reinstall the world.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile


FROM deps AS build

# Vite inlines `import.meta.env.VITE_*` into the bundles, so anything the client needs has to be here
# at build time rather than in the runtime environment. Empty (the default) simply ships no analytics.
ARG VITE_UMAMI_WEBSITE_ID
ENV VITE_UMAMI_WEBSITE_ID=${VITE_UMAMI_WEBSITE_ID}

COPY . .
RUN bun run build


# Tasks run from here — migrations and `piston:setup`. It takes the dependencies and the sources but
# skips the client build, which none of them need. `--bun` is required: this image has no `node` for
# drizzle-kit's shebang. Declared before `runtime` so the app stays the default build target.
FROM deps AS migrate
COPY . .
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
