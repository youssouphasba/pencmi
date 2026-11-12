FROM node:22-bookworm-slim
WORKDIR /app
COPY . .
USER node
EXPOSE 3001
CMD ["node", "scripts/serve-frontend.cjs"]
