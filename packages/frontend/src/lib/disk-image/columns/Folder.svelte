<script lang="ts">
import Link from '/@/lib/Link.svelte';
import type { Props } from './props';

let { object }: Props = $props();
</script>

<div class="text-[var(--pd-table-body-text)] overflow-hidden text-ellipsis">
  <Link folder={object.folder}>
    {object.folder}
  </Link>
</div>
