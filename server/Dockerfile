FROM node:18-bullseye-slim

# Create app dir
WORKDIR /app

# Install build deps for pg native modules if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first for better caching
COPY package.json package-lock.json* ./

# Install deps
RUN npm ci --production=false

# Copy source
COPY . .

# Expose server port (change if different)
EXPOSE 3000

# Default command: run migrations then start dev server
CMD ["/bin/sh", "-c", "npm run migrate && npm run dev"]
