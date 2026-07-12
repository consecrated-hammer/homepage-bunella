FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY node_modules ./node_modules
COPY frontend/package*.json ./frontend/
COPY frontend/node_modules ./frontend/node_modules

COPY src/ ./src/
COPY frontend/ ./frontend/

RUN cd frontend && npm run build
RUN npm run build:backend

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Create directories for data and images
RUN mkdir -p /app/data /app/images /app/variants

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV IMAGES_DIR=/app/images
ENV VARIANTS_DIR=/app/variants

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/image', (r) => {process.exit(r.statusCode === 200 || r.statusCode === 404 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/server.js"]
