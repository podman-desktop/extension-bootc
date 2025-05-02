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
let isLinux = $state(false);
let isMac = $state(false);

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

async function initMacadamVM(): Promise<void> {
  // We must pass in the full path to the disk image, so we combine object.folder as well as 'image/disk.raw'.
  const imagePath = object.folder + '/image/disk.raw';
  router.goto(`/disk-images/createVM/${btoa(object.image)}/${btoa(imagePath)}`);
}

onMount(async () => {
  isLinux = await bootcClient.isLinux();
  isMac = await bootcClient.isMac();
});
</script>

{#if !detailed}
  <!-- Only show if Linux, as Macadam Linux isn't supported yet: -->
  {#if object.arch && isLinux}
    <ListItemButtonIcon title="Launch VM" onClick={gotoVM} detailed={detailed} icon={faTerminal} />
  {:else if object.arch && isMac}
    <ListItemButtonIcon title="Create VM" onClick={initMacadamVM} detailed={detailed} icon={faTerminal} />
  {/if}
  <ListItemButtonIcon title="Build Logs" onClick={gotoLogs} detailed={detailed} icon={faFileAlt} />
{/if}

<ListItemButtonIcon title="Delete Build" onClick={deleteBuild} detailed={detailed} icon={faTrash} />
