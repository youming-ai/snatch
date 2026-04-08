FROM oven/bun:1 AS base
WORKDIR /app

# Install yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
    curl \
    && pip3 install --break-system-packages yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json bun.lock* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package (type-check only, no emit)
WORKDIR /app/packages/shared
RUN bun run typecheck

# Build API
WORKDIR /app/apps/api
RUN bun run build

ENV RUST_LOG=info
EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
