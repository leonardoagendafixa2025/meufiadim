FROM node:22-alpine

WORKDIR /app

ENV PORT=8080
ENV NODE_ENV=production

COPY meufiadim-zap/package*.json ./

RUN npm install --omit=dev

COPY meufiadim-zap/ ./

RUN mkdir -p /app/auth_info

EXPOSE 8080
EXPOSE 3001

CMD ["node", "index.js"]
