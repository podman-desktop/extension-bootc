<script lang="ts">
import { faFedora, faRedhat } from '@fortawesome/free-brands-svg-icons';
import {
  faArrowUpRightFromSquare,
  faCloudArrowDown,
  faCube,
  faEye,
  faLayerGroup,
} from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { Fa } from 'svelte-fa';
import BootcImageIcon from '/@/lib/BootcImageIcon.svelte';
import FirstImage from '/@/lib/FirstImage.svelte';
import { FEDORA_BOOTC_GUIDE_URL, IMAGE_BUILDER_GUIDE_URL, RHEL_IMAGE_MODE_URL } from '/@/lib/links';
import Link from '/@/lib/Link.svelte';
import { gotoBuild, goToDiskImages, gotoImages } from '/@/lib/navigation';
import DashboardGuideCard from '/@/lib/upstream/DashboardGuideCard.svelte';
import DashboardPage from '/@/lib/upstream/DashboardPage.svelte';
import DashboardResourceCard from '/@/lib/upstream/DashboardResourceCard.svelte';
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

  <section aria-labelledby="dashboard-get-started" class="flex flex-col gap-4">
    <h2 id="dashboard-get-started" class="text-lg font-semibold text-(--pd-content-header)">Get Started</h2>
    <div class="grid grid-cols-1 @min-[36rem]:grid-cols-2 gap-1">
      <DashboardResourceCard
        title="Build a disk image"
        description="Convert your bootable container image into a disk image (QCOW2, RAW, ISO, AMI, VMDK) ready for deployment.">
        {#snippet icon()}<Fa icon={faCube} />{/snippet}
        <Button type="primary" icon={faCube} onclick={gotoBuild}>Build disk image</Button>
      </DashboardResourceCard>
      <DashboardResourceCard title="Try an Example Image" description="Pull and build the example httpd image.">
        {#snippet icon()}<Fa icon={faCloudArrowDown} />{/snippet}
        <FirstImage compact />
      </DashboardResourceCard>
    </div>
  </section>

  <section aria-labelledby="dashboard-images" class="flex flex-col gap-4">
    <h2 id="dashboard-images" class="text-lg font-semibold text-(--pd-content-header)">Images</h2>
    <div class="grid grid-cols-1 @min-[36rem]:grid-cols-2 gap-1">
      <DashboardResourceCard
        title="BootC container images"
        description="View and manage your bootable container images ready for disk image creation."
        count={bootcImageCount}>
        {#snippet icon()}<BootcImageIcon size="40" />{/snippet}
        <Button type="primary" icon={faEye} onclick={gotoImages}>View images</Button>
      </DashboardResourceCard>
      <DashboardResourceCard
        title="Disk images"
        description="View your built disk images in formats like QCOW2, RAW, ISO, AMI, and VMDK."
        count={diskImageCount}>
        {#snippet icon()}<Fa icon={faLayerGroup} />{/snippet}
        <Button type="primary" icon={faEye} onclick={goToDiskImages}>View disk images</Button>
      </DashboardResourceCard>
    </div>
  </section>

  <section aria-labelledby="dashboard-learn" class="flex flex-col gap-4">
    <h2 id="dashboard-learn" class="text-lg font-semibold text-(--pd-content-header)">Learn more</h2>
    <div class="flex flex-col gap-1">
      <DashboardGuideCard
        title="Image Builder"
        link={IMAGE_BUILDER_GUIDE_URL}
        description="Learn how to use bootc-image-builder to create disk images from containers."
        action="Read guide">
        {#snippet icon()}<Fa icon={faLayerGroup} />{/snippet}
      </DashboardGuideCard>
      <DashboardGuideCard
        title="Image Mode for RHEL"
        link={RHEL_IMAGE_MODE_URL}
        description="Introduction to image mode and bootable containers for Red Hat Enterprise Linux."
        action="Read article">
        {#snippet icon()}<Fa icon={faRedhat} />{/snippet}
      </DashboardGuideCard>
      <DashboardGuideCard
        title="Getting Started"
        link={FEDORA_BOOTC_GUIDE_URL}
        description="Step-by-step guide to get started with bootc on Fedora."
        action="Read docs">
        {#snippet icon()}<Fa icon={faFedora} />{/snippet}
      </DashboardGuideCard>
    </div>
  </section>
</DashboardPage>
