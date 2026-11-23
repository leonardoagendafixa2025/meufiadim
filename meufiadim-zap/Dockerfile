FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/auth_info

EXPOSE 3001

ENV PORT=3001

CMD ["node", "index.js"]
