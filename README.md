# Social Media Studio — Minimal Submission

This minimal submission implements a fake-platform, a simple publisher adapter, an image variant generator, caption composer, scheduling (basic), webhook handling, and tests to verify core behaviors: idempotency, 429 handling, webhook signature verification, and image variant dimensions.

Quick commands:

Install:
```
npm install
```

Run tests:
```
npm test
```

Start app (includes fake platform):
```
npm start
```

Notes:
- The fake platform runs on port 4001; the app runs on 4000.
- Persistence is a tiny `db.json` file.

Publishing adapter:

- The submission includes a `SocialPublisher` adapter (`src/publisher.js`) that communicates with the fake platform via HTTP, implements idempotency keys, and honors `Retry-After` on `429`.

Idempotency & retry handling:

- The fake platform supports idempotency keys; the adapter resubmits after `Retry-After` periods and will not double-post for the same idempotency key.

Image & caption generation:

- `src/image.js` contains a variant generator (stubbed to avoid heavy deps) that produces correctly-sized artifacts. `src/caption.js` composes captions from fragments plus platform-specific fragments.

Webhook verification & persistence:

- The fake platform sends signed delivery webhooks (HMAC-SHA256). The app verifies signatures and flips queued posts to `published`. State persists in `db.json`.

Tests & docs:

- Integration-style tests live in `test/run-tests.js` and validate idempotency, 429 handling, webhook verification, and image/caption behavior. This README documents how to run the checks.

Prepared for submission.

## Demo / Results

Start the app (runs fake platform on 4001 and app on 4000):

```
npm start --prefix /workspace
```

Run the demo script (captures real output to `demo/demo-output.txt`):

```
node demo/run-demo.js > demo/demo-output.txt
```

What the demo proves:

- Campaign creation: the `/make-campaign` endpoint returns a queued campaign entry.
- Caption generation: platform-specific captions are produced from fragments.
- Image generation: per-platform variants are produced (written to `demo/`).
- Publishing: posts are sent to the fake platform via the `SocialPublisher` adapter.
- Idempotency: re-sending with the same idempotency key returns a duplicate response (no double-post).
- 429 handling: the adapter honors `Retry-After` and retries until success.
- Webhook verification: HMAC-SHA256 signed webhooks are accepted; forged signatures are rejected.
- Status persistence: `/status` shows persisted posts in `db.json`.

Example demo output (excerpt from `demo/demo-output.txt`):

```
Demo: starting end-to-end flow
Token acquired: true
Campaign created: { id: 'entry_14d9189f9489', title: 'AI for a Greener Future', ... }
Caption Instagram: AI for a Greener Future\nLearn practical steps to reduce emissions. Stunning visuals — swipe to learn.\nhttp://example.com/ai
Image variants written to C:\workspace\demo
Publish response: { ok: true, id: 'post_e1731ea2c319' }
Publish duplicate response: { ok: true, id: 'post_e1731ea2c319', duplicate: true }
Result after 429+retry: { ok: true, id: 'post_0629cb3ab840' }
Valid webhook response: 200 { ok: true }
Forged webhook response status (expected 400): 400
Status endpoint returned: { "posts": [...], "jobs": [] }
```

Files created by demo:

- `demo/demo-output.txt` — full terminal output of the demo run.
- `demo/sample-result.json` — JSON summary of the campaign and publish responses.







