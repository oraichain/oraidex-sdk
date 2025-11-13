# Encode Memo

## Steps to Encode a Memo

### 1. Generate TypeScript Definitions from Proto File

- Use the Protocol Buffers compiler (`protoc`) to generate TypeScript definitions from your `.proto` file. This will create TypeScript classes/interfaces corresponding to the protobuf messages defined in your proto file.

```bash
# gen for ts
protoc --plugin=./node_modules/.bin/protoc-gen-ts_proto --ts_proto_opt=esModuleInterop=true --ts_proto_out . --proto_path=./protos universal_swap_memo.proto

```

### 2. Create the Memo Object

- Import the generated TypeScript class for the memo.
- Create an instance of the memo class.
- Populate the necessary fields within the memo object according to your requirements. Each field should be filled with appropriate data as specified by your protobuf schema.

### 3. Encode the Memo to a Base64 String

- Encode the populated memo object using the `Memo.encode(memo).finish()` method. This will return a `Uint8Array` representing the serialized memo.
- Convert the `Uint8Array` to a base64 string using `Buffer.from(encodedMemo).toString("base64");`.

```typescript
const encodedMemo = Memo.encode(memo).finish();
return Buffer.from(encodedMemo).toString("base64");
```
