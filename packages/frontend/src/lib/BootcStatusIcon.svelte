<script lang="ts">
import { Spinner } from '@podman-desktop/ui-svelte';
import { StarIcon } from '@podman-desktop/ui-svelte/icons';
import type { Component } from 'svelte';

// status: one of running, success, error
// any other status will result in a standard outlined box
interface Props {
  status?: string;
  icon?: Component;
  size?: number;
}
let { status = '', icon, size = 20 }: Props = $props();

let solid = $derived(
  status === 'running' ||
    status === 'success' ||
    status === 'error' ||
    status === 'lost' ||
    status === 'creating' ||
    status === 'used' ||
    status === 'deleting',
);

let IconComponent = $derived(icon);
</script>

<div class="grid place-content-center" style="position:relative">
  <div
    class="grid place-content-center rounded-sm aspect-square text-xs"
    class:bg-[var(--pd-status-running)]={status === 'success' || status === 'used'}
    class:bg-[var(--pd-status-created)]={status === 'running'}
    class:bg-[var(--pd-status-terminated)]={status === 'error'}
    class:bg-[var(--pd-status-degraded)]={status === 'lost'}
    class:p-0.5={!solid}
    class:p-1={solid}
    class:border-[var(--pd-status-not-running)]={!solid}
    class:text-[var(--pd-status-not-running)]={!solid}
    class:text-[var(--pd-status-contrast)]={solid}
    role="status"
    title={status}>
    {#if status === 'running' || status === 'creating' || status === 'deleting'}
      <Spinner size="1.4em" />
    {:else}
      <IconComponent {size} {solid} ></IconComponent>
    {/if}
  </div>
  {#if status === 'success'}
    <StarIcon size="8" style="position:absolute;top:0;right:0" />
  {/if}
</div>
