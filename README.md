# Oraichain Orderbook SDK

## Generate code and docs

```bash
# build code:
cwtools build ../oraiswap/contracts/* ../oraidex-listing-contract ../co-harvest-contracts/contracts/* ../cw20-staking/contracts/* -o packages/contracts-build/data
# gen code:
cwtools gents ../oraiswap/contracts/* ../oraidex-listing-contract ../co-harvest-contracts/contracts/* ../cw20-staking/contracts/* -o packages/contracts-sdk/src
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

## Protogen for the universal swap memo format

```bash
# gen for ts
protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto --ts_proto_out packages/universal-swap/src --proto_path ../ibc-bridge-wasm ../ibc-bridge-wasm/proto/universal-swap-memo.proto

# gen for rust
```
