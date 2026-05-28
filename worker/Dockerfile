# ffmpeg-worker — produces an EBU R128 normalised FLAC master with embedded
# metadata and an AAC 128 kbps web variant. Designed to run on a small VPS,
# Cloudflare Container, Fly.io machine, or Railway service.

FROM node:22-bookworm-slim

# Install ffmpeg + ffprobe (Debian package includes both)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.ts ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Use Node 22's native TypeScript strip-types so we don't need a build step.
CMD ["node", "--experimental-strip-types", "server.ts"]