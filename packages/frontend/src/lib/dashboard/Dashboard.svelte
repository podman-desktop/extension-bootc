<script lang="ts">
import BootcSelkie from '../BootcSelkie.svelte';
import Link from '../Link.svelte';
import { Expandable } from '@podman-desktop/ui-svelte';
import DashboardPage from '../upstream/DashboardPage.svelte';
import DashboardResourceCard from '../upstream/DashboardResourceCard.svelte';
import DiskImageIcon from '../DiskImageIcon.svelte';
import DashboardGuideCard from '../upstream/DashboardGuideCard.svelte';
import { imageInfo } from '../../stores/imageInfo';
import { historyInfo } from '../../stores/historyInfo';
import osbuildImage from './osbuild.png';
import redhatImage from './redhat.png';
import fedoraImage from './fedora.png';
import BootcImageIcon from '../BootcImageIcon.svelte';
import FirstImage from '../FirstImage.svelte';

let bootcImageCount = $derived($imageInfo.length);
let diskImageCount = $derived($historyInfo.length);

const bootcImageBuilderSite = 'https://github.com/osbuild/bootc-image-builder';
const bootcSite = 'https://bootc-dev.github.io/bootc/';
const fedoraBaseImages = 'https://docs.fedoraproject.org/en-US/bootc/base-images/';
const extensionSite = 'https://github.com/containers/podman-desktop-extension-bootc';
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
    <FirstImage/>
  </div>

  <div class="text-xl pt-2">Metrics</div>
  <div class="grid grid-cols-4 gap-4">
    <DashboardResourceCard type="Bootc Images" Icon={BootcImageIcon} count={bootcImageCount} link="/images/" />
    <DashboardResourceCard type="Disk Images" Icon={DiskImageIcon} count={diskImageCount} link="/disk-images/" />
  </div>

  <div class="flex flex-1 flex-col pt-2">
    <Expandable>
      <!-- eslint-disable-next-line sonarjs/no-unused-vars -->
      {#snippet title()}<div class="text-xl">Explore articles and blog posts</div>{/snippet}
      <div class="grid grid-cols-3 gap-4">
        <DashboardGuideCard title='Image Builder user guide' image={osbuildImage} link='https://osbuild.org/docs/user-guide/introduction/'/>
        <DashboardGuideCard title='Introducing image mode for RHEL and bootable containers' image={redhatImage} link='https://developers.redhat.com/articles/2024/05/07/image-mode-rhel-bootable-containers'/>
        <DashboardGuideCard title='Getting started with bootable containers' image={fedoraImage} link='https://docs.fedoraproject.org/en-US/bootc/getting-started/'/>
      </div>
    </Expandable>
  </div>
</DashboardPage>
