<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  title: string;
  description: string;
  icon: Snippet;
  count?: number;
  children: Snippet;
}

let { title, description, icon, count, children }: Props = $props();
</script>

<article aria-label={title} class="flex flex-col gap-3 min-w-0 p-4 rounded-lg shadow-sm bg-[var(--pd-content-card-bg)]">
  <div class="relative self-start text-[var(--pd-content-header)]">
    <div class="flex items-center justify-center w-10 h-10 text-[40px]" aria-hidden="true">{@render icon()}</div>
    {#if count !== undefined}
      <span
        class="absolute -top-1 -right-2 min-w-5 px-1 rounded-full text-center text-base bg-[var(--pd-badge-sky)] text-[var(--pd-button-text)]"
        aria-label="{title} count">{count}</span>
    {/if}
  </div>
  <h3 class="text-lg font-semibold text-[var(--pd-content-header)]">{title}</h3>
  <p class="grow leading-tight">{description}</p>
  <div class="self-start pt-1">{@render children()}</div>
</article>
