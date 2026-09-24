<script lang="ts">
import Link from './Link.svelte';
import { faArrowCircleDown, faCloudArrowDown, faCube } from '@fortawesome/free-solid-svg-icons';
import { tick } from 'svelte';
import { bootcClient } from '/@/api/client';
import { Button } from '@podman-desktop/ui-svelte';
import { imageInfo } from '../stores/imageInfo';
import { gotoDiskImageBuild } from './navigation';

let { layout = 'default' }: { layout?: 'default' | 'dashboard' } = $props();

let isDashboard = $derived(layout === 'dashboard');

let pullInProgress = $state(false);
let displayDisclaimer = $state(false);

const exampleImage = 'registry.gitlab.com/fedora/bootc/examples/httpd:latest';
const exampleImageReadmeUrl = 'https://gitlab.com/fedora/bootc/examples/-/tree/main/httpd';

async function gotoBuild(): Promise<void> {
  // Split the image name to get the image name and tag and go to build page
  // this will pre-select the image and tag in the build screen
  const [image, tag] = exampleImage.split(':');
  await gotoDiskImageBuild(image, tag);
}

async function pullExampleImage(): Promise<void> {
  pullInProgress = true;
  displayDisclaimer = false;

  // After 5 seconds, check if pull is still in progress and display disclaimer if true
  setTimeout(() => {
    if (pullInProgress) {
      displayDisclaimer = true;
      // Ensure UI updates to reflect the new state
      tick().catch((e: unknown) => console.error('error updating disclaimer', e));
    }
  }, 5_000);

  await bootcClient.pullImage(exampleImage).finally(() => {
    pullInProgress = false;
    displayDisclaimer = false;
  });
}

// Each time images updates, check if the image is in RepoTags
let imageExists = $derived($imageInfo?.some(image => image.RepoTags?.includes(exampleImage)));

let buildLabel = $derived(isDashboard ? 'Build example image' : `Build ${exampleImage}`);
let pullLabel = $derived(isDashboard ? 'Pull example image' : `Pull ${exampleImage}`);
</script>

<div class="flex flex-col">
  {#if !isDashboard}
    <p class="pb-1 max-w-xl text-[var(--pd-card-header-text)]">
      Create your first disk image by {imageExists ? 'building' : 'pulling'} the <Link
        externalRef={`${exampleImageReadmeUrl}`}>example container image</Link
      >:
    </p>
  {/if}

  <!-- Build / pull buttons -->
  {#if imageExists}
    <Button
      onclick={gotoBuild}
      icon={faCube}
      aria-label={isDashboard ? buildLabel : 'Build image'}
      title={isDashboard ? exampleImage : 'Build'}>{buildLabel}</Button>
  {:else}
    <Button
      onclick={pullExampleImage}
      icon={isDashboard ? faCloudArrowDown : faArrowCircleDown}
      inProgress={pullInProgress}
      aria-label={isDashboard ? pullLabel : 'Pull image'}
      title={isDashboard ? exampleImage : 'Pull image'}>{pullLabel}</Button>
  {/if}
  {#if displayDisclaimer}
    <p class="text-[var(--pd-status-waiting)] text-sm">
      The file size of the image is over 1.5GB and may take a while to download.
    </p>
  {/if}
</div>
