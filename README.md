# Oraichain Orderbook SDK

## Generate code and docs

```bash
# gen code:
cw-gents ../oraiswap/contracts/oraiswap_limit_order ../oraiswap/contracts/oraiswap_token -o packages/contracts-sdk/src
# gen doc:
yarn docs

# update comments:
git apply patches/contracts-gen.patch
# edit contracts-gen
git diff packages/contracts-gen > patches/contracts-gen.patch
# rollback
git checkout packages/contracts-gen/src/DsourceEmpty.client.ts
```
