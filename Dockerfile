# Single-container production image: builds the React SPA and serves it from the Express API.
# (docker-compose.yml still runs frontend/backend/db as separate containers for local dev.)
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY --from=web /web/dist ./public
ENV NODE_ENV=production
EXPOSE 5000
CMD ["sh", "-c", "node src/seed.js --if-empty && node src/index.js"]
