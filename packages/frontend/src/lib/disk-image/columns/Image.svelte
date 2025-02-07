<script lang="ts">
import { router } from 'tinro';
import type { Props } from './props';

let { object }: Props = $props();

function openDetails(): void {
  router.goto(`/disk-image/${btoa(object.id)}/summary`);
}
</script>

<button class="hover:cursor-pointer flex flex-col max-w-full" onclick={openDetails}>
  <div class="text-[var(--pd-table-body-text-highlight)] max-w-full overflow-hidden text-ellipsis">
    {object.image}:{object.tag}
  </div>
</button>
