<script lang="ts">
import { router } from 'tinro';
import { bootcClient } from '/@/api/client';
import { Link } from '@podman-desktop/ui-svelte';
import type { Snippet } from 'svelte';

interface Props {
  title?: string;
  internalRef?: string;
  externalRef?: string;
  folder?: string;
  action?: () => void;
  children?: Snippet;
}
let { title, internalRef, externalRef, folder, action, children }: Props = $props();

async function click(): Promise<void> {
  if (internalRef) {
    router.goto(internalRef);
  } else if (externalRef) {
    await bootcClient.openLink(externalRef);
  } else if (folder) {
    await bootcClient.openFolder(folder);
  } else if (action) {
    action();
  }
}
</script>

<Link title={title} on:click={click}>
  {@render children?.()}
</Link>
