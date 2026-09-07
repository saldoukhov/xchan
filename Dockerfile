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
ENV BODY_SIZE_LIMIT=2M

CMD ["npm", "run", "start"]
