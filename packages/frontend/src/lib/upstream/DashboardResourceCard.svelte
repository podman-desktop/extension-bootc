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

<article aria-label={title} class="flex flex-col gap-3 min-w-0 p-4 rounded-lg shadow-sm bg-(--pd-content-card-bg)">
  <div class="relative self-start text-(--pd-content-header)">
    <div class="flex items-center justify-center w-10 h-10 text-[40px]" aria-hidden="true">{@render icon()}</div>
    {#if count !== undefined}
      <span
        aria-hidden="true"
        class="absolute -top-1 -right-2 min-w-5 px-1 rounded-full text-center text-base bg-(--pd-badge-sky) text-(--pd-button-text)"
        >{count}</span>
      <span class="sr-only">{count} {title}</span>
    {/if}
  </div>
  <h3 class="text-lg font-semibold text-(--pd-content-header)">{title}</h3>
  <p class="grow leading-tight">{description}</p>
  <div class="self-start pt-1">{@render children()}</div>
</article>
