# Oraichain Orderbook SDK

## Generate code and docs

```bash
# gen code:
cw-gents ../oraiswap/contracts/oraiswap_limit_order ../oraiswap/contracts/oraiswap_token -o packages/contracts-sdk/src
# gen doc:
yarn docs

# update comments:
git apply patches/contracts-sdk.patch
# edit contracts-sdk
git diff packages/contracts-sdk > patches/contracts-sdk.patch
# rollback
git checkout packages/contracts-sdk
```
