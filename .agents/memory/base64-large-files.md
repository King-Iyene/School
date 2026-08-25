---
name: Base64 large file conversion
description: btoa(String.fromCharCode(...new Uint8Array(buf))) crashes on files >~100KB — use chunked approach instead
---

## Rule

Never use `btoa(String.fromCharCode(...new Uint8Array(buffer)))` for arbitrary file sizes.

**Why:** The spread operator passes all bytes as individual function arguments, which exhausts the call stack for files larger than ~100KB. Confirmed crash at 389KB with "Maximum call stack size exceeded".

**How to apply:** Whenever converting an ArrayBuffer to base64 in the browser, use the chunked loop:

```typescript
const bytes = new Uint8Array(arrayBuffer);
let binary = '';
const chunkSize = 8192;
for (let i = 0; i < bytes.length; i += chunkSize) {
  binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
}
const base64 = btoa(binary);
```
