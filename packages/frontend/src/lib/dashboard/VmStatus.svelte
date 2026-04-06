<script lang="ts">
  import { vmStatusSummary } from '../../stores/vmStatus';
</script>

<a
  href="bootc://vms"
  class="flex flex-col gap-1 rounded-lg border border-[var(--pd-secondary-border)] bg-[var(--pd-secondary)] px-4 py-3 transition-colors hover:bg-[var(--pd-secondary-hover)]"
>
  <span class="text-sm font-semibold text-[var(--pd-text-label)]">Bootc VMs</span>
  <div class="flex items-center gap-2.5">
    <span class="flex items-center gap-1 text-xs text-[var(--pd-text-secondary)]">
      <span class="inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
      {$vmStatusSummary.running} running
    </span>
    <span class="flex items-center gap-1 text-xs text-[var(--pd-text-secondary)]">
      <span class="inline-block h-1.5 w-1.5 rounded-full bg-gray-400"></span>
      {$vmStatusSummary.stopped} stopped
    </span>
    <span class="flex items-center gap-1 text-xs text-[var(--pd-text-secondary)]">
      <span class="inline-block h-1.5 w-1.5 rounded-full bg-red-500"></span>
      {$vmStatusSummary.error} error
    </span>
  </div>
</a>
