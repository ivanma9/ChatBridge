# Bridge runtime — serves both the API and the pre-built Chatbox SPA.
#
# To rebuild the Chatbox web app before deploying:
#   cd chatbox && VITE_BRIDGE_URL="" pnpm exec vite build --config vite.web.config.ts
#
# VITE_BRIDGE_URL="" makes all bridge API calls relative (/api/...) so they
# hit the same Railway domain as the UI — no cross-origin token issues.

FROM node:22-slim

WORKDIR /app

COPY bridge/package.json bridge/package-lock.json ./
RUN npm ci --omit=dev

COPY bridge/src ./src

# Pre-built Chatbox SPA (built locally with VITE_BRIDGE_URL="")
COPY chatbox/src/renderer/dist-web ./public

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts && npx tsx src/server.ts"]
