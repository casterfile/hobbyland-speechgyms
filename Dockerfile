# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
ARG GEMINI_API_KEY=""
COPY package*.json ./
RUN npm ci
COPY . .
RUN echo "GEMINI_API_KEY=${GEMINI_API_KEY}" > .env
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
COPY backend/package.json backend/index.js ./

# Copy frontend build into public folder (served by Express)
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 8080

CMD ["node", "index.js"]
