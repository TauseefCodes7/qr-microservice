# Use Puppeteer's official image WITH Chromium preinstalled
FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome"

# EXPOSE 3000

CMD ["node", "index.js"]
