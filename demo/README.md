# Demo for Social Media Studio

This demo runs a simple end-to-end flow against the in-process fake platform and app.

How to run:

1. Start the app (it will also start the fake platform):

```
npm start --prefix /workspace
```

2. In another shell, run the demo script:

```
node demo/run-demo.js > demo/demo-output.txt
```

Outputs:

- `demo/demo-output.txt` — raw terminal output captured during the demo run.
- `demo/sample-result.json` — JSON summary of the key results (campaign and publish responses).
