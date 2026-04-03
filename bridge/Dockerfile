FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY src/ src/

EXPOSE 8080

CMD ["npx", "tsx", "src/server.ts"]
