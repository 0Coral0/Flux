FROM node:22-bookworm-slim

WORKDIR /app
COPY discord-bridge/package*.json ./discord-bridge/
RUN cd discord-bridge && npm ci --omit=dev

# The bridge imports the game catalog from the repository root.
COPY data.js ./data.js
COPY discord-bridge ./discord-bridge

WORKDIR /app/discord-bridge
ENV NODE_ENV=production
EXPOSE 3032
CMD ["node", "server.mjs"]
