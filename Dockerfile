# Use the Node alpine official image
# https://hub.docker.com/_/node
FROM node:lts-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

ENV ADDRESS_HEADER=X-Forwarded-For
ENV XFF_DEPTH=1
ENV BODY_SIZE_LIMIT=2M

CMD ["npm", "run", "start"]
