# mailguard

Tiny, dependency-free JavaScript/TypeScript client for the
[MailGuard](https://mailguard-api.atek.workers.dev) email-verification API.

Stop fake, mistyped, and disposable emails at signup with one call: syntax + MX
checks, disposable/role detection, a "did you mean gmail.com?" typo suggestion, and
a 0–100 deliverability score.

- ✅ Zero dependencies: just the platform `fetch`
- ✅ Works in Node 18+, Bun, Deno, Cloudflare Workers, and the browser
- ✅ Fully typed
- ✅ **Free tier, no card**: [grab a key](https://mailguard-api.atek.workers.dev)

📦 [npm](https://www.npmjs.com/package/mailguard) · 🐙 [Source on GitHub](https://github.com/ahughes1994/MailGuard.SDK)

## Install

```bash
npm install mailguard
```

## Quick start

```ts
import { MailGuard } from "mailguard";

const mg = new MailGuard("mg_yourkey");

const result = await mg.verify("jane@gmial.com");
console.log(result.status);        // "risky"
console.log(result.score);         // 75
console.log(result.did_you_mean);  // "gmail.com"
```

### Gate a signup form

```ts
if (await mg.isDeliverable(email)) {
  // proceed
} else {
  // ask the user to double-check their address
}
```

### Verify a list

```ts
const { results } = await mg.verifyBatch([
  "a@example.com",
  "info@example.com",
  "test@mailinator.com",
]);
```

## API

### `new MailGuard(apiKey, options?)` / `new MailGuard(options)`

```ts
const mg = new MailGuard("mg_yourkey", {
  baseUrl: "https://self-hosted-instance.workers.dev", // optional — only if you self-host; defaults to the hosted API
  timeoutMs: 10000,                                     // optional
  fetch: customFetch,                                   // optional
});
```

### Methods

| Method | Returns |
|---|---|
| `verify(email)` | `Promise<VerifyResult>` |
| `verifyBatch(emails)` | `Promise<BatchResult>` (max 100) |
| `isDeliverable(email)` | `Promise<boolean>` (true only when `status === "deliverable"`) |

### `VerifyResult`

```ts
interface VerifyResult {
  email: string;
  normalized: string;
  status: "deliverable" | "risky" | "undeliverable" | "unknown";
  score: number; // 0–100
  checks: {
    syntax: boolean;
    mx_found: boolean;
    disposable: boolean;
    role: boolean;
    free_provider: boolean;
  };
  did_you_mean: string | null;
  reasons: string[];
}
```

### Errors

Non-2xx responses and network/timeout failures throw a `MailGuardError`:

```ts
import { MailGuard, MailGuardError } from "mailguard";

try {
  await mg.verify("test@example.com");
} catch (err) {
  if (err instanceof MailGuardError) {
    console.error(err.status, err.code, err.message); // e.g. 429 "quota_exceeded" "..."
  }
}
```

## Contributing & issues

Source, issues, and pull requests:
[github.com/ahughes1994/MailGuard.SDK](https://github.com/ahughes1994/MailGuard.SDK).

## License

MIT © Anthony Hughes
