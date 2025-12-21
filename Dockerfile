FROM oven/bun:1-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
ENV RUST_API_URL=http://api:3001
RUN bun run build

# Production image - use slim node for running the server
FROM node:22-alpine

WORKDIR /app

# Copy built files only (no node_modules needed for SSR runtime)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set environment variables
ENV HOST=0.0.0.0
ENV PORT=4321
ENV RUST_API_URL=http://api:3001
ENV NODE_ENV=production

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
