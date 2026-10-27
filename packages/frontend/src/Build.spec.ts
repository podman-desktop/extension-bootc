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

const BUILD_HISTORY_TIMEOUT_MS = 2_000;

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
async function goToStep(step: 'build-config' | 'user-config'): Promise<void> {
  await clickNext();
  if (step === 'user-config') {
    await clickNext();
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

async function renderWizard(existingBuild = false): Promise<void> {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);
  vi.mocked(bootcClient.buildExists).mockResolvedValue(existingBuild);

  render(Build, { imageName: 'image1', imageTag: 'latest' });
  await waitForImagesAndSelect(2);
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
}

test('review: resolve overwrite errors on the output step', async () => {
  await renderWizard(true);
  await clickNext();

  expect(await screen.findByRole('alert')).toHaveTextContent('Confirm overwriting existing build');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'User configuration' })).toBeDisabled();

  await userEvent.click(screen.getByLabelText('overwrite-checkbox'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'User configuration' })).toBeEnabled();
});

test('review: block forward navigation for incompatible image types', async () => {
  await renderWizard();
  await clickNext();
  await userEvent.click(screen.getByLabelText('iso-checkbox'));

  expect(screen.getByRole('alert')).toHaveTextContent(
    'The Anaconda ISO file format cannot be built simultaneously with other image types.',
  );
  for (const name of ['Next', 'User configuration']) {
    expect(screen.getByRole('button', { name })).toBeDisabled();
  }
});

