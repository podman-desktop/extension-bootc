---
paths:
  - 'packages/frontend/**/*.svelte'
  - 'packages/frontend/**/*.ts'
---

Use Svelte 5 runes ($state, $derived, $effect). Never use legacy $: reactive syntax or writable() stores.

Frontend tests use @testing-library/svelte with vitest. Path aliases: /@/ → src/, /@shared/ → ../../shared/.
