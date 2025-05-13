<script lang="ts">
import type { BootcBuildInfo } from '/@shared/src/models/bootc';
import ListItemButtonIcon from '/@/lib/upstream/ListItemButtonIcon.svelte';
import { faFileAlt, faTrash, faTerminal } from '@fortawesome/free-solid-svg-icons';
import { router } from 'tinro';
import { bootcClient } from '/@/api/client';
import { onMount } from 'svelte';
import { gotoCreateVM } from '../navigation';

interface Props {
  object: BootcBuildInfo;
  detailed?: boolean;
}

let { object, detailed = false }: Props = $props();
let isLinux = $state(false);
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

async function initMacadamVM(): Promise<void> {
  // We must pass in the full path to the disk image, so we combine object.folder as well as 'image/disk.raw'.
  const imagePath = object.folder + '/image/disk.raw';
  await gotoCreateVM(object.image, imagePath);
}

onMount(async () => {
  isLinux = await bootcClient.isLinux();
  isWindows = await bootcClient.isWindows();
});
</script>

{#if !detailed}
  <!-- Only show if Linux, as Macadam Linux isn't supported yet: -->
  {#if object.arch && !isWindows}
    <ListItemButtonIcon title="Create VM" onClick={initMacadamVM} detailed={detailed} icon={faTerminal} />
  {/if}
  <ListItemButtonIcon title="Build Logs" onClick={gotoLogs} detailed={detailed} icon={faFileAlt} />
{/if}

<ListItemButtonIcon title="Delete Build" onClick={deleteBuild} detailed={detailed} icon={faTrash} />
