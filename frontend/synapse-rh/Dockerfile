# ── Stage 1 : Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Dépendances d'abord (layer cache)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Source
COPY . .

# Variables d'environnement de build
ARG VITE_API_URL=http://localhost:8080
ARG VITE_KC_URL=http://localhost:8180
ARG VITE_KC_REALM=synapse
ARG VITE_KC_CLIENT=synapse-frontend

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_KC_URL=$VITE_KC_URL
ENV VITE_KC_REALM=$VITE_KC_REALM
ENV VITE_KC_CLIENT=$VITE_KC_CLIENT

RUN npm run build

# ── Stage 2 : Serve avec Nginx ────────────────────────────────────────────────
FROM nginx:alpine

# Copier le build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier la config nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
