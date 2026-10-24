FROM node:22-alpine
WORKDIR /srv/api
ENV NODE_ENV=production
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY api/src ./src
COPY api/media ./media
COPY db /srv/db
ENV MIGRATIONS_DIR=/srv/db/migrations
USER node
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:3100/api/health || exit 1
CMD ["node", "src/server.js"]
