<script lang="ts">
import './app.css';
import {
  faCube,
  faQuestionCircle,
  faTriangleExclamation,
  faMinusCircle,
  faPlusCircle,
  faKey,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import { bootcClient } from './api/client';
import type {
  BootcBuildInfo,
  BuildType,
  BuildConfig,
  BuildConfigAnacondaIsoInstallerModules,
} from '/@shared/src/models/bootc';
import Fa from 'svelte-fa';
import { onMount } from 'svelte';
import type { ImageInfo, ManifestInspectInfo } from '@podman-desktop/api';
import { router } from 'tinro';
import DiskImageIcon from './lib/DiskImageIcon.svelte';
import { Button, Input, EmptyScreen, FormPage, Checkbox, ErrorMessage, Expandable } from '@podman-desktop/ui-svelte';
import Link from './lib/Link.svelte';
import { historyInfo } from '/@/stores/historyInfo';
import { goToDiskImages } from './lib/navigation';
import { REPOSITORY_URL } from '/@shared/src/repository-infos';
import Stepper from './lib/stepper/Stepper.svelte';
import { Icon } from '@podman-desktop/ui-svelte/icons';

// Step definitions
type StepId = 'select-image' | 'output-config' | 'user-config' | 'build';

const STEPS = [
  { id: 'select-image', label: 'Select image' },
  { id: 'output-config', label: 'Output configuration' },
  { id: 'user-config', label: 'User configuration' },
  { id: 'build', label: 'Build' },
];

let currentStep = $state<StepId>('select-image');

interface Props {
  imageName?: string;
  imageTag?: string;
}

let { imageName = undefined, imageTag = undefined }: Props = $props();

// Image variables
let selectedImage = $state<string | undefined>(undefined);
let existingBuild = $state<boolean>(false);

// Architecture variable
// This is an array as we will be support manifests
// the array contains the architectures (ex. arm64, amd64, etc.) of the image
// we will ONLY enable the architectures that are available in the image / manifest within the form.
// this is to prevent the user from selecting an architecture that is not available in the image.
// Will either be 'arm64' or 'amd64' as that is all we support for now.
let availableArchitectures = $state<string[]>([]);

// Build options
let buildFolder = $state<string>('');
let buildConfigFile = $state<string>('');
let buildConfigAnacondaKickstartFilePath = $state<string>('');
let buildChown = $state<string>('');
let buildType = $state<BuildType[]>([]);
let buildArch = $state<string | undefined>(undefined);
let buildFilesystem = $state<string>(''); // Default filesystem auto-selected / empty
let overwrite = $state<boolean>(false);

// Other variable
let buildInProgress = $state<boolean>(false);
let bootcAvailableImages = $state<ImageInfo[]>([]);
let buildErrorMessage = $state<string>('');
let errorFormValidation = $state<string | undefined>(undefined);
let isInitialized = $state<boolean>(false);

// Prerequisites do not change with form input. Cache the initial result.
let cachedPrereqs: string | undefined;
let prereqsChecked = false;

// Specific to root filesystem selection
// SPECIFICALLY fedora, where we **need** to select the filesystem, as it is not auto-selected.
// this boolean will be set to true if the selected image is Fedora and shown as a warning to the user.
let fedoraDetected = $state<boolean>(false);
let isLinux = $state<boolean>(false);
let isMac = $state<boolean>(false);

// AWS Related
let awsAmiName = $state<string>('');
let awsBucket = $state<string>('');
let awsRegion = $state<string>('');

// Build Config related, we only support one entry for now
let buildConfigUsers = $state<{ name: string; password: string; key: string; groups: string }[]>([
  { name: '', password: '', key: '', groups: '' },
]);
let buildConfigFilesystems = $state<{ mountpoint: string; minsize: string }[]>([{ mountpoint: '', minsize: '' }]);
let buildConfigKernelArguments = $state<string>('');

// ISO related, anaconda installer modules
let buildConfigAnacondaIsoInstallerModules = $state<BuildConfigAnacondaIsoInstallerModules>({
  enable: [''],
  disable: [''],
});

function findImage(repoTag: string): ImageInfo | undefined {
  // Prefer the exact reference. Only local images support the localhost alias.
  const found =
    bootcAvailableImages.find(image => image.RepoTags?.includes(repoTag)) ??
    bootcAvailableImages.find(image => image.RepoTags?.includes(`localhost/${repoTag}`));

  // RPC arguments must not contain reactive proxies.
  return $state.snapshot(found);
}

// Find images associated to the manifest
// optionally, filter by the archiecture.
async function findImagesAssociatedToManifest(manifest: ManifestInspectInfo): Promise<ImageInfo[]> {
  const images = await bootcClient.listAllImages();
  return images.filter(image => {
    return manifest.manifests.some(manifest => image.Digest.includes(manifest.digest));
  });
}

// Function that will use listHistoryInfo, if there is anything in the list, pick the first one in the list (as it's the most recent)
// and fill buildFolder, buildType and buildArch with the values from the selected image.
async function fillBuildOptions(historyInfo: BootcBuildInfo[] = []): Promise<void> {
  // Fill the build options from history
  if (historyInfo.length > 0) {
    const latestBuild = historyInfo[0];
    buildFolder = latestBuild.folder;
    buildType = latestBuild.type;
    buildArch = latestBuild.arch;
  }

  // If an image name and tag were passed in, try to use it as the initially selected image
  let initialImage: ImageInfo | undefined;
  if (imageName && imageTag) {
    initialImage = findImage(`${imageName}:${imageTag}`);
  }

  // If not, use the last image from history if it is valid
  if (!initialImage && historyInfo.length > 0 && historyInfo[0].image && historyInfo[0].tag) {
    // Find the image that matches the latest build's name and tag
    initialImage = findImage(`${historyInfo[0].image}:${historyInfo[0].tag}`);
  }

  if (initialImage?.RepoTags && initialImage.RepoTags.length > 0) {
    selectedImage = initialImage.RepoTags[0];
  }
}

async function fillArchitectures(historyInfo: BootcBuildInfo[]): Promise<void> {
  // If there is only one available architecture, select it automatically.
  if (availableArchitectures.length === 1) {
    buildArch = availableArchitectures[0];
    return;
  }

  // If none are propagated yet, go through the history, update available architectures and select the latest one
  if (selectedImage && historyInfo.length > 0) {
    const latestArch = historyInfo[0].arch;
    await updateAvailableArchitectures(selectedImage);
    // Only set buildArch if it's available in availableArchitectures
    if (latestArch && availableArchitectures.includes(latestArch)) {
      buildArch = latestArch;
    }
  }
}

// This will fill the chown function by getting the user and group ID from the OS
// and filling in the information in the chown input field.
async function fillChownOption(): Promise<void> {
  try {
    const gidUid = await bootcClient.getUidGid();
    buildChown = gidUid;
  } catch (error) {
    console.error('Error getting UID and GID:', error);
  }
}

async function validate(): Promise<void> {
  if (!prereqsChecked) {
    try {
      cachedPrereqs = await bootcClient.checkPrereqs();
      prereqsChecked = true;
    } catch (err: unknown) {
      errorFormValidation = String(err);
      existingBuild = false;
      return;
    }
  }

  if (cachedPrereqs) {
    errorFormValidation = cachedPrereqs;
    existingBuild = false;
    return;
  }

  if (!selectedImage) {
    errorFormValidation = 'No image selected';
    existingBuild = false;
    return;
  }

  if (!buildFolder) {
    errorFormValidation = 'No output folder selected';
    existingBuild = false;
    return;
  }

  if (!buildType?.length) {
    errorFormValidation = 'Must select at least one disk image type';
    existingBuild = false;
    return;
  }

  if (!buildArch) {
    errorFormValidation = 'Architecture must be selected';
    existingBuild = false;
    return;
  }

  // If anaconda-iso was selected and the buildType length is more than 1, we error saying that iso must be the only type selected.
  if (buildType.length > 1 && buildType.includes('anaconda-iso')) {
    errorFormValidation = 'The Anaconda ISO file format cannot be built simultaneously with other image types.';
    existingBuild = false;
    return;
  }

  // overwrite
  existingBuild = await bootcClient.buildExists(buildFolder, [...buildType]);
  if (existingBuild && !overwrite) {
    errorFormValidation = 'Confirm overwriting existing build';
    return;
  }

  // no problems, ready to build!
  errorFormValidation = undefined;
}

async function buildBootcImage(): Promise<void> {
  // you can't get here without a selected image, but this
  // avoids a svelte error
  if (!selectedImage || buildInProgress) {
    return;
  }

  buildInProgress = true;
  try {
    // Before building a disk image name, we get a unique unused identifier for this image
    // This is to prevent the user from accidentally overwriting an history
    const buildImageName = selectedImage.split(':')[0];
    const buildID = await bootcClient.generateUniqueBuildID(buildImageName);

    // The build options
    const image = findImage(selectedImage);

    // Per bootc-image-builder spec, users with empty names are not valid
    if (buildConfigUsers) {
      buildConfigUsers = buildConfigUsers.filter(user => user.name);
    }

    // Per bootc-image-builder spec, filesystems with empty mountmounts are not valid
    if (buildConfigFilesystems) {
      buildConfigFilesystems = buildConfigFilesystems.filter(filesystem => filesystem.mountpoint);
    }

    // In the UI we accept comma deliminated, however the spec must require an array, so we convert any users.groups to an array.
    let convertedBuildConfigUsers = buildConfigUsers.map(user => {
      return {
        ...user,
        groups: user.groups.split(',').map(group => group.trim()),
      };
    });

    // Remove any elements that have buildConfigAnacondaIsoInstallerModules that are empty strings
    // as bootc-image-builder does not accept empty strings.
    let convertedBuildConfigAnacondaIsoInstallerModules = {
      enable: buildConfigAnacondaIsoInstallerModules.enable.filter(module => module !== ''),
      disable: buildConfigAnacondaIsoInstallerModules.disable.filter(module => module !== ''),
    };

    // Final object, remove any empty strings / null / undefined values as bootc-image-builder
    // does not accept empty strings / null / undefined values / ignore them.
    const buildConfig = removeEmptyStrings({
      user: convertedBuildConfigUsers,
      filesystem: buildConfigFilesystems,
      kernel: {
        append: buildConfigKernelArguments,
      },
      anacondaIsoInstallerKickstartFilePath: buildConfigAnacondaKickstartFilePath,
      anacondaIsoInstallerModules: convertedBuildConfigAnacondaIsoInstallerModules,
    }) as BuildConfig;

    const buildOptions: BootcBuildInfo = {
      id: buildID,
      image: buildImageName,
      imageId: image?.Id ?? '',
      tag: selectedImage.split(':')[1],
      engineId: image?.engineId ?? '',
      folder: buildFolder,
      // If all the entries are empty, we will not provide the buildConfig
      buildConfig,
      buildConfigFilePath: buildConfigFile,
      type: [...buildType], // Convert reactive proxy to plain array for IPC
      arch: buildArch,
      filesystem: buildFilesystem,
      chown: buildChown,
      awsAmiName: awsAmiName,
      awsBucket: awsBucket,
      awsRegion: awsRegion,
    };

    // If manifest is detected, we will instead use the child image ID, as that is the correct one associated to the selection. This is needed
    // for Linux support as we are transfering the image to the root podman connection and an ID is needed.
    if (image?.isManifest) {
      try {
        const manifest = await bootcClient.inspectManifest(image);
        const foundImages = await findImagesAssociatedToManifest(manifest);

        // Inspect each image and find the image that matches the buildArch
        for (const foundImage of foundImages) {
          const inspectedImage = await bootcClient.inspectImage(foundImage);
          if (inspectedImage.Architecture === buildArch) {
            buildOptions.imageId = foundImage.Id;
            break;
          }
        }

        // If no matching architecture found, throw an error
        if (!buildOptions.imageId) {
          throw new Error(`No matching architecture found for ${buildArch}`);
        }
      } catch (error) {
        console.error('Error inspecting manifest to retrieve image ID', error);
      }
    }

    // Do not await.. just start the build.
    // the reason being is that the validation / error logic happens in buildDiskImage
    // in the backend and it will error out there as that is where we can console.log
    // as well as notify the user of the error via showErrorMessage / showInformationMessage, etc.
    await bootcClient.buildImage(buildOptions, overwrite);

    // Continue doing listHistoryInfo until the build container name, tag, type and arch show up
    // this means we can safely exit and see it in the dashboard as it's now in the history / running in the background.
    let timeout = 0;
    const timeoutLimit = 15; // Timeout after 15 seconds. This should be "instantaneous" to the API, but sometimes the API may be slow (reload of the page during `pnpm watch`, machine freezes, etc.).

    // Continue until timeoutLimit is reached
    while (timeout < timeoutLimit) {
      const found = $historyInfo.find(info => info.id === buildID);

      if (found) {
        router.goto(`/disk-image/${btoa(found.id)}/build`);
        break; // Exit the loop if the build is found
      }

      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before the next check
      timeout++;
    }

    if (timeout === timeoutLimit) {
      throw new Error(
        'Timeout waiting trying to find the build in the history. Please check Podman Desktop console logs.',
      );
    }
  } catch (error) {
    buildErrorMessage = String(error);
  } finally {
    buildInProgress = false;
  }
}

async function getPath(): Promise<void> {
  buildFolder = await bootcClient.selectOutputFolder();
}

async function getBuildConfigFile(): Promise<void> {
  buildConfigFile = await bootcClient.selectBuildConfigFile();
}

async function getAnacondaKickstartFile(): Promise<void> {
  buildConfigAnacondaKickstartFilePath = await bootcClient.selectAnacondaKickstartFile();
}

function cleanup(): void {
  buildInProgress = false;
  buildErrorMessage = '';
  errorFormValidation = '';
}

function addUser(): void {
  buildConfigUsers = [...buildConfigUsers, { name: '', password: '', key: '', groups: '' }];
}

function deleteUser(index: number): void {
  buildConfigUsers = buildConfigUsers.filter((_, i) => i !== index);
}

function addFilesystem(): void {
  buildConfigFilesystems = [...buildConfigFilesystems, { mountpoint: '', minsize: '' }];
}

function deleteFilesystem(index: number): void {
  buildConfigFilesystems = buildConfigFilesystems.filter((_, i) => i !== index);
}

function addEnabledAnacondaInstallerModule(): void {
  buildConfigAnacondaIsoInstallerModules.enable = [...buildConfigAnacondaIsoInstallerModules.enable, ''];
}

function addDisabledAnacondaInstallerModule(): void {
  buildConfigAnacondaIsoInstallerModules.disable = [...buildConfigAnacondaIsoInstallerModules.disable, ''];
}

function deleteEnabledAnacondaInstallerModule(index: number): void {
  buildConfigAnacondaIsoInstallerModules.enable = buildConfigAnacondaIsoInstallerModules.enable.filter(
    (_, i) => i !== index,
  );
}

function deleteDisabledAnacondaInstallerModule(index: number): void {
  buildConfigAnacondaIsoInstallerModules.disable = buildConfigAnacondaIsoInstallerModules.disable.filter(
    (_, i) => i !== index,
  );
}

// Remove any empty strings in the object before passing it in to the backend
// this is useful as we are using "bind:input" with groups / form fields and the first entry will always be blank when submitting
// this will remove any empty strings from the object before passing it in.
// we do not need to work recursively since we are only working with the first level of the object.
function removeEmptyStrings<T>(obj: T): T | undefined {
  if (Array.isArray(obj)) {
    // Filter out empty strings, then check if array is empty
    const filteredArray = obj.map(removeEmptyStrings).filter(value => value !== '' && value !== undefined);
    return (filteredArray.length > 0 ? filteredArray : undefined) as T | undefined;
  } else if (obj !== undefined && typeof obj === 'object') {
    const filteredObject = Object.fromEntries(
      Object.entries(obj ?? {})
        .map(([key, value]) => [key, removeEmptyStrings(value)])
        .filter(([_, value]) => value !== '' && value !== undefined),
    );
    return (Object.keys(filteredObject).length > 0 ? filteredObject : undefined) as T | undefined;
  }
  return obj;
}

onMount(async () => {
  isLinux = await bootcClient.isLinux();
  isMac = await bootcClient.isMac();
  const images = await bootcClient.listBootcImages();

  // filter to images that have a repo tag here, to avoid doing it everywhere
  bootcAvailableImages = images.filter(image => image.RepoTags && image.RepoTags.length > 0);

  // Stop before the wizard if the machine does not meet the prerequisites.
  try {
    cachedPrereqs = await bootcClient.checkPrereqs();
    prereqsChecked = true;
  } catch (err: unknown) {
    buildErrorMessage = String(err);
    return;
  }

  if (cachedPrereqs) {
    buildErrorMessage = cachedPrereqs;
    return;
  }

  // Fills the build options with the last options
  await fillBuildOptions($historyInfo);
  await fillArchitectures($historyInfo);

  if (isLinux) {
    await fillChownOption();
  }

  isInitialized = true;
  await validate();
});

/// Find the selected image and update availableArchitectures with the architecture of the image
async function updateAvailableArchitectures(selectedImage: string): Promise<void> {
  const image = findImage(selectedImage);
  if (image) {
    // If it is a manifest, we can just inspectManifest and get the architecture(s) from there
    if (image?.isManifest) {
      try {
        const manifest = await bootcClient.inspectManifest(image);
        // Go through each manifest.manifests and get the architecture from manifest.platform.architecture
        availableArchitectures = manifest.manifests.map(manifest => manifest.platform.architecture);
      } catch (error) {
        console.error('Error inspecting manifest:', error);
      }
    } else {
      try {
        const imageInspect = await bootcClient.inspectImage(image);
        // Architecture is a mandatory field in the image inspect and should **always** be there.
        if (imageInspect?.Architecture) {
          availableArchitectures = [imageInspect.Architecture];
        } else {
          // If for SOME reason Architecture is missing (testing purposes, weird output, etc.)
          // we will set availableArchitectures to an empty array to disable the architecture selection.
          availableArchitectures = [];
          console.error('Architecture not found in image inspect:', selectedImage);
        }
      } catch (error) {
        console.error('Error inspecting image:', error);
      }
    }
  }
}

// Updates the filesystem selection based upon the select image,
// specifically if the image is Fedora we will  have to select the filesystem (it cannot be default).
async function detectFedoraImageFilesystem(selectedImage: string): Promise<void> {
  const image = findImage(selectedImage);
  let imageLabels = image?.Labels;

  // If it is a manifest, we must find the child images associated to the manifest
  // in order to get the labels used to determine if it's based on Fedora or not
  if (image?.isManifest) {
    try {
      const manifest = await bootcClient.inspectManifest(image);
      const foundImages = await findImagesAssociatedToManifest(manifest);

      // Just get the labels from the first image, as they should all be the same.
      imageLabels = foundImages[0]?.Labels;
    } catch (error) {
      console.error('Error inspecting manifest:', error);
    }
  }

  // We use a specical label to determine what the bootc image was built against. We do not use "annotations" due to limitations of the PD API
  // that does not show the annotations of the inspect image.
  // Each build will have 'ostree.linux' added as a label, within that label it is either el9 (for centos / rhel) or fc40 for Fedora.
  // the format for example will be: "ostree.linux": "5.14.0-437.el9.x86_64", or "ostree.linux": "6.8.9-300.fc40.aarch64",
  // we can use this to determine if the bootc image was built upon.
  // We will use regex to determine if it is fedora or not by checking if it contains "fcNUMBER" where NUMBER is the version of Fedora.
  if (imageLabels?.['ostree.linux']) {
    const label = imageLabels['ostree.linux'];
    const regEx: RegExp = RegExp(/fc\d+/);
    if (regEx.exec(label)) {
      // Make sure that we show the fedora disclaimer and auto-select xfs if buildFilesystem is empty.
      fedoraDetected = true;
      if (buildFilesystem === '') {
        buildFilesystem = 'xfs';
      }
    } else {
      fedoraDetected = false;
      buildFilesystem = '';
    }
  }
}

// update the array of build types
async function updateBuildType(type: BuildType, selected: boolean): Promise<void> {
  if (selected) {
    buildType = [...buildType, type];
  } else {
    buildType = buildType.filter(t => t !== type);
  }
  await validate();
}

// validate every time a selection changes in the form or available architectures
$effect(() => {
  // Read all dependencies to ensure effect re-runs when any of them change
  const _image = selectedImage;
  const _folder = buildFolder;
  const _arch = buildArch;
  const _overwrite = overwrite;
  const _buildTypeLength = buildType.length;
  const _initialized = isInitialized;

  // Only run validation after initial setup is complete
  if (_initialized && (_image || _folder || _arch || _overwrite || _buildTypeLength >= 0)) {
    validate().catch((e: unknown) => console.error('error validating on change', e));
  }
});

// Each time an image is selected, we need to update the available architectures
// to do that, inspect the image and get the architecture.
$effect(() => {
  if (selectedImage) {
    updateAvailableArchitectures(selectedImage).catch((e: unknown) => console.error('error updating architectures', e));
    detectFedoraImageFilesystem(selectedImage).catch((e: unknown) => console.error('error detecting filesystem', e));
  }
});

$effect(() => {
  if (availableArchitectures.length === 1) {
    buildArch = availableArchitectures[0];
    return;
  }

  // Read the history selection even when no architecture is available.
  if (buildArch && !availableArchitectures.includes(buildArch)) {
    buildArch = undefined;
  }
});

// Step navigation functions
function canProceedFromStep(step: StepId): boolean {
  switch (step) {
    case 'select-image':
      return !!selectedImage;
    case 'output-config':
      return !!buildFolder && buildType.length > 0 && !!buildArch;
    case 'user-config':
      return true; // User config is optional
    case 'build':
      return true;
    default:
      return false;
  }
}

function goToNext(): void {
  if (currentStep === 'select-image' && canProceedFromStep('select-image')) {
    currentStep = 'output-config';
  } else if (currentStep === 'output-config' && canProceedFromStep('output-config')) {
    currentStep = 'user-config';
  } else if (currentStep === 'user-config') {
    currentStep = 'build';
  }
}

function goBack(): void {
  if (currentStep === 'output-config') {
    currentStep = 'select-image';
  } else if (currentStep === 'user-config') {
    currentStep = 'output-config';
  } else if (currentStep === 'build') {
    currentStep = 'user-config';
  }
}

function handleStepClick(stepId: string): void {
  const stepIndex = STEPS.findIndex(s => s.id === stepId);
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  if (stepIndex < currentIndex) {
    currentStep = stepId as StepId;
  }
}

// Check if user has configured at least one user with SSH key or password for VM login
function hasUserConfiguredForLogin(): boolean {
  return buildConfigUsers.some(user => user.name && (user.key || user.password));
}
</script>

<FormPage
  title="Build Disk Image"
  inProgress={buildInProgress}
  breadcrumbLeftPart="Disk Images"
  breadcrumbRightPart="Build Disk Image"
  onclose={goToDiskImages}
  onbreadcrumbClick={goToDiskImages}>
  {#snippet icon()}
  <DiskImageIcon size="30px" />
  {/snippet}

  {#snippet content()}
  <div class="p-5 min-w-full h-fit">
    {#if buildErrorMessage}
      <EmptyScreen icon={faTriangleExclamation} title="Error with image build" message={buildErrorMessage}>
        <Button
          class="py-3"
          on:click={(): void => {
            cleanup();
            router.goto('/');
          }}>
          Go back
        </Button>
      </EmptyScreen>
    {:else}
      <fieldset
        disabled={buildInProgress}
        class="min-w-0 bg-[var(--pd-content-card-bg)] pt-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg text-[var(--pd-content-card-header-text)]">

        <!-- Stepper -->
        <div class="mb-6">
          <Stepper value={currentStep} steps={STEPS} onStepClick={handleStepClick} />
        </div>

        <div class={buildInProgress ? 'opacity-40 pointer-events-none' : ''}>

          <!-- Step 1: Select image -->
          {#if currentStep === 'select-image'}
            <div class="space-y-4">
              <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">
                Select bootable container image
              </h2>
              <p class="text-sm text-[var(--pd-content-card-text)]">
                Choose a bootable container image to convert into a disk image.
              </p>

              <div class="pb-4">
                <label for="modalImageTag" class="block mb-2 font-semibold">Bootable container image</label>
                <div class="relative">
                  <select
                    class="rounded-lg block w-full p-2.5 bg-charcoal-600 pl-8 border-r-8 border-transparent outline-1 outline outline-gray-900 placeholder-gray-700 text-white"
                    name="imageChoice"
                    aria-label="image-select"
                    bind:value={selectedImage}>
                    {#if !selectedImage}
                      <option value="" disabled selected>Select an image</option>
                    {/if}
                    {#if bootcAvailableImages.length > 0}
                      {#each bootcAvailableImages as image (image.Id)}
                        {#if image.RepoTags && image.RepoTags.length > 0}
                          <option value={image.RepoTags[0]}>{image.RepoTags[0]}</option>
                        {/if}
                      {/each}
                    {/if}
                  </select>
                  {#if bootcAvailableImages.length === 0}
                    <Fa
                      class="absolute left-0 top-0 ml-2 mt-3 text-[var(--pd-state-warning)]"
                      size="1x"
                      icon={faTriangleExclamation} />
                  {:else if selectedImage}
                    <Fa class="absolute left-0 top-0 ml-2 mt-3 text-[var(--pd-state-success)]" size="1x" icon={faCube} />
                  {:else}
                    <Fa
                      class="absolute left-0 top-0 ml-2 mt-3 text-[var(--pd-state-warning)]"
                      size="1x"
                      icon={faQuestionCircle} />
                  {/if}
                </div>
                {#if bootcAvailableImages.length === 0}
                  <p class="text-[var(--pd-state-warning)] pt-1">
                    No bootable container compatible images found. Learn to create one on our <Link
                      externalRef={REPOSITORY_URL}>README</Link
                    >.
                  </p>
                {/if}
              </div>

              <div class="flex justify-end mt-6">
                <Button disabled={!selectedImage} onclick={goToNext}>Next</Button>
              </div>
            </div>
          {/if}

          <!-- Step 2: Output configuration -->
          {#if currentStep === 'output-config'}
            <div class="space-y-4">
              <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">
                Output configuration
              </h2>
              <p class="text-sm text-[var(--pd-content-card-text)]">
                Configure the output folder, disk image type, filesystem, and target platform.
              </p>

              <div class="mb-3">
                <label for="path" class="block mb-2 font-semibold">Output folder</label>
                <div class="flex flex-row space-x-3">
                  <Input
                    name="path"
                    id="path"
                    bind:value={buildFolder}
                    placeholder="Output folder"
                    class="w-full"
                    aria-label="folder-select" />
                  <Button on:click={(): Promise<void> => getPath()}>Browse...</Button>
                </div>
              </div>

              <div class="mb-3">
                <span class="text-md font-semibold mb-2 block">Disk image type</span>
                <div class="grid grid-cols-2 gap-8">
                  <div class="flex flex-col ml-1 space-y-2">
                    <Checkbox
                      checked={buildType.includes('raw')}
                      title="raw-checkbox"
                      on:click={(e): Promise<void> => updateBuildType('raw', e.detail)}>
                      RAW image with partition table (*.raw)
                    </Checkbox>
                    <Checkbox
                      checked={buildType.includes('qcow2')}
                      title="qcow2-checkbox"
                      on:click={(e): Promise<void> => updateBuildType('qcow2', e.detail)}>
                      Virtualization guest image (*.qcow2)
                    </Checkbox>
                    <Checkbox
                      checked={buildType.includes('anaconda-iso')}
                      title="iso-checkbox"
                      on:click={(e): Promise<void> => updateBuildType('anaconda-iso', e.detail)}>
                      Unattended Anaconda ISO installer (*.iso)
                    </Checkbox>
                    <Checkbox
                      checked={buildType.includes('vmdk')}
                      title="vmdk-checkbox"
                      on:click={(e): Promise<void> => updateBuildType('vmdk', e.detail)}>
                      Virtual Machine Disk image (*.vmdk)
                    </Checkbox>
                  </div>
                  <div class="flex flex-col ml-1 space-y-2">
                    <Checkbox
                      checked={buildType.includes('ami')}
                      title="ami-checkbox"
                      on:click={(e): Promise<void> => updateBuildType('ami', e.detail)}>
                      Amazon Machine Image (*.ami)
                    </Checkbox>
                    <Checkbox
                      checked={buildType.includes('vhd')}
                      title="vhd-checkbox"
                      on:click={(e): Promise<void> => updateBuildType('vhd', e.detail)}>
                      Virtual Hard Disk (*.vhd)
                    </Checkbox>
                    <Checkbox
                      checked={buildType.includes('gce')}
                      title="gce-checkbox"
                      on:click={(e): Promise<void> => updateBuildType('gce', e.detail)}>
                      Google Cloud Engine (*.gce)
                    </Checkbox>
                  </div>
                </div>
              </div>

              <div class="mb-3">
                <span class="font-semibold mb-2 block">Filesystem</span>
                <div class="flex items-center mb-3 space-x-3">
                  <label for="defaultFs" class="ml-1 flex items-center cursor-pointer" aria-label="default-radio">
                    <input
                      bind:group={buildFilesystem}
                      disabled={fedoraDetected}
                      type="radio"
                      id="defaultFs"
                      name="filesystem"
                      value=""
                      class="sr-only peer"
                      aria-label="default-filesystem-select" />
                    <div
                      class="w-4 h-4 rounded-full border-2 border-[var(--pd-input-checkbox-unchecked)] mr-2 peer-checked:border-[var(--pd-input-checkbox-checked)] peer-checked:bg-[var(--pd-input-checkbox-checked)]">
                    </div>
                    <span class={fedoraDetected ? 'text-[var(--pd-input-field-disabled-text)]' : ''}>Default</span>
                  </label>
                  <label for="xfsFs" class="ml-1 flex items-center cursor-pointer" aria-label="xfs-radio">
                    <input
                      bind:group={buildFilesystem}
                      type="radio"
                      id="xfsFs"
                      name="filesystem"
                      value="xfs"
                      class="sr-only peer"
                      aria-label="xfs-filesystem-select" />
                    <div
                      class="w-4 h-4 rounded-full border-2 border-[var(--pd-input-checkbox-unchecked)] mr-2 peer-checked:border-[var(--pd-input-checkbox-checked)] peer-checked:bg-[var(--pd-input-checkbox-checked)]">
                    </div>
                    <span>XFS</span>
                  </label>
                  <label for="ext4Fs" class="ml-1 flex items-center cursor-pointer" aria-label="ext4-radio">
                    <input
                      bind:group={buildFilesystem}
                      type="radio"
                      id="ext4Fs"
                      name="filesystem"
                      value="ext4"
                      class="sr-only peer"
                      aria-label="ext4-filesystem-select" />
                    <div
                      class="w-4 h-4 rounded-full border-2 border-[var(--pd-input-checkbox-unchecked)] mr-2 peer-checked:border-[var(--pd-input-checkbox-checked)] peer-checked:bg-[var(--pd-input-checkbox-checked)]">
                    </div>
                    <span>EXT4</span>
                  </label>
                  <label for="btrfsFs" class="ml-1 flex items-center cursor-pointer" aria-label="btrfs-radio">
                    <input
                      bind:group={buildFilesystem}
                      type="radio"
                      id="btrfsFs"
                      name="filesystem"
                      value="btrfs"
                      class="sr-only peer"
                      aria-label="btrfs-filesystem-select" />
                    <div
                      class="w-4 h-4 rounded-full border-2 border-[var(--pd-input-checkbox-unchecked)] mr-2 peer-checked:border-[var(--pd-input-checkbox-checked)] peer-checked:bg-[var(--pd-input-checkbox-checked)]">
                    </div>
                    <span>BTRFS</span>
                  </label>
                </div>
                <p class="text-sm text-[var(--pd-content-text)]">
                  {#if fedoraDetected}
                    Fedora detected. By default Fedora requires a specific filesystem to be selected. XFS is recommended.
                  {:else}
                    The default filesystem is automatically detected based on the base container image. However, some
                    images such as Fedora may require a specific filesystem to be selected.
                  {/if}
                </p>
              </div>

              <div class="mb-3">
                <span class="font-semibold mb-2 block">Platform</span>
                <div class="flex items-center space-x-4">
                  <label class="flex items-center {availableArchitectures.includes('arm64') ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}">
                    <input
                      type="radio"
                      bind:group={buildArch}
                      name="arch"
                      value="arm64"
                      disabled={!availableArchitectures.includes('arm64')}
                      class="sr-only peer"
                      aria-label="arm64-select" />
                    <div
                      class="w-4 h-4 rounded-full border-2 border-[var(--pd-input-checkbox-unchecked)] mr-2 peer-checked:border-[var(--pd-input-checkbox-checked)] peer-checked:bg-[var(--pd-input-checkbox-checked)]"></div>
                    <span class={!availableArchitectures.includes('arm64') ? 'text-[var(--pd-input-field-disabled-text)]' : ''}>ARM64</span>
                  </label>
                  <label class="flex items-center {availableArchitectures.includes('amd64') ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}">
                    <input
                      type="radio"
                      bind:group={buildArch}
                      name="arch"
                      value="amd64"
                      disabled={!availableArchitectures.includes('amd64')}
                      class="sr-only peer"
                      aria-label="amd64-select" />
                    <div
                      class="w-4 h-4 rounded-full border-2 border-[var(--pd-input-checkbox-unchecked)] mr-2 peer-checked:border-[var(--pd-input-checkbox-checked)] peer-checked:bg-[var(--pd-input-checkbox-checked)]"></div>
                    <span class={!availableArchitectures.includes('amd64') ? 'text-[var(--pd-input-field-disabled-text)]' : ''}>AMD64</span>
                  </label>
                </div>

                {#if isMac && buildArch === 'amd64'}
                  <p class="text-sm text-[var(--pd-state-warning)] pt-2"
                  data-testid="cross-architecture-warning">
                    Cross-architecture building may not work correctly on macOS. Please refer to our
                    <Link externalRef={REPOSITORY_URL}>README</Link> for more information.
                  </p>
                {/if}
                <p class="text-sm text-[var(--pd-content-text)] pt-2">
                  Disk image architecture must match the architecture of the original image. For example, you must have an
                  ARM container image to build an ARM disk image. You can only select the architecture that is detectable
                  within the image or manifest.
                </p>
              </div>

              {#if errorFormValidation}
                <ErrorMessage aria-label="validation" error={errorFormValidation} />
              {/if}

              <div class="flex justify-between mt-6">
                <Button type="secondary" onclick={goBack}>Back</Button>
                <Button disabled={!buildFolder || buildType.length === 0 || !buildArch} onclick={goToNext}>Next</Button>
              </div>
            </div>
          {/if}

          <!-- Step 3: User configuration -->
          {#if currentStep === 'user-config'}
            <div class="space-y-4">
              <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">
                User configuration
              </h2>

              <p class="text-sm text-[var(--pd-content-card-text)]">
                Configure users, SSH keys, and passwords for your disk image. This will be saved in a build config file in the same directory as your output folder. More information can be found in the <Link
                  externalRef="https://github.com/osbuild/bootc-image-builder?tab=readme-ov-file\#-build-config"
                  >bootc-image-builder documentation</Link>.
              </p>


              <!-- Important notice about VM login -->
              <div class="p-4 rounded-lg bg-[var(--pd-content-card-inset-bg)] border-2 border-[var(--pd-button-primary-bg)]">
                <div class="flex items-start gap-3">
                  <Icon class="text-[var(--pd-button-primary-bg)] mt-1 text-[1.2em]" icon={faKey} />
                  <div>
                    <h3 class="font-semibold text-[var(--pd-content-card-header-text)] mb-2">
                      Important: Configure login credentials to access your VM
                    </h3>
                    <p class="text-sm text-[var(--pd-content-card-text)] mb-2">
                      To log into your virtual machine after booting, you must configure at least one of the following:
                    </p>
                    <ul class="text-sm text-[var(--pd-content-card-text)] list-disc list-inside space-y-1">
                      <li><strong>Option 1:</strong> Add your SSH public key for the <code class="bg-[var(--pd-content-card-bg)] px-1 rounded">root</code> user</li>
                      <li><strong>Option 2:</strong> Create a new user with a password and/or SSH public key</li>
                    </ul>
                    <p class="text-sm text-[var(--pd-content-card-text)] mt-2 opacity-80">
                      Without credentials configured, you will not be able to log into the virtual machine.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div class="flex items-center gap-2 mt-4 mb-2">
                  <Icon class="text-[var(--pd-content-card-header-text)]" icon={faUserPlus} />
                  <span class="font-semibold">Users</span>
                </div>
                <p class="text-sm text-[var(--pd-content-card-text)] mb-3">
                  Add users with their credentials. For SSH access, paste your public key (e.g., from <code class="bg-[var(--pd-content-card-inset-bg)] px-1 rounded">~/.ssh/id_ed25519.pub</code> or <code class="bg-[var(--pd-content-card-inset-bg)] px-1 rounded">~/.ssh/id_rsa.pub</code>).
                </p>
              </div>

              {#each buildConfigUsers as user, index (index)}
                <div class="p-3 rounded-lg bg-[var(--pd-content-card-inset-bg)] border border-[var(--pd-content-card-border)]">
                  <div class="flex flex-row justify-between items-center mb-2">
                    <span class="text-sm font-medium text-[var(--pd-content-card-header-text)]">User {index + 1}</span>
                    <div class="flex items-center">
                      <Button
                        type="link"
                        hidden={index === buildConfigUsers.length - 1}
                        on:click={(): void => deleteUser(index)}
                        icon={faMinusCircle} />
                      <Button
                        type="link"
                        hidden={index < buildConfigUsers.length - 1}
                        on:click={addUser}
                        icon={faPlusCircle} />
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="buildConfigName-{index}" class="block text-xs text-[var(--pd-content-card-text)] mb-1">Username</label>
                      <Input
                        bind:value={user.name}
                        id="buildConfigName-{index}"
                        placeholder="e.g., root or myuser" />
                    </div>
                    <div>
                      <label for="buildConfigPassword-{index}" class="block text-xs text-[var(--pd-content-card-text)] mb-1">Password (optional)</label>
                      <Input
                        bind:value={user.password}
                        id="buildConfigPassword-{index}"
                        placeholder="Password for console login" />
                    </div>
                    <div class="col-span-2">
                      <label for="buildConfigKey-{index}" class="block text-xs text-[var(--pd-content-card-text)] mb-1">SSH public key (recommended)</label>
                      <Input
                        bind:value={user.key}
                        id="buildConfigKey-{index}"
                        placeholder="ssh-ed25519 AAAA... or ssh-rsa AAAA..." />
                    </div>
                    <div class="col-span-2">
                      <label for="buildConfigGroups-{index}" class="block text-xs text-[var(--pd-content-card-text)] mb-1">Groups (comma separated)</label>
                      <Input
                        bind:value={user.groups}
                        id="buildConfigGroups-{index}"
                        placeholder="e.g., wheel,docker" />
                    </div>
                  </div>
                </div>
              {/each}

              <!-- Anaconda ISO options -->
              {#if buildType.includes('anaconda-iso')}
                <div class="mt-2">
                  <Expandable expanded={false}>
                    {#snippet title()}<div class="font-semibold">Anaconda ISO options</div>{/snippet}
                    <div class="ml-4 mt-2">
                      <div>
                        <span class="block mt-2" aria-label="anaconda-iso-installer-kickstart-file-title"
                          >Kickstart file</span>
                      </div>
                      <div class="mb-2">
                        <div class="flex flex-row space-x-3">
                          <Input
                            name="kickstart"
                            id="kickstart"
                            bind:value={buildConfigAnacondaKickstartFilePath}
                            placeholder="Kickstart file (*.ks)"
                            class="w-full"
                            aria-label="kickstart-select" />
                          <Button on:click={getAnacondaKickstartFile}>Browse...</Button>
                        </div>
                      </div>

                      <div>
                        <span class="block mt-4" aria-label="anaconda-iso-installer-module-title"
                          >Installer modules</span>
                      </div>
                      <div class="grid grid-cols-2 gap-4 mt-2">
                        <div>
                          <span class="block text-sm">Enable</span>
                          {#each buildConfigAnacondaIsoInstallerModules.enable as _, index (index)}
                            <div class="flex flex-row justify-center items-center w-full py-1">
                              <Input
                                placeholder="Module name"
                                class="mr-2"
                                bind:value={buildConfigAnacondaIsoInstallerModules.enable[index]} />
                              <Button
                                type="link"
                                hidden={index === buildConfigAnacondaIsoInstallerModules.enable.length - 1}
                                on:click={(): void => deleteEnabledAnacondaInstallerModule(index)}
                                icon={faMinusCircle} />
                              <Button
                                type="link"
                                hidden={index < buildConfigAnacondaIsoInstallerModules.enable.length - 1}
                                on:click={addEnabledAnacondaInstallerModule}
                                icon={faPlusCircle} />
                            </div>
                          {/each}
                        </div>
                        <div>
                          <span class="block text-sm">Disable</span>
                          {#each buildConfigAnacondaIsoInstallerModules.disable as _, index (index)}
                            <div class="flex flex-row justify-center items-center w-full py-1">
                              <Input
                                placeholder="Module name"
                                class="mr-2"
                                bind:value={buildConfigAnacondaIsoInstallerModules.disable[index]} />
                              <Button
                                type="link"
                                hidden={index === buildConfigAnacondaIsoInstallerModules.disable.length - 1}
                                on:click={(): void => deleteDisabledAnacondaInstallerModule(index)}
                                icon={faMinusCircle} />
                              <Button
                                type="link"
                                hidden={index < buildConfigAnacondaIsoInstallerModules.disable.length - 1}
                                on:click={addDisabledAnacondaInstallerModule}
                                icon={faPlusCircle} />
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </Expandable>
                </div>
              {/if}

              <div class="flex justify-between mt-6">
                <Button type="secondary" onclick={goBack}>Back</Button>
                <Button onclick={goToNext}>Next</Button>
              </div>
            </div>
          {/if}

          <!-- Step 4: Build -->
          {#if currentStep === 'build'}
            <div class="space-y-4">
              <h2 class="text-lg font-semibold text-[var(--pd-content-card-header-text)]">
                Review and build
              </h2>

              <p class="text-sm text-[var(--pd-content-card-text)]">
                Review your configuration and start the build process.
              </p>

              <!-- Configuration summary -->
              <div class="p-4 rounded-lg bg-[var(--pd-content-card-inset-bg)] border border-[var(--pd-content-card-border)]">
                <h3 class="font-semibold text-[var(--pd-content-card-header-text)] mb-3">Configuration summary</h3>
                <dl class="grid grid-cols-2 gap-2 text-sm">
                  <dt class="text-[var(--pd-content-card-text)]">Image:</dt>
                  <dd class="text-[var(--pd-content-card-header-text)] font-medium">{selectedImage}</dd>

                  <dt class="text-[var(--pd-content-card-text)]">Output folder:</dt>
                  <dd class="text-[var(--pd-content-card-header-text)] font-medium truncate">{buildFolder}</dd>

                  <dt class="text-[var(--pd-content-card-text)]">Disk type(s):</dt>
                  <dd class="text-[var(--pd-content-card-header-text)] font-medium">{buildType.join(', ')}</dd>

                  <dt class="text-[var(--pd-content-card-text)]">Architecture:</dt>
                  <dd class="text-[var(--pd-content-card-header-text)] font-medium">{buildArch}</dd>

                  <dt class="text-[var(--pd-content-card-text)]">Filesystem:</dt>
                  <dd class="text-[var(--pd-content-card-header-text)] font-medium">{buildFilesystem || 'Default'}</dd>

                  <dt class="text-[var(--pd-content-card-text)]">Users configured:</dt>
                  <dd class="text-[var(--pd-content-card-header-text)] font-medium">
                    {buildConfigUsers.filter(u => u.name).length > 0
                      ? buildConfigUsers.filter(u => u.name).map(u => u.name).join(', ')
                      : 'None'}
                  </dd>
                </dl>
              </div>

              <!-- Warning if no user credentials configured -->
              {#if !hasUserConfiguredForLogin()}
                <div class="p-4 rounded-lg bg-[var(--pd-state-warning)]/10 border border-[var(--pd-state-warning)]">
                  <div class="flex items-start gap-3">
                    <Fa class="text-[var(--pd-state-warning)] mt-1" size="1.2x" icon={faTriangleExclamation} />
                    <div>
                      <h3 class="font-semibold text-[var(--pd-state-warning)] mb-1">
                        No login credentials configured
                      </h3>
                      <p class="text-sm text-[var(--pd-content-card-text)]">
                        You have not configured any users with SSH keys or passwords. You will not be able to log into the virtual machine.
                        <Button type="link" padding="p-0" class="underline" onclick={goBack}>Go back to configure users</Button>.
                      </p>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- Filesystems section -->
              <div class="mb-2">
                <Expandable expanded={false}>
                  {#snippet title()}<div class="font-semibold">Filesystem configuration</div>{/snippet}
                  <div class="ml-4 mt-2">
                    <p class="text-sm text-[var(--pd-content-text)] mb-3">
                      Configure custom filesystem mountpoints and sizes.
                    </p>
                    {#each buildConfigFilesystems as filesystem, index (index)}
                      <div class="flex flex-row justify-center items-center w-full py-1">
                        <Input
                          bind:value={filesystem.mountpoint}
                          id="buildConfigFilesystemMountpoint.${index}"
                          placeholder="Mountpoint (ex. /mnt)"
                          class="mr-2" />

                        <Input
                          bind:value={filesystem.minsize}
                          id="buildConfigFilesystemMinimumSize.${index}"
                          placeholder="Minimum size (ex. '30 GiB')" />

                        <Button
                          type="link"
                          hidden={index === buildConfigFilesystems.length - 1}
                          on:click={(): void => deleteFilesystem(index)}
                          icon={faMinusCircle} />

                        <Button
                          type="link"
                          hidden={index < buildConfigFilesystems.length - 1}
                          on:click={addFilesystem}
                          icon={faPlusCircle} />
                      </div>
                    {/each}
                  </div>
                </Expandable>
              </div>

              <!-- Kernel arguments -->
              <div class="mb-2">
                <Expandable expanded={false}>
                  {#snippet title()}<div class="font-semibold">Kernel arguments</div>{/snippet}
                  <div class="ml-4 mt-2">
                    <Input
                      bind:value={buildConfigKernelArguments}
                      name="buildConfigKernelArguments"
                      id="buildConfigKernelArguments"
                      placeholder="Kernel arguments (ex. quiet)"
                      class="w-full" />
                  </div>
                </Expandable>
              </div>

              <!-- Build config file option -->
              <div class="mb-2">
                <Expandable expanded={false}>
                  {#snippet title()}<div class="font-semibold">Build config file (override)</div>{/snippet}
                  <div class="ml-4 mt-2">
                    <p class="text-sm text-[var(--pd-content-text)] mb-2">
                      Supplying a file will override <b>ALL</b> user configuration from the previous step. More
                      information can be found in the <Link
                        externalRef="https://github.com/osbuild/bootc-image-builder?tab=readme-ov-file\#-build-config"
                        >bootc-image-builder documentation</Link
                      >.
                    </p>
                    <div class="mb-2">
                      <div class="flex flex-row space-x-3">
                        <Input
                          name="buildconfig"
                          id="buildconfig"
                          bind:value={buildConfigFile}
                          placeholder="Build configuration file (config.toml or config.json)"
                          class="w-full"
                          aria-label="buildconfig-select" />
                        <Button on:click={getBuildConfigFile}>Browse...</Button>
                      </div>
                    </div>
                  </div>
                </Expandable>
              </div>

              <!-- Advanced options -->
              <div class="mb-2">
                <Expandable expanded={false}>
                  {#snippet title()}<div class="font-semibold">Advanced options</div>{/snippet}
                  <div class="ml-4 mt-2">
                    {#if isLinux}
                      <div class="mb-4">
                        <label for="chown" class="block mb-2 font-semibold">Change file owner and group</label>
                        <div class="flex flex-row space-x-3">
                          <Input
                            name="chown"
                            id="chown"
                            bind:value={buildChown}
                            placeholder="UID and GID parameters (ex. 1000:1000)"
                            class="w-full"
                            aria-label="chown-select" />
                        </div>
                        <p class="text-sm text-[var(--pd-content-text)] pt-2">
                          Linux only. By default the UID and GID of the current user is used. This option allows you to
                          change the owner and group of the files in the output directory.
                        </p>
                      </div>
                    {/if}

                    <div>
                      <span class="font-semibold block">Upload image to AWS</span>
                    </div>

                    <label for="amiName" class="block mt-2 text-sm font-bold">AMI name</label>
                    <Input
                      bind:value={awsAmiName}
                      name="amiName"
                      id="amiName"
                      placeholder="AMI name to be used"
                      class="w-full" />

                    <label for="awsBucket" class="block mt-2 text-sm font-bold">S3 bucket</label>
                    <Input
                      bind:value={awsBucket}
                      name="awsBucket"
                      id="awsBucket"
                      placeholder="AWS S3 bucket"
                      class="w-full" />

                    <label for="awsRegion" class="block mt-2 text-sm font-bold">S3 region</label>
                    <Input
                      bind:value={awsRegion}
                      name="awsRegion"
                      id="awsRegion"
                      placeholder="AWS S3 region"
                      class="w-full" />

                    <p class="text-sm text-[var(--pd-content-text)] pt-2">
                      This will upload the image to a specific AWS S3 bucket. Credentials stored at ~/.aws/credentials
                      will be used for uploading. You must have <Link
                        externalRef="https://docs.aws.amazon.com/vm-import/latest/userguide/required-permissions.html"
                        >vmimport service role</Link> configured to upload to the bucket.
                    </p>
                  </div>
                </Expandable>
              </div>

              {#if existingBuild}
                <Checkbox class="ml-1" title="overwrite-checkbox" bind:checked={overwrite}>Overwrite existing build</Checkbox>
              {/if}

              {#if errorFormValidation}
                <ErrorMessage aria-label="validation" error={errorFormValidation} />
              {/if}

              <!-- Platform-specific notices -->
              {#if isLinux}
                <p class="text-sm text-[var(--pd-content-text)]">
                  For Linux users during the build, you will be asked for your credentials in order to run an escalated
                  privileged build prompt for the build process.
                </p>
              {/if}

              <div class="flex justify-between mt-6">
                <Button type="secondary" onclick={goBack}>Back</Button>
                {#if buildInProgress}
                  <Button disabled={true}>Creating build task</Button>
                {:else}
                  <Button onclick={buildBootcImage} disabled={errorFormValidation !== undefined}>Build disk image</Button>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </fieldset>
    {/if}
  </div>
  {/snippet}
</FormPage>
