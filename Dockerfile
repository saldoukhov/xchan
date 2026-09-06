# Use the Node alpine official image
# https://hub.docker.com/_/node
FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

ENV ADDRESS_HEADER=X-Forwarded-For
ENV XFF_DEPTH=1

CMD ["npm", "run", "start"]
