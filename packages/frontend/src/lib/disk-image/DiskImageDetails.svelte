<script lang="ts">
import { DetailsPage, Tab } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
import DiskImageIcon from '/@/lib/DiskImageIcon.svelte';
import DiskImageDetailsBuild from './DiskImageDetailsBuild.svelte';
import Route from '../Route.svelte';
import DiskImageDetailsSummary from './DiskImageDetailsSummary.svelte';
import { onDestroy, onMount } from 'svelte';
import type { BootcBuildInfo } from '/@shared/src/models/bootc';
import { getTabUrl, isTabSelected } from '../upstream/Util';
import { historyInfo } from '/@/stores/historyInfo';
import { goToDiskImages } from '../navigation';
import DiskImageDetailsVirtualMachine from './DiskImageDetailsVirtualMachine.svelte';
import type { Unsubscriber } from 'svelte/store';
import DiskImageActions from './DiskImageActions.svelte';

interface Props {
  id: string;
}
let { id }: Props = $props();

let diskImage = $state<BootcBuildInfo>();
let detailsPage = $state<DetailsPage>();
let historyInfoUnsubscribe = $state<Unsubscriber>();

onMount(async () => {
  // Subscribe to the history to update the details page
  const actualId = atob(id);
  historyInfoUnsubscribe = historyInfo.subscribe(value => {
    const matchingImage = value.find(image => image.id === actualId);
    if (matchingImage) {
      try {
        diskImage = matchingImage;
      } catch (err) {
        console.error(err);
      }
    } else if (detailsPage) {
      // the disk image has been deleted
      goToDiskImages();
    }
  });
});

onDestroy(() => {
  if (historyInfoUnsubscribe) {
    historyInfoUnsubscribe();
  }
});
</script>

<DetailsPage
  bind:this={detailsPage}
  title="{diskImage?.image}:{diskImage?.tag}"
  breadcrumbLeftPart="Disk Images"
  breadcrumbRightPart="Disk Image Details"
  breadcrumbTitle="Go back to disk images"
  onclose={goToDiskImages}
  onbreadcrumbClick={goToDiskImages}>
  <DiskImageIcon slot="icon" size="30px" />
  <svelte:fragment slot="actions">
    {#if diskImage}
      <DiskImageActions object={diskImage} detailed={true} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="tabs">
    <Tab title="Summary" selected={isTabSelected($router.path, 'summary')} url={getTabUrl($router.path, 'summary')} />
    <Tab title="Build Log" selected={isTabSelected($router.path, 'build')} url={getTabUrl($router.path, 'build')} />
  </svelte:fragment>
  <svelte:fragment slot="content">
    <Route path="/summary" breadcrumb="Summary">
      <DiskImageDetailsSummary image={diskImage} />
    </Route>
    <Route path="/build" breadcrumb="Build Log">
      <DiskImageDetailsBuild folder={diskImage?.folder} />
    </Route>
    <Route path="/vm" breadcrumb="Virtual Machine">
      <!-- Load after information is available since we have to wait for onMount to load the folder, image, arch. -->
      {#if diskImage?.folder && diskImage?.arch}
        <DiskImageDetailsVirtualMachine build={diskImage} />
      {/if}
    </Route>
  </svelte:fragment>
</DetailsPage>
