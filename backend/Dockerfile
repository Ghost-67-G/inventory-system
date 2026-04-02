# backend/Dockerfile

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./
RUN npm ci --include=dev

# Copy source and build
COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/
RUN npm run build
# Output: /app/dist/

# Prune dev dependencies
RUN npm prune --omit=dev

# Stage 2: Production image
FROM node:20-alpine AS production
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built files and production node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs

EXPOSE 3000

# Health check used by Docker and orchestrators
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "dist/server.js"]
