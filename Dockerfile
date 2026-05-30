FROM node:22-bookworm-slim

# Native deps for sharp (chart generation) on Linux
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server.js"]
