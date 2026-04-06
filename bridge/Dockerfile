FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ src/

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/db/seed.ts && npx tsx src/server.ts"]
