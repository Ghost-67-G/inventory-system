# frontend/Dockerfile

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build args for environment variables baked into the build
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_DEPLOYMENT_MODE=saas

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
ENV VITE_DEPLOYMENT_MODE=${VITE_DEPLOYMENT_MODE}

RUN npm run build
# Output: /app/dist/

# Stage 2: Serve with Nginx
FROM nginx:alpine AS production

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx SPA config
COPY nginx/spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
