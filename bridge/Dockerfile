FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ src/

# Pre-built Chatbox SPA — served at / by Express
COPY public/ public/

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts && npx tsx src/server.ts"]
