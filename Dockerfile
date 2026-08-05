FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80
ENV DB_PATH=/data/dermatitis-tracker.sqlite
ENV PHOTOS_DIR=/data/photos

COPY server ./server
COPY --from=build /app/dist ./dist

VOLUME ["/data"]

EXPOSE 80

CMD ["node", "server/server.mjs"]
