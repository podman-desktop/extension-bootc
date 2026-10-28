<script lang="ts">
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import Fa from 'svelte-fa';

let { title, message }: { title: string; message?: string } = $props();
</script>

<div role="alert" class="p-4 rounded-lg bg-[var(--pd-state-warning)]/10 border border-[var(--pd-state-warning)]">
  <div class="flex items-start gap-3">
    <Fa class="text-[var(--pd-state-warning)] mt-1" size="1.2x" icon={faTriangleExclamation} />
    <div>
      <h3 class="font-semibold text-[var(--pd-state-warning)]">{title}</h3>
      {#if message}
        <p class="text-sm text-[var(--pd-content-card-text)] mt-1">{message}</p>
      {/if}
    </div>
  </div>
</div>
