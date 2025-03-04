<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import { bootcClient } from '/@/api/client';

interface Props {
  title: string;
  link: string;
  image: string;
}

let { title, link, image }: Props = $props();

async function openLink(): Promise<void> {
  await bootcClient.openLink(link);
}
</script>

<div class="flex flex-col flex-grow gap-4 p-4 bg-[var(--pd-content-card-carousel-card-bg)] hover:bg-[var(--pd-content-card-carousel-card-hover-bg)] rounded-md items-start">
  <img src={image} class="max-w-[100%] h-8 object-contain" alt={`${title} image`} />
  <div class="text-[var(--pd-content-card-carousel-card-header-text)] font-medium grow">{title}</div>
  <Button class="self-end" on:click={openLink}>Learn more</Button>
</div>
