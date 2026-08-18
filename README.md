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
