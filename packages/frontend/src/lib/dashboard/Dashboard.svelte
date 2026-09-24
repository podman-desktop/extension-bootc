<script lang="ts">
import { faFedora, faRedhat } from '@fortawesome/free-brands-svg-icons';
import { faArrowUpRightFromSquare, faCloudArrowDown, faCube, faEye } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Fa } from 'svelte-fa';
import { router } from 'tinro';
import BootcImageIcon from '/@/lib/BootcImageIcon.svelte';
import FirstImage from '/@/lib/FirstImage.svelte';
import Link from '/@/lib/Link.svelte';
import { gotoBuild } from '/@/lib/navigation';
import DashboardGuideCard from '/@/lib/upstream/DashboardGuideCard.svelte';
import DashboardPage from '/@/lib/upstream/DashboardPage.svelte';
import DashboardResourceCard from '/@/lib/upstream/DashboardResourceCard.svelte';
import LayersIcon from '/@/lib/dashboard/LayersIcon.svelte';
import { historyInfo } from '/@/stores/historyInfo';
import { imageInfo } from '/@/stores/imageInfo';
import { REPOSITORY_URL } from '/@shared/src/repository-infos';

let bootcImageCount = $derived($imageInfo.length);
let diskImageCount = $derived($historyInfo.length);

const bootcImageBuilderSite = 'https://github.com/osbuild/bootc-image-builder';
const bootcSite = 'https://bootc-dev.github.io/bootc/';
const fedoraBaseImages = 'https://docs.fedoraproject.org/en-US/bootc/base-images/';
</script>

<DashboardPage>
  {#snippet pageTitle()}
    Welcome to Bootable Containers
  {/snippet}
  {#snippet header()}
    <p>
      Build entire bootable operating systems from your container images.<br />
      With <Link externalRef={fedoraBaseImages}>compatible base images</Link>,
      <Link externalRef={bootcImageBuilderSite}>bootc-image-builder</Link>, and
      <Link externalRef={bootcSite}>bootc</Link>, transform containers into bootable disk images.
    </p>
    <div>
      <Link externalRef={REPOSITORY_URL}>
        View documentation <Fa icon={faArrowUpRightFromSquare} class="inline-block ml-1" />
      </Link>
    </div>
  {/snippet}

  <div class="grid grid-cols-1 @min-[36rem]:grid-cols-2 gap-1">
    <DashboardResourceCard
      title="Build a disk image"
      description="Convert your bootable container image into a disk image (QCOW2, RAW, ISO, AMI, VMDK) ready for deployment.">
      {#snippet icon()}<Fa icon={faCube} />{/snippet}
      <Button type="primary" icon={faCube} onclick={gotoBuild}>Build disk image</Button>
    </DashboardResourceCard>
    <DashboardResourceCard title="Try an Example Image" description="Pull and build the example httpd image.">
      {#snippet icon()}<Fa icon={faCloudArrowDown} />{/snippet}
      <FirstImage layout="dashboard" />
    </DashboardResourceCard>
  </div>

  <section aria-labelledby="dashboard-images" class="flex flex-col gap-4">
    <h2 id="dashboard-images" class="text-lg font-semibold text-[var(--pd-content-header)]">Images</h2>
    <div class="grid grid-cols-1 @min-[36rem]:grid-cols-2 gap-1">
      <DashboardResourceCard
        title="BootC container images"
        description="View and manage your bootable container images ready for disk image creation."
        count={bootcImageCount}>
        {#snippet icon()}<BootcImageIcon size="40" />{/snippet}
        <Button type="primary" icon={faEye} onclick={(): void => router.goto('/images/')}
          >View images</Button>
      </DashboardResourceCard>
      <DashboardResourceCard
        title="Disk images"
        description="View your built disk images in formats like QCOW2, RAW, ISO, AMI, and VMDK."
        count={diskImageCount}>
        {#snippet icon()}<LayersIcon />{/snippet}
        <Button
          type="primary"
          icon={faEye}
          onclick={(): void => router.goto('/disk-images/')}>View disk images</Button>
      </DashboardResourceCard>
    </div>
  </section>

  <section aria-labelledby="dashboard-learn" class="flex flex-col gap-4">
    <h2 id="dashboard-learn" class="text-lg font-semibold text-[var(--pd-content-header)]">Learn more</h2>
    <div class="flex flex-col gap-1">
      <DashboardGuideCard
        title="Image Builder"
        link="https://osbuild.org/docs/user-guide/introduction/"
        description="Learn how to use bootc-image-builder to create disk images from containers."
        action="Read guide">
        {#snippet icon()}<LayersIcon />{/snippet}
      </DashboardGuideCard>
      <DashboardGuideCard
        title="Image Mode for RHEL"
        link="https://developers.redhat.com/articles/2024/05/07/image-mode-rhel-bootable-containers"
        description="Introduction to image mode and bootable containers for Red Hat Enterprise Linux."
        action="Read article">
        {#snippet icon()}<Fa icon={faRedhat} class="text-[#ee0000]" />{/snippet}
      </DashboardGuideCard>
      <DashboardGuideCard
        title="Getting Started"
        link="https://docs.fedoraproject.org/en-US/bootc/getting-started/"
        description="Step-by-step guide to get started with bootc on Fedora."
        action="Read docs">
        {#snippet icon()}<Fa icon={faFedora} class="text-[#60a0d8]" />{/snippet}
      </DashboardGuideCard>
    </div>
  </section>
</DashboardPage>