test('review: return directly to the final user step', async () => {
  await renderWizard();
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'User configuration' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Build configuration' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'User configuration' }));
  expect(screen.getByRole('button', { name: 'Build disk image' })).toBeEnabled();
  expect(screen.queryByRole('heading', { name: 'Configuration summary' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Select image' }));
  await userEvent.click(screen.getByRole('button', { name: 'User configuration' }));
  expect(screen.getByRole('button', { name: 'Build disk image' })).toBeEnabled();

  await userEvent.click(screen.getByRole('button', { name: 'Build configuration' }));
  await userEvent.clear(screen.getByLabelText('folder-select'));
  expect(screen.getByRole('button', { name: 'User configuration' })).toBeDisabled();
});

test('review: ignore outdated output checks and block navigation while pending', async () => {
  await renderWizard();
  await clickNext();
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());

  const previousCheck = Promise.withResolvers<boolean>();
  vi.mocked(bootcClient.buildExists).mockReturnValueOnce(previousCheck.promise);
  await userEvent.clear(screen.getByLabelText('folder-select'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/previous-output');
  await vi.waitFor(() => expect(bootcClient.buildExists).toHaveBeenCalledWith('/previous-output', ['raw']));
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

  await userEvent.clear(screen.getByLabelText('folder-select'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/current-output');
  await vi.waitFor(() => expect(bootcClient.buildExists).toHaveBeenCalledWith('/current-output', ['raw']));
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());

  previousCheck.resolve(true);
  await previousCheck.promise;
  expect(screen.queryByLabelText('overwrite-checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('require new overwrite consent when the output changes', async () => {
  await renderWizard(true);
  await clickNext();
  await userEvent.click(await screen.findByLabelText('overwrite-checkbox'));
  expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();

  vi.mocked(bootcClient.buildExists).mockClear();
  await userEvent.clear(screen.getByLabelText('folder-select'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/another-existing-output');
  await vi.waitFor(() => expect(screen.getByLabelText('overwrite-checkbox')).not.toBeChecked());
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(bootcClient.buildExists).toHaveBeenCalledExactlyOnceWith('/another-existing-output', ['raw']);
});

test('show output check failures on the output step', async () => {
  await renderWizard();
  await clickNext();
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());

  vi.mocked(bootcClient.buildExists).mockRejectedValueOnce(new Error('Output is unavailable'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/unavailable');

  expect(await screen.findByRole('alert')).toHaveTextContent('Output is unavailable');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'User configuration' })).toBeDisabled();
});

test('keep output errors on their step for a new build', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue([]);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);

  render(Build, { imageName: 'image1', imageTag: 'latest' });
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Build configuration' })).toBeEnabled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'User configuration' })).toBeDisabled();

  await userEvent.click(screen.getByRole('button', { name: 'Build configuration' }));
  expect(screen.getByRole('alert')).toHaveTextContent('No output folder selected');
});

test('allow a new build when history is unavailable', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockRejectedValue(new Error('History is unavailable'));
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  vi.mocked(bootcClient.inspectImage).mockResolvedValue(mockImageInspect);
  vi.mocked(bootcClient.checkPrereqs).mockResolvedValue(undefined);

  render(Build, { imageName: 'image1', imageTag: 'latest' });
  await clickNext();

  expect(screen.getByLabelText('folder-select')).toHaveValue('');
  expect(screen.getByRole('alert')).toHaveTextContent('No output folder selected');
});

test('keep the latest image architecture after a delayed inspection', async () => {
  await renderWizard();
  const previousImage = Promise.withResolvers<ImageInspectInfo>();
  vi.mocked(bootcClient.inspectImage).mockClear();
  vi.mocked(bootcClient.inspectImage).mockReturnValueOnce(previousImage.promise);
  vi.mocked(bootcClient.inspectImage).mockResolvedValueOnce({ ...mockImageInspect, Architecture: 'arm64' });

  await userEvent.selectOptions(screen.getByLabelText('image-select'), 'image2:latest');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText('image-select'), 'image1:latest');
  await clickNext();
  expect(screen.getByLabelText('arm64-select')).toBeChecked();

  previousImage.resolve(mockImageInspect);
  await previousImage.promise;
  expect(screen.getByLabelText('arm64-select')).toBeChecked();
  expect(screen.getByLabelText('amd64-select')).toBeDisabled();
  expect(bootcClient.inspectImage).toHaveBeenCalledTimes(2);
});

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
  await goToStep('build-config');

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

  for (const name of ['Select image', 'Build configuration', 'User configuration']) {
    screen.getByRole('button', { name });
  }
  expect(screen.getByRole('navigation', { name: 'Build steps' }).querySelectorAll('button')).toHaveLength(3);
  expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();

  await goToStep('build-config');
  screen.getByText('Virtualization guest image (*.qcow2)');
  screen.getByText('Unattended Anaconda ISO installer (*.iso)');
  screen.getByText('Amazon Machine Image (*.ami)');
  await userEvent.clear(screen.getByLabelText('folder-select'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/wizard-output');
  await userEvent.click(screen.getByLabelText('raw-checkbox'));
  await userEvent.click(screen.getByLabelText('iso-checkbox'));
  screen.getByText('Anaconda ISO options');
  screen.getByText('Filesystem configuration');
  screen.getByText('Kernel arguments');

  await userEvent.click(screen.getByText('Advanced options'));
  screen.getByRole('textbox', { name: 'AMI name' });
  screen.getByPlaceholderText('AMI name to be used');
  screen.getByRole('textbox', { name: 'S3 bucket' });
  screen.getByRole('textbox', { name: 'S3 region' });

  await clickNext();
  screen.getByRole('textbox', { name: 'SSH public key (recommended)' });
  screen.getByRole('button', { name: 'Build disk image' });
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  expect(screen.queryByText('Advanced options')).not.toBeInTheDocument();
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
  await goToStep('build-config');
  await userEvent.clear(screen.getByLabelText('folder-select'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/wizard-output');
  if (!(screen.getByLabelText('raw-checkbox') as HTMLInputElement).checked) {
    await userEvent.click(screen.getByLabelText('raw-checkbox'));
  }
  await clickNext();

  await userEvent.click(screen.getByRole('button', { name: 'Build disk image' }));
  for (const name of ['Select image', 'Build configuration', 'User configuration', 'Back']) {
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
  await goToStep('build-config');

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
  await goToStep('build-config');

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
  await goToStep('build-config');

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
  await goToStep('build-config');
  await userEvent.clear(screen.getByLabelText('folder-select'));
  await userEvent.type(screen.getByLabelText('folder-select'), '/wizard-output');
  const raw = screen.getByLabelText('raw-checkbox');
  if (!(raw as HTMLInputElement).checked) {
    await userEvent.click(raw);
  }
  await clickNext();
  screen.getByRole('heading', { name: 'No login credentials configured' });

  await userEvent.type(screen.getByRole('textbox', { name: 'Username' }), 'root');
  await userEvent.type(screen.getByRole('textbox', { name: 'SSH public key (recommended)' }), 'ssh-ed25519 test-key');
  expect(screen.queryByRole('heading', { name: 'No login credentials configured' })).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  await userEvent.click(screen.getByRole('button', { name: 'User configuration' }));
  expect(screen.getByRole('textbox', { name: 'Username' })).toHaveValue('root');
  expect(screen.getByRole('textbox', { name: 'SSH public key (recommended)' })).toHaveValue('ssh-ed25519 test-key');
});

test('show the configuration file override on the final user step', async () => {
  await renderWizard();
  await goToStep('build-config');
  await userEvent.click(screen.getByText('Build config file (override)'));
  await userEvent.type(screen.getByLabelText('buildconfig-select'), '/config.toml');
  await clickNext();

  expect(screen.getByText('The configuration file', { exact: false })).toHaveTextContent(
    'The configuration file /config.toml overrides these user settings.',
  );
  expect(screen.queryByRole('heading', { name: 'No login credentials configured' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Build disk image' })).toBeEnabled();
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
  await goToStep('build-config');

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

  // Go to build-config step where architecture options are shown
  await goToStep('build-config');

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

  // Go to build-config step where architecture options are shown
  await goToStep('build-config');

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

test('show an inspection error on the image step and block navigation', async () => {
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

  expect(await screen.findByRole('alert')).toHaveTextContent('Error');
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Build configuration' })).toBeDisabled();
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

  // Go to build-config step where architecture options are shown
  await goToStep('build-config');

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

  // Go to build-config step where architecture options are shown
  await goToStep('build-config');

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

  // Go to build-config step where filesystem options are shown
  await goToStep('build-config');

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

  // Open the build settings to edit advanced options.
  await waitForImagesAndSelect(2, 'image1:latest');
  await goToStep('build-config');

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
  await goToStep('build-config');

  // Unclick raw checkbox as it's the default from history
  const raw = screen.getByLabelText('raw-checkbox');
  await userEvent.click(raw);

  // Get checkbox 'iso-checkbox' and click it.
  const iso = screen.getByLabelText('iso-checkbox');
  await userEvent.click(iso);

  // Get checkbox 'qcow2-checkbox' and click it.
  const qcow2 = screen.getByLabelText('qcow2-checkbox');
  await userEvent.click(qcow2);

  // Expect alert to be shown
  const validation = screen.getByRole('alert');
  expect(validation).toBeDefined();
  expect(validation.textContent).toEqual(
    'The Anaconda ISO file format cannot be built simultaneously with other image types.',
  );
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
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
  await goToStep('build-config');

  // confirm overwriting the previous build
  const overwriteCheck = screen.getByLabelText('overwrite-checkbox');
  expect(overwriteCheck).toBeDefined();
  await userEvent.click(overwriteCheck);

  // Build settings must survive navigation to the final user step.
  await userEvent.click(screen.getByText('Kernel arguments'));
  await userEvent.type(screen.getByPlaceholderText('Kernel arguments (ex. quiet)'), 'quiet');
  await userEvent.click(screen.getByText('Filesystem configuration'));
  await userEvent.type(screen.getByPlaceholderText('Mountpoint (ex. /mnt)'), '/var');
  await userEvent.type(screen.getByPlaceholderText(/^Minimum size/), '10 GiB');
  await userEvent.click(screen.getByText('Advanced options'));
  await userEvent.type(screen.getByRole('textbox', { name: 'AMI name' }), 'wizard-ami');

  await clickNext();
  await userEvent.type(screen.getByRole('textbox', { name: 'Username' }), 'builder');
  await userEvent.type(screen.getByRole('textbox', { name: 'SSH public key (recommended)' }), 'ssh-ed25519 test-key');
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  await userEvent.click(screen.getByText('Kernel arguments'));
  expect(screen.getByPlaceholderText('Kernel arguments (ex. quiet)')).toHaveValue('quiet');
  await clickNext();

  // confirm build button is enabled
  const build = screen.getByRole('button', { name: 'Build disk image' });
  expect(build).toBeInTheDocument();
  expect(build).toBeEnabled();

  // check that clicking redirects to the build logs page
  expect(router.goto).not.toHaveBeenCalled();
  await userEvent.click(build);
  expect(bootcClient.buildImage).toHaveBeenCalledWith(
    expect.objectContaining({
      awsAmiName: 'wizard-ami',
      buildConfig: expect.objectContaining({
        kernel: { append: 'quiet' },
        filesystem: [{ mountpoint: '/var', minsize: '10 GiB' }],
        user: [{ name: 'builder', key: 'ssh-ed25519 test-key' }],
      }),
    }),
    true,
  );
  await vi.waitFor(() => expect(router.goto).toHaveBeenCalledWith(`/disk-image/bmFtZTE=/build`), {
    timeout: BUILD_HISTORY_TIMEOUT_MS,
  });
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
  await goToStep('build-config');

  // Select anaconda-iso type to enable anaconda options
  await userEvent.click(screen.getByLabelText('raw-checkbox'));
  const iso = screen.getByLabelText('iso-checkbox');
  await userEvent.click(iso);

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
  await goToStep('build-config');

  // Select anaconda-iso type to enable anaconda options
  await userEvent.click(screen.getByLabelText('raw-checkbox'));
  const iso = screen.getByLabelText('iso-checkbox');
  await userEvent.click(iso);

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
  await goToStep('build-config');

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
