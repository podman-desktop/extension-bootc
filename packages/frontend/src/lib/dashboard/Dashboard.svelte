<script lang="ts">
import BootcSelkie from '../BootcSelkie.svelte';
import Link from '../Link.svelte';
import { faArrowCircleDown, faCube } from '@fortawesome/free-solid-svg-icons';
import { onMount, tick } from 'svelte';
import { bootcClient, rpcBrowser } from '../../api/client';
import { Messages } from '/@shared/src/messages/Messages';
import { router } from 'tinro';
import { Button } from '@podman-desktop/ui-svelte';
import type { ImageInfo } from '@podman-desktop/api';
import DashboardPage from '../upstream/DashboardPage.svelte';
import DashboardResourceCard from '../upstream/DashboardResourceCard.svelte';
import DiskImageIcon from '../DiskImageIcon.svelte';
import Expandable from '../upstream/Expandable.svelte';
import DashboardGuideCard from '../upstream/DashboardGuideCard.svelte';
import { historyInfo } from '../../stores/historyInfo';
import osbuildImage from './osbuild.png';
import rhdImage from './rhd.png';
import fedoraImage from './fedora.png';

let pullInProgress = $state(false);
let displayDisclaimer = $state(false);
let bootcAvailableImages: ImageInfo[] = $state([]);

let bootcImageCount = $derived(bootcAvailableImages.length);
let diskImageCount = $derived($historyInfo.length);

const exampleImage = 'quay.io/bootc-extension/httpd:latest';
const bootcImageBuilderSite = 'https://github.com/osbuild/bootc-image-builder';
const bootcSite = 'https://containers.github.io/bootc/';
const fedoraBaseImages = 'https://docs.fedoraproject.org/en-US/bootc/base-images/';
const extensionSite = 'https://github.com/containers/podman-desktop-extension-bootc';
const rhdImageMode = './RHD.png';

async function gotoBuild(): Promise<void> {
  // Split the image name to get the image name and tag
  // and go to /disk-image/build/:image/:tag
  // this will pre-select the image and tag in the build screen
  const [image, tag] = exampleImage.split(':');
  router.goto(`/disk-images/build/${encodeURIComponent(image)}/${encodeURIComponent(tag)}`);
}

async function pullExampleImage(): Promise<void> {
  pullInProgress = true;
  displayDisclaimer = false;
  await bootcClient.pullImage(exampleImage);

  // After 5 seconds, check if pull is still in progress and display disclaimer if true
  setTimeout(() => {
    if (pullInProgress) {
      displayDisclaimer = true;
      // Ensure UI updates to reflect the new state
      tick().catch((e: unknown) => console.error('error updating disclaimer', e));
    }
  }, 5000);
}

onMount(async () => {
  bootcAvailableImages = await bootcClient.listBootcImages();

  return rpcBrowser.subscribe(Messages.MSG_IMAGE_PULL_UPDATE, msg => {
    if (msg.image === exampleImage) {
      pullInProgress = !msg.success;
      if (!pullInProgress) {
        displayDisclaimer = false; // Ensure disclaimer is removed when not in progress
      }
    }
    // Update the list of available images after a successful pull
    if (msg.success) {
      bootcClient
        .listBootcImages()
        .then(images => {
          bootcAvailableImages = images;
        })
        .catch((e: unknown) => console.error('error while updating images', e));
    }
  });
});

// Each time bootcAvailableImages updates, check if 'quay.io/bootc-extension/httpd' is in RepoTags
let imageExists = $derived(bootcAvailableImages?.some(image => image.RepoTags?.includes(exampleImage)));
</script>


<DashboardPage>
  <!-- eslint-disable-next-line sonarjs/no-unused-vars -->
  {#snippet pageTitle()}
    Welcome to Bootable Containers
  {/snippet}
  <!-- eslint-disable-next-line sonarjs/no-unused-vars -->
  {#snippet header()}
    <div class="flex flex-row">
      <div class="flex flex-col gap-4">
        <div>
          Bootable Containers builds an entire bootable OS from your container image. Utilizing the technology of a
          <Link externalRef={fedoraBaseImages}>compatible image</Link>, <Link externalRef={bootcImageBuilderSite}
            >bootc-image-builder</Link
          >, and <Link externalRef={bootcSite}>bootc</Link>, your container image is transformed into a bootable disk image.
        </div>
        <div>
          Want to learn more including building your own Containerfile? Check out the <Link externalRef={extensionSite}
            >extension documentation</Link>.
        </div>
      </div>
      <div class="w-40 ml-8 mb-2">
        <BootcSelkie size="90" />
      </div>
    </div>
  {/snippet}

  <div class="flex flex-col items-center text-center space-y-3 p-4 bg-[var(--pd-content-card-carousel-card-bg)] rounded-md">
    <p class="pb-1 max-w-xl text-[var(--pd-card-header-text)]">
      Create your first disk image by {imageExists ? 'building' : 'pulling'} the <Link
        externalRef={`https://${exampleImage}`}>example container image</Link
      >:
    </p>

    <!-- Build / pull buttons -->
    {#if imageExists}
      <Button on:click={gotoBuild} icon={faCube} aria-label="Build image" title="Build"
        >Build {exampleImage}</Button>
    {:else}
      <Button
        on:click={pullExampleImage}
        icon={faArrowCircleDown}
        inProgress={pullInProgress}
        aria-label="Pull image"
        title="Pull image">Pull {exampleImage}</Button>
    {/if}
    {#if displayDisclaimer}
      <p class="text-[var(--pd-status-waiting)] text-sm">
        The file size of the image is over 1.5GB and may take a while to download.
      </p>
    {/if}
  </div>

  <div class="text-xl pt-2">Metrics</div>
  <div class="grid grid-cols-4 gap-4">
    <DashboardResourceCard type="Bootc Images" Icon={DiskImageIcon} count={bootcImageCount} link="/" />
    <DashboardResourceCard type="Disk Images" Icon={DiskImageIcon} count={diskImageCount} link="/disk-images/" />
  </div>

  <div class="flex flex-1 flex-col pt-2">
    <Expandable>
      <!-- eslint-disable-next-line sonarjs/no-unused-vars -->
      {#snippet title()}<div class="text-xl">Explore articles and blog posts</div>{/snippet}
      <div class="grid grid-cols-3 gap-4">
        <DashboardGuideCard title='Image Builder user guide' image={osbuildImage} link='https://osbuild.org/docs/user-guide/introduction/'/>
        <DashboardGuideCard title='Introducing image mode for RHEL and bootable containers' image={rhdImage} link='https://developers.redhat.com/articles/2024/05/07/image-mode-rhel-bootable-containers'/>
        <DashboardGuideCard title='Getting started with bootable containers' image={fedoraImage} link='https://docs.fedoraproject.org/en-US/bootc/getting-started/'/>
      </div>
    </Expandable>
  </div>
</DashboardPage>
