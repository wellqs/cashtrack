# syntax=docker/dockerfile:1

# Stage 1: instala dependências com build tools (necessário para better-sqlite3)
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: imagem final slim, sem build tools
FROM node:22-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package*.json ./
RUN addgroup -S cashtrack && adduser -S cashtrack -G cashtrack
USER cashtrack
EXPOSE 3333
CMD ["node", "src/server.js"]
