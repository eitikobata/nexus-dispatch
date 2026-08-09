# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# This platform doesn't support passing Docker build args separately from
# runtime env vars, but NEXT_PUBLIC_* values must exist at build time to
# get inlined into the client JS bundle. So we bake in placeholder tokens
# here instead of real values — docker-entrypoint.sh swaps them for the
# real runtime env vars right before the app starts (see that file).
ENV NEXT_PUBLIC_API_URL=__RUNTIME_NEXT_PUBLIC_API_URL__
ENV NEXT_PUBLIC_WS_URL=__RUNTIME_NEXT_PUBLIC_WS_URL__
ENV NEXT_PUBLIC_GRAFANA_URL=__RUNTIME_NEXT_PUBLIC_GRAFANA_URL__

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3001
CMD ["./docker-entrypoint.sh"]
