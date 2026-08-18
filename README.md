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






