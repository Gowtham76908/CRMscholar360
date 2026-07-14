FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY . .
RUN npm ci
RUN npx prisma generate

EXPOSE 5001

CMD ["node", "src/server.js"]
