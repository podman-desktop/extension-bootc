<script lang="ts">
import type { Snippet } from 'svelte';

let {
  pageTitle = undefined,
  header = undefined,
  children = undefined,
}: {
  pageTitle?: Snippet;
  header?: Snippet;
  children?: Snippet;
} = $props();
</script>

<div class="@container w-full min-w-0 h-full overflow-y-auto leading-tight text-(--pd-content-text)">
  <div class="flex flex-col gap-6 max-w-5xl mx-auto p-6">
    <header class="flex flex-col gap-4">
      <h1 class="text-5xl leading-none font-light text-(--pd-content-header)">{@render pageTitle?.()}</h1>
      {@render header?.()}
    </header>
    {@render children?.()}
  </div>
</div>
