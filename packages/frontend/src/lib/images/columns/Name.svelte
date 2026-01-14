<script lang="ts">
import type { Props } from './props';
import { gotoImage } from '/@/lib/navigation';

let { object }: Props = $props();

async function openDetails(): Promise<void> {
  await gotoImage(object.name, object.tag);
}
</script>

<button class="hover:cursor-pointer flex flex-col max-w-full" onclick={openDetails}>
  <div class="flex flex-row gap-1 items-center max-w-full">
    <div class="text-[var(--pd-table-body-text-highlight)] overflow-hidden text-ellipsis">
      {object.name}
      {object.isManifest ? ' (manifest)' : ''}
    </div>
  </div>
  <div class="flex flex-row text-sm gap-1 w-full">
    <div class="text-[var(--pd-table-body-text-sub-secondary)]">{object.shortId}</div>
    <div class="font-extra-light text-[var(--pd-table-body-text)] overflow-hidden text-ellipsis">{object.tag}</div>
  </div>
</button>
