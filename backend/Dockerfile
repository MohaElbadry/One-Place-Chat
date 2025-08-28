# Ultra-minimal multi-stage build with aggressive optimization
FROM node:20-alpine AS builder

# Install build dependencies with cache mount
RUN --mount=type=cache,target=/var/cache/apk \
    apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# Copy source and build
COPY src/ ./src/
COPY tsconfig.json ./

# Build and aggressively clean node_modules
RUN npm run build \
    && npm prune --production \
    && find ./node_modules -type f \( \
        -name "*.md" -o \
        -name "*.txt" -o \
        -name "LICENSE*" -o \
        -name "CHANGELOG*" -o \
        -name "*.map" -o \
        -name "*.d.ts" -o \
        -name "*.swp" -o \
        -name "*.swo" -o \
        -name "*~" -o \
        -name ".DS_Store" -o \
        -name "Thumbs.db" -o \
        -name "ehthumbs.db" \
    \) -delete \
    && find ./node_modules -type d \( \
        -name "test" -o \
        -name "tests" -o \
        -name "docs" -o \
        -name "examples" -o \
        -name "coverage" -o \
        -name ".nyc_output" -o \
        -name ".eslintcache" -o \
        -name ".cache" -o \
        -name ".parcel-cache" -o \
        -name ".next" -o \
        -name ".nuxt" -o \
        -name ".storybook-out" -o \
        -name ".out" -o \
        -name "tmp" -o \
        -name "temp" -o \
        -name ".vscode" -o \
        -name ".idea" \
    \) -exec rm -rf {} + 2>/dev/null || true \
    && rm -rf src tsconfig.json \
    && apk del .build-deps

# Production stage with aggressive optimization
FROM node:20-slim AS production

# Install only runtime dependencies including curl for API calls
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 \
    libstdc++6 \
    curl \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Copy only production artifacts from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Final cleanup and optimization
RUN rm -rf /tmp/* /var/tmp/*

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check

# Start the application
CMD ["node", "dist/api/server.js"]