FROM node:24-alpine
WORKDIR /app
COPY --chown=node:node package.json cloud-server.mjs index.html oauth_callback.html manifest.json sw.js version.json athenes.apk ./
COPY --chown=node:node src ./src
COPY --chown=node:node api ./api
COPY --chown=node:node temas ./temas
USER node
ENV NODE_ENV=production PORT=3300
EXPOSE 3300
CMD ["node", "cloud-server.mjs"]
