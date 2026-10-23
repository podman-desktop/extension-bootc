/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import '@testing-library/jest-dom/vitest';

import { vi, test, expect } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import Build from './Build.svelte';
import type { BootcBuildInfo } from '/@shared/src/models/bootc';
import type { ImageInfo, ImageInspectInfo, ManifestInspectInfo } from '@podman-desktop/api';
import { bootcClient } from './api/client';
import { router } from 'tinro';
import userEvent from '@testing-library/user-event';
import { historyInfo } from './stores/historyInfo';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';
import { REPOSITORY_URL } from '/@shared/src/repository-infos';

const mockHistoryInfo: BootcBuildInfo[] = [
  {
    id: 'name1',
    imageId: 'sha256:image1',
    image: 'image1',
    engineId: 'engine1',
    tag: 'latest',
    type: ['raw'],
    folder: '/foo/image1',
    arch: 'x86_64',
  },
  {
    id: 'name2',
    image: 'image2',
    imageId: 'sha256:image',
    engineId: 'engine2',
    tag: 'latest',
    type: ['qcow2'],
    folder: '/foo/image1',
    arch: 'x86_64',
  },
];

// Mocked bootc images, with one containing the 'bootc' and 'containers.bootc' labels, and the other not
const mockBootcImages: ImageInfo[] = [
  {
    Id: 'image1',
    RepoTags: ['image1:latest'],
    Labels: {
      bootc: 'true',
    },
    engineId: 'engine1',
    engineName: 'engine1',
    ParentId: 'parent1',
    Digest: 'sha256:image1',
  },
  {
    Id: 'image2',
    RepoTags: ['image2:latest'],
    Labels: {
      bootc: 'true',
    },
    engineId: 'engine2',
    engineName: 'engine2',
    ParentId: 'parent2',
    Digest: 'sha256:image2',
  },
] as unknown as ImageInfo[];

const mockImageInspect = {
  Architecture: 'amd64',
} as unknown as ImageInspectInfo;

const mockIsLinux = false;
const mockIsMac = false;
const mockIsWindows = false;

vi.mock('./api/client', async () => {
  return {
    bootcClient: {
      checkPrereqs: vi.fn(),
      buildExists: vi.fn(),
      listHistoryInfo: vi.fn(),
      listBootcImages: vi.fn(),
      listAllImages: vi.fn().mockResolvedValue([]),
      inspectImage: vi.fn(),
      inspectManifest: vi.fn(),
      isLinux: vi.fn().mockImplementation(() => mockIsLinux),
      generateUniqueBuildID: vi.fn(),
      buildImage: vi.fn(),
      isMac: vi.fn().mockImplementation(() => mockIsMac),
      isWindows: vi.fn().mockImplementation(() => mockIsWindows),
      openLink: vi.fn(),
      getUidGid: vi.fn(),
    },
    rpcBrowser: {
      subscribe: (): Subscriber => {
        return {
          unsubscribe: (): void => {},
        };
      },
    },
  };
});

// mock the router
vi.mock('tinro', () => {
  return {
    router: {
      goto: vi.fn(),
    },
  };
});

vi.mock('svelte/transition', () => ({
  slide: (): { delay: number; duration: number } => ({
    delay: 0,
    duration: 0,
  }),
  fade: (): { delay: number; duration: number } => ({
    delay: 0,
    duration: 0,
  }),
}));

