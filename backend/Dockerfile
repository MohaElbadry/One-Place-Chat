# Minimal Dockerfile for Node.js + onnxruntime-node
# Build with: docker build --target production -t myapp:minimal .

# =============================================
# Stage 1: Builder
# =============================================
FROM node:20.19-slim AS builder
WORKDIR /app

# Install build dependencies
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --prefer-offline

# Copy source and build
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build \
    && rm -rf src tsconfig.json ~/.npm /tmp/* /var/tmp/*

# =============================================
# Stage 2: Production Dependencies                      
# =============================================
FROM node:20.19-slim AS deps
WORKDIR /app

# Install runtime dependencies for onnxruntime-node
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 libstdc++6 libgomp1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install production dependencies
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production --omit=dev --no-audit --no-fund --prefer-offline \
    && npm cache clean --force

# =============================================
# Stage 3: Production Runtime
# =============================================
FROM node:20.19-slim AS production
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 libstdc++6 libgomp1 curl ca-certificates \
    && apt-get autoremove -y \
    && apt-get autoclean -y \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /var/cache/apt/* \
    && rm -rf /usr/share/doc/* \
    && rm -rf /usr/share/man/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3001

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nodejs

# Copy application files
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Aggressive cleanup (proven effective)
RUN npm prune --production \                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                
    && find ./node_modules -name "*.md" -delete \
    && find ./node_modules -name "*.txt" -delete \
    && find ./node_modules -name "README*" -delete \
    && find ./node_modules -name "CHANGELOG*" -delete \
    && find ./node_modules -name "HISTORY*" -delete \
    && find ./node_modules -name "LICENSE*" -delete \
    && find ./node_modules -name "AUTHORS*" -delete \
    && find ./node_modules -name "CONTRIBUTORS*" -delete \
    && find ./node_modules -name "*.map" -delete \
    && find ./node_modules -name "*.d.ts" -delete \
    && find ./node_modules -name "*.swp" -delete \
    && find ./node_modules -name "*.swo" -delete \
    && find ./node_modules -name "*~" -delete \
    && find ./node_modules -name ".DS_Store" -delete \
    && find ./node_modules -name "Thumbs.db" -delete \
    && find ./node_modules -name "*.log" -delete \
    && find ./node_modules -type d -name "test" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "examples" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "coverage" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name ".nyc_output" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name ".cache" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name ".vscode" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name ".idea" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name ".git" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "tmp" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type d -name "temp" -exec rm -rf {} + 2>/dev/null || true \
    && find ./node_modules -type f -name "*.coffee" -delete \
    && find ./node_modules -type f -name "*.ts" ! -path "*/dist/*" ! -path "*/lib/*" ! -path "*/build/*" -delete \
    && find ./node_modules -type f -name "gulpfile.*" -delete \
    && find ./node_modules -type f -name "Gruntfile.*" -delete \
    && find ./node_modules -type f -name "webpack.config.*" -delete \
    && find ./node_modules -type f -name ".eslintrc*" -delete \
    && find ./node_modules -type f -name ".prettierrc*" -delete \
    && find ./node_modules -type f -name "jest.config.*" -delete \
    && find ./node_modules -type f -name "*.config.js" -delete \
    && find ./node_modules -type f -name "*.config.ts" -delete

# Switch to non-root user
USER nodejs

# Expose port and start application
EXPOSE 3001

# Health check
HEALTHCHECK --interval=60s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["node", "dist/api/server.js"]