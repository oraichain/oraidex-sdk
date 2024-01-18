FROM node:20 as builder

WORKDIR /app

COPY ./package.json ./yarn.lock  ./lerna.json ./
COPY packages/oraidex-server/package.json /app/packages/oraidex-server/package.json
COPY packages/oraidex-sync/package.json /app/packages/oraidex-sync/package.json
COPY patches /app/patches

RUN yarn --frozen-lockfile 

COPY packages/oraidex-common/ /app/packages/oraidex-common/
COPY packages/oraidex-server/ /app/packages/oraidex-server/
COPY packages/oraidex-sync/ /app/packages/oraidex-sync/
COPY ./tsconfig.json /app/tsconfig.json

RUN yarn build:docker

FROM node:20 as main

WORKDIR /app 

COPY --from=builder /app/packages/oraidex-server/dist/ ./dist
COPY /packages/oraidex-server/package.json ./package.json

CMD ["node", "dist/index.js"]


