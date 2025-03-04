<script lang="ts">
import type { Snippet } from 'svelte';
import { Expandable } from '@podman-desktop/ui-svelte';

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

<div class="flex flex-col w-full h-full">
  <div class="flex flex-col w-full h-full pt-4">
    <!--{#if noContexts}
      <KubernetesEmptyPage />
    {:else}-->
    <!-- Details - collapsible -->
    <div class="flex flex-row w-full px-5 pb-2">
      <Expandable>
        <!-- eslint-disable-next-line sonarjs/no-unused-vars -->
        {#snippet title()}
          <div class="flex flex-row w-full items-center text-xl font-bold capitalize text-[var(--pd-content-header)]">
            {@render pageTitle?.()}
          </div>
        {/snippet}
        <div class="flex flex-col gap-4">
          {@render header?.()}
        </div>
      </Expandable>
    </div>

    <div class="flex w-full h-full overflow-auto">
      <div class="flex min-w-full h-full justify-center">
        <div class="flex flex-col space-y-4 min-w-full overflow-y-auto">
          <div class="flex flex-col gap-4 bg-[var(--pd-content-card-bg)] grow p-5">
            {@render children?.()}
          </div>
        </div>
      </div>
    </div>
    <!--{/if}-->
  </div>
</div>
