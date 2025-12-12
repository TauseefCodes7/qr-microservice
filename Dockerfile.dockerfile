# Puppeteer image WITH Chrome baked in
FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

COPY package*.json ./

# Production install only
RUN npm ci --omit=dev

COPY . .

# Required — DO NOT REMOVE
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"

# EXPOSE 3000

CMD ["node", "index.js"]