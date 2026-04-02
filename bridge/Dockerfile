FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src/ src/
COPY ../packages/app-sdk/src/ /packages/app-sdk/src/

EXPOSE 3300

CMD ["npx", "tsx", "src/server.ts"]
