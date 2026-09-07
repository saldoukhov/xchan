# Use the Node alpine official image
# https://hub.docker.com/_/node
FROM node:lts-alpine@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

ENV ADDRESS_HEADER=X-Forwarded-For
ENV XFF_DEPTH=1
ENV BODY_SIZE_LIMIT=2M

CMD ["npm", "run", "start"]
