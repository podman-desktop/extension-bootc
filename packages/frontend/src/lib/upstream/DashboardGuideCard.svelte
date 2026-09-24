<script lang="ts">
import { faBook } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import type { Snippet } from 'svelte';
import { bootcClient } from '/@/api/client';

interface Props {
  title: string;
  link: string;
  description: string;
  action: string;
  icon: Snippet;
}

let { title, link, description, action, icon }: Props = $props();

let domain = $derived(new URL(link).hostname);

async function openLink(): Promise<void> {
  await bootcClient.openLink(link);
}
</script>

<article
  aria-label={title}
  class="grid grid-cols-[2.5rem_minmax(0,1fr)] @min-[36rem]:grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-2 rounded-lg shadow-sm bg-[var(--pd-content-card-bg)]">
  <div
    class="flex items-center justify-center w-10 h-10 shrink-0 text-[40px] text-[var(--pd-content-header)]"
    aria-hidden="true">
    {@render icon()}
  </div>
  <div class="flex flex-col gap-1 flex-1 min-w-0">
    <h3 class="text-lg font-semibold text-[var(--pd-content-header)]">{title}</h3>
    <p>{domain}</p>
    <p>{description}</p>
  </div>
  <Button
    type="primary"
    class="col-start-2 justify-self-start @min-[36rem]:col-start-3 @min-[36rem]:row-start-1"
    icon={faBook}
    onclick={openLink}>{action}</Button>
</article>
