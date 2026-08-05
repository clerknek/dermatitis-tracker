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
ENV APP_PIN=
ENV WEATHER_LAT=37.5665
ENV WEATHER_LON=126.978
ENV WEATHER_TIMEZONE=Asia/Seoul
ENV WEATHER_ENABLED=true

COPY server ./server
COPY --from=build /app/dist ./dist

VOLUME ["/data"]

EXPOSE 80

CMD ["node", "server/server.mjs"]
