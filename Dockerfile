# Stage 1: Build frontend
FROM node:20-alpine AS builder
WORKDIR /app
ARG GEMINI_API_KEY=""
COPY package*.json ./
RUN npm ci
COPY . .
RUN echo "GEMINI_API_KEY=${GEMINI_API_KEY}" > .env
RUN npm run build

# Stage 2: Production - serve with lightweight Node server
FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["serve", "-s", "dist", "-l", "8080"]
