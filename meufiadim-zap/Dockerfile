FROM node:22-alpine

WORKDIR /app

ENV PORT=8080

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/auth_info

EXPOSE 8080
EXPOSE 3001

CMD ["node", "index.js"]
