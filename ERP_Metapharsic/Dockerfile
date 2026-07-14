# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Runtime (Express backend serves API + built frontend)
FROM node:20-alpine
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy server code
COPY server/ ./server/

# Copy built frontend (backend serves it from ../dist)
COPY --from=frontend-builder /app/dist ./dist

# Copy uploads dir (backend serves it statically)
RUN mkdir -p /app/uploads /app/server/logs

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002
WORKDIR /app/server
CMD ["node", "index.js"]
