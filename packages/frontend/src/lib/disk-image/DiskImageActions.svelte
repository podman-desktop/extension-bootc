<script lang="ts">
import type { BootcBuildInfo } from '/@shared/src/models/bootc';
import ListItemButtonIcon from '/@/lib/upstream/ListItemButtonIcon.svelte';
import { faFileAlt, faTrash, faTerminal } from '@fortawesome/free-solid-svg-icons';
import { router } from 'tinro';
import { bootcClient } from '/@/api/client';
import { onMount } from 'svelte';

interface Props {
  object: BootcBuildInfo;
  detailed?: boolean;
}

let { object, detailed = false }: Props = $props();
let isWindows = $state(false);

// Delete the build
async function deleteBuild(): Promise<void> {
  await bootcClient.deleteBuilds([object.id]);
}

// Navigate to the build
async function gotoLogs(): Promise<void> {
  router.goto(`/disk-image/${btoa(object.id)}/build`);
}

async function gotoVM(): Promise<void> {
  router.goto(`/disk-image/${btoa(object.id)}/vm`);
}

onMount(async () => {
  isWindows = await bootcClient.isWindows();
});
</script>

{#if !detailed}
  <!-- Only show the Terminal button if object.arch actually exists or else we will not be able to pass in the architecture information to the build correctly.
  Only show if on macOS as well as that is the only option we support at the moment -->
  {#if object.arch && !isWindows}
    <ListItemButtonIcon title="Launch VM" onClick={gotoVM} detailed={detailed} icon={faTerminal} />
  {/if}
  <ListItemButtonIcon title="Build Logs" onClick={gotoLogs} detailed={detailed} icon={faFileAlt} />
{/if}
<ListItemButtonIcon title="Delete Build" onClick={deleteBuild} detailed={detailed} icon={faTrash} />
