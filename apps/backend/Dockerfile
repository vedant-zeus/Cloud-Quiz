# ==============================================================================
# CloudQuiz Backend Multi-Stage Production Dockerfile
# ==============================================================================

# Stage 1: Build & TypeScript compilation
FROM node:22-alpine AS builder

WORKDIR /app

# Install openssl for Prisma CLI
RUN apk add --no-cache openssl

# Copy package manifests
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install all dependencies (including devDependencies required for build)
RUN npm ci

# Copy backend source code and prisma schema
COPY apps/backend ./apps/backend

# Generate Prisma client
RUN npm run prisma:generate --workspace=@cloudquiz/backend

# Build backend
RUN npm run build:backend

# Stage 2: Minimal Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install runtime dependencies for Prisma
RUN apk add --no-cache openssl

# Copy package manifests and production dependencies only
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
RUN npm ci --omit=dev

# Copy generated Prisma engine client and build artifacts from builder
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

WORKDIR /app/apps/backend

EXPOSE 4000

# Run prisma migration deploy and start the production server
CMD ["node", "dist/server.js"]
