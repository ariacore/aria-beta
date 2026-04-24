FROM node:22-bullseye

# Install system dependencies for Xvfb, noVNC, and xdotool
RUN apt-get update && apt-get install -y \
    xvfb \
    x11vnc \
    xdotool \
    fluxbox \
    novnc \
    websockify \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Setup application directory
WORKDIR /app

# Copy package files and install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps ./apps
COPY tsconfig.* ./
COPY turbo.json ./

RUN npm install -g pnpm && pnpm install

# Build the project
RUN pnpm run build

# Setup display environment variables
ENV DISPLAY=:99
ENV RESOLUTION=1280x720x24

# Copy entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]
