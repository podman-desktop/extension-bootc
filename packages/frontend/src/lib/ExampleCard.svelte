<script lang="ts">
import type { Example } from '/@shared/src/models/examples';
import { faArrowDown, faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { bootcClient } from '/@/api/client';
import { Button, Dropdown } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
import DiskImageIcon from './DiskImageIcon.svelte';
import { filesize } from 'filesize';
import { onMount } from 'svelte';

interface Props {
  example: Example;
}

let { example }: Props = $props();

let pullInProgress = $state(false);

let selectedArch = $state('');
let archOptions = [];

async function openURL(): Promise<void> {
  router.goto(`/example/${example.id}`);
}

async function pullImage(arch?: string): Promise<void> {
  if (example.image) {
    pullInProgress = true;
    bootcClient.telemetryLogUsage('example-pull-image', { image: example.image, arch: arch });
    bootcClient.pullImage(example.image, arch);
  }
}

async function gotoBuild(): Promise<void> {
  if (example.image && example.tag) {
    bootcClient.telemetryLogUsage('example-build-image', { image: example.image });
    router.goto(`/disk-images/build/${encodeURIComponent(example.image)}/${encodeURIComponent(example.tag)}`);
  }
}

onMount(async () => {
  // Get the default architecture based on `isArm`
  let defaultArch: string;

  // ONLY accept ARM and X86 architectures for now as
  // we don't support other architectures (yet) since they are not yet hosted / as common (ex. s390x)
  // if so, we just set it as undefined and let the user choose
  const hostArch = await bootcClient.getArch();
  if (hostArch === 'arm64') {
    defaultArch = 'arm64';
  } else if (hostArch === 'x64') {
    defaultArch = 'amd64';
  }

  // Generate options dynamically with labels in uppercase
  if (example.architectures) {
    archOptions = example.architectures.map(arch => ({
      label: arch.toUpperCase(),
      value: arch,
    }));

    // Ensure the selected architecture matches one of the options
    selectedArch = archOptions.find(option => option.value === defaultArch)?.value ?? archOptions[0]?.value ?? '';
  }
});
</script>

<div class="no-underline">
  <div
    class="bg-[var(--pd-content-card-bg)] hover:bg-[var(--pd-content-card-hover-bg)] grow p-4 h-full rounded-md flex-nowrap flex flex-col"
    role="region"
    aria-label={example.name}>
    <!-- Show 'architectures' in small font at the bottom-->
    {#if example.architectures}
      <div class="flex flex-row mb-1 justify-between items-center">
        <div class="flex flex-row">
          {#if example.size}
            <div class="text-[var(--pd-content-card-text)] opacity-50 text-xs uppercase mr-1">
              <span>{filesize(example.size)}</span>
            </div>
          {/if}

          {#if example.tag}
            <div class="text-[var(--pd-content-card-text)] opacity-50 text-xs uppercase">
              <span>{example.tag}</span>
            </div>
          {/if}
        </div>

        <div class="text-xs">
          <Dropdown
            name="archChoice"
            id="archChoice"
            class="text-xs"
            disabled={example?.state === 'pulled'}
            bind:value={selectedArch}
            options={example.architectures.map(arch => ({ label: arch.toUpperCase(), value: arch }))}>
          </Dropdown>
        </div>
      </div>
    {/if}

    <!-- body -->
    <div class="flex flex-row text-base grow">
      <!-- left column -->
      <div class="flex flex-col grow">
        <span class="text-[var(--pd-content-card-header-text)]">{example.name}</span>
        <span class="text-sm text-[var(--pd-content-card-text)]">{example.description}</span>
      </div>
    </div>

    <!-- footer -->
    <div class="flex flex-row mt-2 items-center justify-end">
      <Button
        on:click={openURL}
        icon={faArrowUpRightFromSquare}
        aria-label="MoreDetails"
        title="More Details"
        type="link"
        class="mr-2">More Details</Button>

      {#if example?.state === 'pulled'}
        <Button on:click={gotoBuild} icon={DiskImageIcon} aria-label="Build image" title="Build image" class="w-28"
          >Build image</Button>
      {:else if example?.state === 'unpulled'}
        <Button
          on:click={() => pullImage(selectedArch)}
          icon={faArrowDown}
          aria-label="Pull image"
          title="Pull image"
          inProgress={pullInProgress}>Pull image</Button>
      {:else}
        <!-- Show a spinner / in progress for querying button instead if we are still loading information-->
        <Button icon={faArrowDown} aria-label="Querying" title="Querying" inProgress={true}>Querying</Button>
      {/if}
    </div>
  </div>
</div>