// Helper function to wait for images to load and optionally select one
async function waitForImagesAndSelect(expectedCount: number = 2, selectImage?: string): Promise<void> {
  await vi.waitFor(() => {
    const select = screen.getByLabelText('image-select');
    if (select?.children.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} images, got ${select?.children.length}`);
    }
  });

  if (selectImage) {
    const select = screen.getByLabelText('image-select') as HTMLSelectElement;
    await userEvent.selectOptions(select, selectImage);
  }
}

// Helper function to navigate to a specific step (from step 1 - select-image)
async function goToStep(step: 'output-config' | 'user-config' | 'build'): Promise<void> {
  // Click Next button to proceed through steps
  let stepsToClick = 3;
  if (step === 'output-config') {
    stepsToClick = 1;
  } else if (step === 'user-config') {
    stepsToClick = 2;
  }

  for (let i = 0; i < stepsToClick; i++) {
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await userEvent.click(nextButton);
  }
}

// Helper function to click Next once (for incremental navigation)
// Waits for the button to be enabled before clicking
async function clickNext(): Promise<void> {
  await vi.waitFor(() => {
    const btn = screen.getByRole('button', { name: 'Next' });
    if (btn.hasAttribute('disabled')) {
      throw new Error('Next button still disabled');
    }
  });
  const nextButton = screen.getByRole('button', { name: 'Next' });
  await userEvent.click(nextButton);
}

test('Render shows correct images and history', async () => {
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);

  // need to subscrible once to prime the store
  const unsub = historyInfo.subscribe(_v => {});
  unsub();

  render(Build);

  // Wait for images to load
  await waitForImagesAndSelect(2);

  const select = screen.getByLabelText('image-select');
  expect(select).toBeDefined();
  expect(select.children).toHaveLength(2);

  // Expect image:1 to be first since it's the last one in the history
  expect(select.children[0].textContent).toEqual('image1:latest');
  expect(select.children[1].textContent).toEqual('image2:latest');

  // Select first image and go to step 2 to check output options
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  // Expect input iso to be selected (from history)
  const raw = screen.getByLabelText('raw-checkbox');
  expect(raw).toBeDefined();
  expect(raw).toBeChecked();

  // Expect input amd64 to be selected
  const x86_64 = screen.getByLabelText('amd64-select');
  expect(x86_64).toBeDefined();
  expect(x86_64).toBeChecked();

  // Expect input /tmp/image1 to be selected
  const folder = screen.getByLabelText('folder-select');
  expect(folder).toBeDefined();

  //  expect(folder.value).toBe('/tmp/image1');
  // but use isIsnstanceIf for checking
  expect(folder).toBeInstanceOf(HTMLInputElement);
});

test('use sentence case throughout the build wizard', async () => {
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);

  render(Build, { imageName: 'image1', imageTag: 'latest' });
  await waitForImagesAndSelect(2, 'image1:latest');

  for (const name of ['Select image', 'Output configuration', 'User configuration', 'Build']) {
    screen.getByRole('button', { name });
  }
  screen.getByRole('heading', { name: 'Select bootable container image' });

  await goToStep('output-config');
  screen.getByRole('heading', { name: 'Output configuration' });
  screen.getByText('Virtualization guest image (*.qcow2)');
  screen.getByText('Unattended Anaconda ISO installer (*.iso)');
  screen.getByText('Amazon Machine Image (*.ami)');
  await userEvent.clear(screen.getByLabelText('folder-select'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/wizard-output');
  await userEvent.click(screen.getByLabelText('iso-checkbox'));
  await clickNext();

  screen.getByRole('heading', { name: 'User configuration' });
  screen.getByRole('textbox', { name: 'SSH public key (recommended)' });
  screen.getByText('Anaconda ISO options');
  await clickNext();

  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Review and build');
  screen.getByRole('heading', { name: 'Configuration summary' });
  for (const name of ['Output folder:', 'Disk type(s):', 'Users configured:']) {
    screen.getByText(name, { exact: true });
  }
  screen.getByText('Filesystem configuration');
  screen.getByText('Kernel arguments');
  screen.getByRole('button', { name: 'Build disk image' });

  await userEvent.click(screen.getByText('Advanced options'));
  screen.getByRole('textbox', { name: 'AMI name' });
  screen.getByPlaceholderText('AMI name to be used');
  screen.getByRole('textbox', { name: 'S3 bucket' });
  screen.getByRole('textbox', { name: 'S3 region' });
});

test('disable wizard controls throughout build submission', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  const buildId = Promise.withResolvers<string>();
  const build = Promise.withResolvers<void>();
  vi.mocked(bootcClient.generateUniqueBuildID).mockReturnValueOnce(buildId.promise);
  vi.mocked(bootcClient.buildImage).mockReturnValueOnce(build.promise);

  render(Build, { imageName: 'image1', imageTag: 'latest' });
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');
  await userEvent.clear(screen.getByLabelText('folder-select'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/wizard-output');
  if (!(screen.getByLabelText('raw-checkbox') as HTMLInputElement).checked) {
    await userEvent.click(screen.getByLabelText('raw-checkbox'));
  }
  await clickNext();
  await clickNext();

  await userEvent.click(screen.getByRole('button', { name: 'Build disk image' }));
  for (const name of ['Select image', 'Output configuration', 'User configuration', 'Back']) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }

  buildId.resolve('pending-build');
  await vi.waitFor(() => {
    expect(bootcClient.buildImage).toHaveBeenCalled();
  });
  expect(screen.getByRole('button', { name: 'User configuration' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Creating build task' })).toBeDisabled();

  build.reject(new Error('Build submission failed'));
  await screen.findByText('Error: Build submission failed');
});

test('Check that VMDK option is there', async () => {
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);

  render(Build);

  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  const vmdk = screen.getByLabelText('vmdk-checkbox');
  expect(vmdk).toBeDefined();
});

test('Check that GCE option is there', async () => {
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);

  render(Build);

  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  const gce = screen.getByLabelText('gce-checkbox');
  expect(gce).toBeDefined();
});

test('Check that preselecting an image works', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  render(Build, { imageName: 'image2', imageTag: 'latest' });

  // Wait until children length is 2 meaning it's fully rendered / propagated the changes
  await vi.waitFor(() => {
    if (screen.getByLabelText('image-select')?.children.length !== 2) {
      throw new Error();
    }
  });

  const select = screen.getByLabelText('image-select') as HTMLSelectElement;
  expect(select).toBeDefined();
  expect(select.children).toHaveLength(2);

  // Expect image:1 to be first since it's the last one in the history
  expect(select.children[0].textContent).toEqual('image1:latest');
  expect(select.children[1].textContent).toEqual('image2:latest');

  // Expect the one we passed in to be selected
  const selectedImage = select.value;
  expect(selectedImage).toBeDefined();
  expect(selectedImage).toEqual('image2:latest');
});

test('Check that prereq validation works', async () => {
  const prereq = 'Something is missing';
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(prereq);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);

  render(Build);

  await screen.findByText(prereq);
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
});

test('check prerequisites once across form changes', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);

  render(Build);
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  vi.mocked(bootcClient.checkPrereqs).mockClear();
  await userEvent.type(screen.getByLabelText('folder-select'), '/new-output');
  await userEvent.click(screen.getByLabelText('qcow2-checkbox'));
  await clickNext();

  expect(bootcClient.checkPrereqs).not.toHaveBeenCalled();
});

test('select the exact image instead of a suffix match from another registry', async () => {
  const repoTag = 'example/app:latest';
  const images = [
    { ...mockBootcImages[0], RepoTags: [`quay.io/${repoTag}`] },
    { ...mockBootcImages[1], RepoTags: [repoTag] },
  ];
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(images);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);

  render(Build, { imageName: 'example/app', imageTag: 'latest' });

  await vi.waitFor(() => {
    expect(screen.getByLabelText('image-select')).toHaveValue(repoTag);
  });
});

test('preserve login credentials through wizard navigation', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);

  render(Build, { imageName: 'image1', imageTag: 'latest' });
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');
  await userEvent.clear(screen.getByLabelText('folder-select'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/wizard-output');
  const raw = screen.getByLabelText('raw-checkbox');
  if (!(raw as HTMLInputElement).checked) {
    await userEvent.click(raw);
  }
  await clickNext();
  await clickNext();
  screen.getByRole('heading', { name: 'No login credentials configured' });

  await userEvent.click(screen.getByRole('button', { name: 'Go back to configure users' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Username' }), 'root');
  await userEvent.type(screen.getByRole('textbox', { name: 'SSH public key (recommended)' }), 'ssh-ed25519 test-key');
  await clickNext();
  expect(screen.queryByRole('heading', { name: 'No login credentials configured' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'User configuration' }));
  expect(screen.getByRole('textbox', { name: 'Username' })).toHaveValue('root');
  expect(screen.getByRole('textbox', { name: 'SSH public key (recommended)' })).toHaveValue('ssh-ed25519 test-key');
});

test('Check that overwriting an existing build works', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(true);

  // Mock the inspectImage to return 'amd64' as the architecture so it's selected / we can test the override function
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);

  render(Build, { imageName: 'image2', imageTag: 'latest' });

  // Wait for images to load
  await waitForImagesAndSelect(2);

  // Navigate to output config (step 2) - history pre-fills folder, type, arch
  await goToStep('output-config');

  // Go to user-config then build step (2 more clicks) - form is pre-filled from history
  await clickNext(); // to user-config
  await clickNext(); // to build

  const overwrite = screen.getByLabelText('Overwrite existing build');
  expect(overwrite).toBeDefined();
  const overwrite2 = screen.getByLabelText('overwrite-checkbox');
  expect(overwrite2).toBeDefined();

  const validation = screen.getByRole('alert');
  expect(validation).toBeDefined();
  expect(validation.textContent).toEqual('Confirm overwriting existing build');

  // select the checkbox and give it time to validate
  await userEvent.click(overwrite2);

  const validation2 = screen.queryByRole('alert');
  expect(validation2).toBeNull();
});

const fakedImageInspect: ImageInspectInfo = {
  Architecture: 'amd64',
  engineId: 'engineid',
  engineName: 'engineName',
} as unknown as ImageInspectInfo;

test('Test that arm64 is disabled in form if inspectImage returns no arm64', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(fakedImageInspect);

  render(Build, { imageName: 'image2', imageTag: 'latest' });

  // Wait for images to load
  await waitForImagesAndSelect(2);

  // Go to output-config step where architecture options are shown
  await goToStep('output-config');

  const arm64 = screen.getByLabelText('arm64-select');
  expect(arm64).toBeDefined();
  expect(arm64).toBeDisabled();

  // Expect input amd64 to be selected
  const x86_64 = screen.getByLabelText('amd64-select');
  expect(x86_64).toBeDefined();
  expect(x86_64).toBeChecked();
});

test('In the rare case that Architecture from inspectImage is blank, do not select either', async () => {
  const fakeImageNoArchitecture = { ...fakedImageInspect, Architecture: '' };

  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(fakeImageNoArchitecture);

  render(Build, { imageName: 'image2', imageTag: 'latest' });

  // Wait for images to load
  await waitForImagesAndSelect(2);

  // Go to output-config step where architecture options are shown
  await goToStep('output-config');

  const arm64 = screen.getByLabelText('arm64-select');
  expect(arm64).toBeDefined();
  expect(arm64).toBeDisabled();

  const x86_64 = screen.getByLabelText('amd64-select');
  expect(x86_64).toBeDefined();
  expect(x86_64).toBeDisabled();
});

test('Do not show an image if it has no repotags and has isManifest as false', async () => {
  const mockedImages: ImageInfo[] = [
    {
      Id: 'image1',
      RepoTags: [],
      Labels: {
        bootc: 'true',
      },
      engineId: 'engine1',
      engineName: 'engine1',
      ParentId: 'parent1',
      Digest: 'sha256:image1',
      isManifest: false,
    },
  ] as unknown as ImageInfo[];

  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockedImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);

  render(Build);

  // Wait until children length is 1
  await vi.waitFor(() => {
    if (screen.getByLabelText('image-select')?.children.length !== 1) {
      throw new Error();
    }
  });

  const select = screen.getByLabelText('image-select');
  expect(select).toBeDefined();
  expect(select.children).toHaveLength(1);
  expect(select.children[0].textContent).toEqual('Select an image');

  // Find the <p> that CONTAINS "No bootable container compatible images found."
  const noImages = screen.getByText(/No bootable container compatible images found./);
  expect(noImages).toBeDefined();

  const link = screen.getByText('README');
  expect(link).toBeDefined();

  await userEvent.click(link);

  expect(bootcClient.openLink).toBeCalledWith(REPOSITORY_URL);
});

test('If inspectImage fails, do not select any architecture / make them available', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.inspectImage).mockRejectedValue('Error');

  let history: BootcBuildInfo[] = [];
  const unsubscribe = historyInfo.subscribe(value => {
    history = value;
  });
  await vi.waitFor(() => {
    expect(history).toEqual(mockHistoryInfo);
  });
  unsubscribe();

  render(Build, { imageName: 'image2', imageTag: 'latest' });

  // Wait for images to load
  await waitForImagesAndSelect(2);

  // Go to output-config step where architecture options are shown
  await goToStep('output-config');

  const arm64 = screen.getByLabelText('arm64-select');
  expect(arm64).toBeDefined();
  expect(arm64).toBeDisabled();

  const x86_64 = screen.getByLabelText('amd64-select');
  expect(x86_64).toBeDefined();
  expect(x86_64).toBeDisabled();

  await userEvent.type(screen.getByLabelText('folder-select'), '/wizard-output');
  if (!(screen.getByLabelText('raw-checkbox') as HTMLInputElement).checked) {
    await userEvent.click(screen.getByLabelText('raw-checkbox'));
  }
  expect(screen.getByRole('alert')).toHaveTextContent('Architecture must be selected');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('Show the image if isManifest: true and Labels is empty', async () => {
  const mockedImages: ImageInfo[] = [
    {
      Id: 'testmanifest1',
      RepoTags: ['testmanifest1:latest'],
      Labels: {},
      engineId: 'engine1',
      engineName: 'engine1',
      ParentId: 'parent1',
      Digest: 'sha256:image1',
      isManifest: true,
    },
    // "children" images of a manifest that has the 'bootc' and 'containers.bootc' labels
    // they have no repo tags, but have the labels / architecture
    {
      Id: 'image2',
      RepoTags: [],
      Labels: {
        bootc: 'true',
      },
      engineId: 'engine1',
      engineName: 'engine1',
      ParentId: 'parent1',
      Digest: 'sha256:image2',
      isManifest: false,
    },
  ] as unknown as ImageInfo[];

  const mockedManifestInspect: ManifestInspectInfo = {
    engineId: 'podman1',
    engineName: 'podman',
    manifests: [
      {
        digest: 'sha256:image2',
        mediaType: 'mediaType',
        platform: {
          architecture: 'amd64',
          features: [],
          os: 'os',
          variant: 'variant',
        },
        size: 100,
        urls: ['url1', 'url2'],
      },
    ],
    mediaType: 'mediaType',
    schemaVersion: 1,
  };

  vi.mocked(bootcClient.inspectManifest).mockResolvedValue(mockedManifestInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockedImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  render(Build, { imageName: 'testmanifest1', imageTag: 'latest' });

  await vi.waitFor(() => {
    expect(bootcClient.inspectManifest).toHaveBeenCalled();
  });

  // Wait to render
  await new Promise(resolve => setTimeout(resolve, 200));

  const select = screen.getByLabelText('image-select');
  expect(select).toBeDefined();
  expect(select.children).toHaveLength(1);
  expect(select.children[0].textContent).toEqual('testmanifest1:latest');

  // Go to output-config step where architecture options are shown
  await goToStep('output-config');

  // Expect input amd64 to be selected
  const x86_64 = screen.getByLabelText('amd64-select');
  expect(x86_64).toBeDefined();
  expect(x86_64).toBeChecked();

  // arm64 should be disabled
  const arm64 = screen.getByLabelText('arm64-select');
  expect(arm64).toBeDefined();
  expect(arm64).toBeDisabled();
});

test('have amd64 and arm64 NOT disabled if inspectManifest contains both architectures / child images', async () => {
  const mockedImages: ImageInfo[] = [
    {
      Id: 'testmanifest1',
      RepoTags: ['testmanifest1:latest'],
      Labels: {},
      engineId: 'engine1',
      engineName: 'engine1',
      ParentId: 'parent1',
      Digest: 'sha256:image1',
      isManifest: true,
    },
    // "children" images of a manifest that has the 'bootc' and 'containers.bootc' labels
    // they have no repo tags, but have the labels / architecture
    {
      Id: 'image2',
      RepoTags: [],
      Labels: {
        bootc: 'true',
      },
      engineId: 'engine1',
      engineName: 'engine1',
      ParentId: 'parent1',
      Digest: 'sha256:image2',
      isManifest: false,
    },
    {
      Id: 'image3',
      RepoTags: [],
      Labels: {
        bootc: 'true',
      },
      engineId: 'engine1',
      engineName: 'engine1',
      ParentId: 'parent1',
      Digest: 'sha256:image3',
      isManifest: false,
    },
  ] as unknown as ImageInfo[];

  const mockedManifestInspect: ManifestInspectInfo = {
    engineId: 'podman1',
    engineName: 'podman',
    manifests: [
      {
        digest: 'sha256:image2',
        mediaType: 'mediaType',
        platform: {
          architecture: 'amd64',
          features: [],
          os: 'os',
          variant: 'variant',
        },
        size: 100,
        urls: ['url1', 'url2'],
      },
      {
        digest: 'sha256:image3',
        mediaType: 'mediaType',
        platform: {
          architecture: 'arm64',
          features: [],
          os: 'os',
          variant: 'variant',
        },
        size: 100,
        urls: ['url1', 'url2'],
      },
    ],
    mediaType: 'mediaType',
    schemaVersion: 1,
  };

  vi.mocked(bootcClient.inspectManifest).mockResolvedValue(mockedManifestInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockedImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  render(Build, { imageName: 'testmanifest1', imageTag: 'latest' });

  await vi.waitFor(() => {
    expect(bootcClient.inspectManifest).toHaveBeenCalled();
  });

  // Wait to render
  await new Promise(resolve => setTimeout(resolve, 200));

  const select = screen.getByLabelText('image-select');
  expect(select).toBeDefined();
  expect(select.children).toHaveLength(1);
  expect(select.children[0].textContent).toEqual('testmanifest1:latest');

  // Go to output-config step where architecture options are shown
  await goToStep('output-config');

  // Expect amd64 and arm64 to be not disabled
  const x86_64 = screen.getByLabelText('amd64-select');
  expect(x86_64).toBeDefined();
  expect(x86_64).not.toBeDisabled();

  const arm64 = screen.getByLabelText('arm64-select');
  expect(arm64).toBeDefined();
  expect(arm64).not.toBeDisabled();

  // Native arrow-key navigation requires a shared radio group name.
  expect(arm64).toHaveAttribute('name', 'arch');
  expect(x86_64).toHaveAttribute('name', 'arch');

  await userEvent.click(arm64);
  await userEvent.keyboard('{ArrowRight}');
  expect(x86_64).toBeChecked();
  expect(arm64).not.toBeChecked();
});

test('if a manifest is created that has the label "6.8.9-300.fc40.aarch64" in associated digest images, xfs should be selected by default', async () => {
  // Mock manifest and image data with Fedora label
  const mockManifestInspect = {
    engineId: 'podman1',
    engineName: 'podman',
    manifests: [
      {
        digest: 'sha256:fedoraImage',
        mediaType: 'mediaType',
        platform: {
          architecture: 'aarch64',
          features: [],
          os: 'os',
          variant: 'variant',
        },
        size: 100,
        urls: ['url1', 'url2'],
      },
    ],
    mediaType: 'mediaType',
    schemaVersion: 1,
  };

  const mockFedoraImage = {
    Id: 'fedoraImage',
    RepoTags: ['fedoraImage:latest'],
    Labels: {
      'ostree.linux': '6.8.9-300.fc40.aarch64',
    },
    engineId: 'podman1',
    engineName: 'podman',
    ParentId: '',
    Digest: 'sha256:fedoraImage',
  } as unknown as ImageInfo;

  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.inspectManifest).mockResolvedValue(mockManifestInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue([mockFedoraImage]);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);

  render(Build, { imageName: 'fedoraImage', imageTag: 'latest' });

  await new Promise(resolve => setTimeout(resolve, 200));

  // Go to output-config step where filesystem options are shown
  await goToStep('output-config');

  const xfsRadio = screen.getByLabelText('xfs-filesystem-select');
  expect(xfsRadio).toBeDefined();
  // expect it to be selected
  expect(xfsRadio).toBeChecked();
});

test('collapse and uncollapse of advanced options', async () => {
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);

  render(Build);

  // Wait for images and navigate to build step where advanced options are
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  // Go to user-config then build (2 more clicks) - form is pre-filled from history
  await clickNext(); // to user-config
  await clickNext(); // to build

  const advancedOptions = screen.getByText('Advanced options');
  expect(advancedOptions).toBeDefined();

  for (const name of ['AMI name', 'S3 bucket', 'S3 region']) {
    expect(screen.queryByRole('textbox', { name })).not.toBeInTheDocument();
  }

  await userEvent.click(advancedOptions);
  await userEvent.type(screen.getByRole('textbox', { name: 'AMI name' }), 'test-ami');
  screen.getByRole('textbox', { name: 'S3 bucket' });
  screen.getByRole('textbox', { name: 'S3 region' });

  await userEvent.click(advancedOptions);
  expect(screen.queryByRole('textbox', { name: 'AMI name' })).not.toBeInTheDocument();
  await userEvent.click(advancedOptions);
  expect(screen.getByRole('textbox', { name: 'AMI name' })).toHaveValue('test-ami');
});

test('select anaconda-iso and qcow2 and expect validation error to be shown', async () => {
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  render(Build);

  // Wait for images and navigate to output config
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  // Unclick raw checkbox as it's the default from history
  const raw = screen.getByLabelText('raw-checkbox');
  await userEvent.click(raw);

  // Get checkbox 'iso-checkbox' and click it.
  const iso = screen.getByLabelText('iso-checkbox');
  await userEvent.click(iso);

  // Get checkbox 'qcow2-checkbox' and click it.
  const qcow2 = screen.getByLabelText('qcow2-checkbox');
  await userEvent.click(qcow2);

  // Go to build step to see validation (2 more clicks from output-config)
  await clickNext(); // to user-config
  await clickNext(); // to build

  // Expect alert to be shown
  const validation = screen.getByRole('alert');
  expect(validation).toBeDefined();
  expect(validation.textContent).toEqual(
    'The Anaconda ISO file format cannot be built simultaneously with other image types.',
  );
});

test('confirm successful build goes to logs', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(true);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);

  // mock unique id so that it matches an image in the history ('new' build exists already)
  vi.mocked(bootcClient.generateUniqueBuildID).mockReturnValue(Promise.resolve(mockHistoryInfo[0].id));

  render(Build);

  // Wait for images and navigate through steps
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  // Go to user-config then build (2 more clicks) - form is pre-filled from history
  await clickNext(); // to user-config
  await clickNext(); // to build

  // confirm overwriting the previous build
  const overwriteCheck = screen.getByLabelText('overwrite-checkbox');
  expect(overwriteCheck).toBeDefined();
  await userEvent.click(overwriteCheck);

  // confirm build button is enabled
  const build = screen.getByRole('button', { name: 'Build disk image' });
  expect(build).toBeInTheDocument();
  expect(build).toBeEnabled();

  // check that clicking redirects to the build logs page
  expect(router.goto).not.toHaveBeenCalled();
  await userEvent.click(build);
  expect(router.goto).toHaveBeenCalledWith(`/disk-image/bmFtZTE=/build`);
});

test('expect anaconda modules ISO section to be shown', async () => {
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  render(Build);

  // Wait for images and navigate to output config
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  // Select anaconda-iso type to enable anaconda options
  const iso = screen.getByLabelText('iso-checkbox');
  await userEvent.click(iso);

  // Architecture is auto-selected based on mockImageInspect (amd64)
  // Proceed to user config step
  const nextButton = screen.getByRole('button', { name: 'Next' });
  await userEvent.click(nextButton);

  // Click on Anaconda ISO options
  const anacondaOptions = screen.getByText('Anaconda ISO options');
  expect(anacondaOptions).toBeDefined();
  await userEvent.click(anacondaOptions);

  // Expect anaconda modules to be shown
  const anacondaModules = screen.getByLabelText('anaconda-iso-installer-module-title');
  expect(anacondaModules).toBeDefined();
});

test('expect anaconda kickstart file section to be shown', async () => {
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  render(Build);

  // Wait for images and navigate to output config
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  // Select anaconda-iso type to enable anaconda options
  const iso = screen.getByLabelText('iso-checkbox');
  await userEvent.click(iso);

  // Architecture is auto-selected based on mockImageInspect (amd64)
  // Proceed to user config step
  const nextButton = screen.getByRole('button', { name: 'Next' });
  await userEvent.click(nextButton);

  // Click on Anaconda ISO options
  const anacondaOptions = screen.getByText('Anaconda ISO options');
  expect(anacondaOptions).toBeDefined();
  await userEvent.click(anacondaOptions);

  // Expect anaconda kickstart file to be shown
  const anacondaKickstart = screen.getByLabelText('anaconda-iso-installer-kickstart-file-title');
  expect(anacondaKickstart).toBeDefined();
});

test('on mount, expect checkPrereqs to be called', async () => {
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  render(Build);

  // Wait until children length is 2 meaning it's fully rendered / propagated the changes
  await vi.waitFor(() => {
    if (screen.getByLabelText('image-select')?.children.length !== 2) {
      throw new Error();
    }
  });

  expect(bootcClient.checkPrereqs).toHaveBeenCalled();
});

test('purposely fail prereqs, expect an error to show going to build', async () => {
  const prereq = 'We failed the prereq connection check';
  vi.mocked(bootcClient.checkPrereqs).mockRejectedValue(prereq);
  render(Build);

  // Wait for the error message to appear
  await vi.waitFor(() => {
    // Wait for heading name 'Error with image build' to appear
    const errorHeading = screen.getByText('Error with image build');
    expect(errorHeading).toBeDefined();

    // Expect prereq error message to be shown
    const errorMessage = screen.getByText(prereq);
    expect(errorMessage).toBeDefined();
  });
});

// The below mocks are the same across all tests.
const setupPlatformMocks = (platform: string): void => {
  vi.mocked(bootcClient.isMac).mockResolvedValue(platform === 'macOS');
  vi.mocked(bootcClient.isWindows).mockResolvedValue(platform === 'windows');
  vi.mocked(bootcClient.isLinux).mockResolvedValue(platform === 'linux');
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(false);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
};

// Test for macOS, Windows and Linux - cross-architecture warning visibility
test.each([
  { platform: 'macOS', shouldShow: true },
  { platform: 'windows', shouldShow: false },
  { platform: 'linux', shouldShow: false }, // Linux doesn't show cross-arch warning, only macOS does
])('cross-architecture-warning visibility on %s when amd64 is selected', async ({ platform, shouldShow }) => {
  setupPlatformMocks(platform);
  render(Build);

  // Wait for images and navigate to output config
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('output-config');

  const x86_64 = screen.getByLabelText('amd64-select');
  expect(x86_64).toBeDefined();
  await userEvent.click(x86_64);

  const warning = screen.queryByTestId('cross-architecture-warning');
  if (shouldShow) {
    expect(warning).toBeDefined();
  } else {
    expect(warning).toBeNull();
  }
});
