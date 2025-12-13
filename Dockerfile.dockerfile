# Puppeteer official image WITH Chrome included
FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Required for Puppeteer in Docker
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome"

# Railway injects PORT; EXPOSE is optional here
EXPOSE 8080

CMD ["node", "index.js"]

