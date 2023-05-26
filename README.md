# Oraichain Orderbook SDK

## Generate code and docs

```bash
# build code:
cwtools build ../oraiswap/contracts/* -o packages/contracts-build/data
# gen code:
cwtools gents ../oraiswap/contracts/* -o packages/contracts-sdk/src
# gen doc:
yarn docs

# update comments:
git apply patches/contracts-sdk.patch
# edit contracts-sdk
git diff packages/contracts-sdk > patches/contracts-sdk.patch
# rollback
git checkout packages/contracts-sdk

# build packages
## build matching relayer
yarn build packages/matching-relayer/ --outDir packages/matching-relayer/build

## build contracts-sdk
yarn build packages/contracts-sdk/ --outDir packages/contracts-sdk/build

```
