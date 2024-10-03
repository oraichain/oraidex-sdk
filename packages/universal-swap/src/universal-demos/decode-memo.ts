import { Memo } from "../proto/universal_swap_memo";

(() => {
  const memo =
    "Co0BCgdvcmFpZGV4GoEBCn8KBzEwMDAwMDASdAo/b3JhaS1vcmFpMTJoemp4Zmg3N3dsNTcyZ2R6Y3QyZnh2MmFyeGN3aDZneWtjN3FoLTMwMDAwMDAwMDAtMTAwEitvcmFpMTJoemp4Zmg3N3dsNTcyZ2R6Y3QyZnh2MmFyeGN3aDZneWtjN3FoGgRvcmFpEgY4ODAwMDAYgJDwj+nYgP0XIi8iLQorb3JhaTFodnI5ZDcycjV1bTlsdnQwcnBrZDRyNzV2cnNxdHc2eXVqaHFzMiorb3JhaTFodnI5ZDcycjV1bTlsdnQwcnBrZDRyNzV2cnNxdHc2eXVqaHFzMg==";
  const uint8Array = Buffer.from(memo, "base64");
  const encodedMemo = Memo.decode(uint8Array);
  console.dir(
    {
      encodedMemo
    },
    { depth: null }
  );
})();
