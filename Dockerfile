FROM node:18

WORKDIR /app

COPY ./package.json ./yarn.lock  ./lerna.json ./
COPY packages/matching-relayer/package.json /app/packages/matching-relayer/package.json

RUN yarn --frozen-lockfile 

COPY . .

RUN yarn build
