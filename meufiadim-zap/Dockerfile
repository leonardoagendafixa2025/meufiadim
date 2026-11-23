FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/auth_info

EXPOSE 3001
EXPOSE 8080

CMD ["node", "index.js"]
