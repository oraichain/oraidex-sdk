# Oraichain Orderbook SDK

## Generate code and docs

```bash
# build code:
cwtools build ../oraiswap/contracts/* ../oraidex-listing-contract ../co-harvest-contracts/contracts/* -o packages/contracts-build/data
# gen code:
cwtools gents ../oraiswap/contracts/* ../oraidex-listing-contract ../co-harvest-contracts/contracts/* -o packages/contracts-sdk/src
# gen doc:
yarn docs

# update comments:
git apply patches/contracts-sdk.patch
# edit contracts-sdk
git diff packages/contracts-sdk > patches/contracts-sdk.patch
# rollback
git checkout packages/contracts-sdk
```

## Run sample with CosmwasmSimulate

```bash
NODE_ENV=test yarn --cwd packages/market-maker start
```

# ORAIDEX BACKEND

Oraidex backend is a nodejs server that provides a REST API for aggreated events from a oraidex contracts.

Features:

- Syncronize events from a oraidex smart contract on-chain to a database
- Provide a REST API to query events from the database

## HOW TO RUN

### Local

```sh
cp .env.example .env
yarn && yarn build
cd packages/oraidex-server
node dist/index.js
```

### Docker

```
docker build . -t oraichain/defi_oraidex-backend
docker run -it --rm \
-v $(pwd)/.env:/app/.env \
-v your-db-file.db:/app/your-db-file.db \
oraichain/defi_oraidex-backend

```

## RUN UNIT TESTS

```sh
yarn test
```
