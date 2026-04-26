# Stage 1: Build frontend
# AI provider keys are NOT baked into the frontend bundle anymore — they live
# on the backend at runtime via Azure App Settings.
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Install backend dependencies
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY backend/package.json backend/index.js backend/ai.js ./

# Copy frontend build into public folder (served by Express)
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 8080

CMD ["node", "index.js"]
