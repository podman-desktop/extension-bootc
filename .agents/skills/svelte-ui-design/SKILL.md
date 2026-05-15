---
name: svelte-ui-design
description: >-
  Guides designing and building Svelte 5 UI components in the bootc extension.
  Covers @podman-desktop/ui-svelte components, Tailwind CSS, Svelte 5 runes,
  page layouts, tables, forms, and upstream component patterns. Triggers when
  creating or modifying Svelte components, building UI pages or forms, working
  with the component library, or asking about frontend design patterns.
paths:
  - packages/frontend/src/**/*.svelte
  - packages/frontend/src/**/*.ts
  - packages/frontend/src/**/*.css
---

# Svelte UI Design Guide

## Component Library Priority

**Always use `@podman-desktop/ui-svelte` first.** This library provides
Podman Desktop's design system. Only create custom components when the library
does not cover the use case.

- Source: https://github.com/podman-desktop/podman-desktop/tree/main/packages/ui
- Storybook: https://podman-desktop.io/storybook

```svelte
<script lang="ts">
import { Button, Input, Table, FormPage, NavPage, EmptyScreen } from '@podman-desktop/ui-svelte';
</script>
```

### Check API

Component APIs change across versions. Read the installed package directly:

1. **List all exports**: Read `node_modules/@podman-desktop/ui-svelte/dist/index.d.ts`
2. **Check component props**: Read the `.d.ts` file for any component, e.g.
   `node_modules/@podman-desktop/ui-svelte/dist/button/Button.svelte.d.ts`
3. **Browse all component dirs**: `ls node_modules/@podman-desktop/ui-svelte/dist/`
4. **Check package exports**: Read `node_modules/@podman-desktop/ui-svelte/package.json`
   for the full `exports` map (shows all importable paths)
5. **See how we already use them**: `grep -r "from '@podman-desktop/ui-svelte'" packages/frontend/src/`

Always verify props against the actual `.d.ts` files before using a component.

## Svelte 5 Runes (Required)

This project uses **Svelte 5 runes**. Never use legacy Svelte 4 reactive syntax.

```svelte
<script lang="ts">
// Correct: Svelte 5 runes
let items = $state<MyItem[]>([]);
let loading = $state(true);
let filtered = $derived(items.filter(i => i.active));

$effect(() => {
  fetchItems().then(result => {
    items = result;
    loading = false;
  });
});

// Wrong: Legacy Svelte 4
// $: filtered = items.filter(i => i.active);
// let items = writable([]);
</script>
```

### Props Pattern

```svelte
<script lang="ts">
// Svelte 5 props with defaults
let {
  title,
  items = [],
  onselect,
}: {
  title: string;
  items?: MyItem[];
  onselect?: (item: MyItem) => void;
} = $props();
</script>
```

## Routing

Hash-based routing via `tinro`. Routes are defined in `App.svelte`.

```svelte
<!-- App.svelte -->
<Route path="/my-feature" breadcrumb="My Feature">
  <MyFeature />
</Route>

<!-- Add navigation entry in Navigation.svelte -->
<SettingsNavItem title="My Feature" href="/my-feature" icon={faMyIcon} selected={meta.url.startsWith('/my-feature')} />
```

Navigate programmatically:

```typescript
import { router } from 'tinro';
router.goto('/disk-images/build');
```

Navigation helpers are in `packages/frontend/src/lib/navigation.ts`.

## RPC Reactive Stores

Auto-refreshing stores that subscribe to backend messages:

```typescript
import { rpcReadable } from '/@/stores/rpcReadable';
import { bootcClient } from '/@/api/client';
import { Messages } from '/@shared/src/messages/Messages';

export const imageInfos = rpcReadable<ImageInfo[]>([], Messages.MSG_IMAGE_UPDATE, () => bootcClient.listBootcImages());
```

Use in components:

```svelte
<script lang="ts">
import { imageInfos } from '/@/stores/imageInfo';
let images = $derived($imageInfos);
</script>
```

## Tailwind CSS

Use Podman Desktop CSS variables (`var(--pd-*)`) for all theme-dependent styles.
Font sizes are smaller than Tailwind defaults (text-base = 12px).

Common variables: `--pd-content-card-bg`, `--pd-content-text`, `--pd-content-header`,
`--pd-content-divider`, `--pd-button-primary-bg`.

For the full Tailwind config (custom font sizes, content paths, theme overrides):

```bash
cat packages/frontend/tailwind.config.js
```

Grep existing components for CSS variable usage patterns:

```bash
grep -rn "var(--pd-" packages/frontend/src/ | head -30
```

## Upstream Components

Local components in `packages/frontend/src/lib/upstream/` provide patterns not
covered by `@podman-desktop/ui-svelte`. Browse them to find available components:

```bash
ls packages/frontend/src/lib/upstream/
```

## Checklist: Adding a New UI Page

1. Create the component in `packages/frontend/src/` or `src/lib/`
2. Add route in `App.svelte` using `<Route path="..." />`
3. Add navigation entry in `Navigation.svelte` using `<SettingsNavItem />`
4. Use the appropriate layout: `NavPage` (list), `FormPage` (form), or `DetailsPage` (detail)
5. Use `@podman-desktop/ui-svelte` components for all standard UI elements
6. Connect to backend via `bootcClient` from `/@/api/client`
7. Add empty state with `EmptyScreen` or `FilteredEmptyScreen`
8. Run `pnpm svelte:check` to validate component types
9. Test with `pnpm watch` + Podman Desktop dev mode
