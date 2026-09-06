# ---- Build stage -------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Vite inlines the API base URL at build time, so it has to be known here rather
# than at container start. Docker Compose passes it as a build argument.
ARG VITE_API_BASE_URL=http://localhost:8080/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# The manifests are copied first so the dependency layer is reused whenever only
# application code changes. `npm ci` installs exactly what the lockfile pins.
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Type checking and the test suite are part of the image build: a broken build
# can never produce a servable bundle.
RUN npm run typecheck && npm test

RUN npm run build

# ---- Runtime stage -----------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
