# Multi-stage build for Node.js + TypeScript application

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and TypeScript config
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Stage 2: Production image
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy necessary files and config
COPY src/swagger.json ./src/swagger.json
COPY src/config ./src/config
COPY src/migrations ./src/migrations
COPY .sequelizerc ./.sequelizerc
COPY redis.conf ./redis.conf

# Create temp directory for file uploads
RUN mkdir -p temp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/index.js"]
