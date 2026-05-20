---
paths:
  - 'packages/backend/**/*.ts'
---

Backend runs in Node.js. Mock @podman-desktop/api in tests. Path aliases: /@/ → src/, /@shared/ → ../../shared/.

New API methods require: shared interface update, backend implementation in api-impl.ts, frontend client usage.
