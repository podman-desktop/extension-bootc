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

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { router } from 'tinro';
import { beforeEach, expect, test, vi } from 'vitest';
import { bootcClient } from '/@/api/client';
import Dashboard from './Dashboard.svelte';
import type { ImageInfo } from '@podman-desktop/api';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';
import type { BootcBuildInfo } from '/@shared/src/models/bootc';
import { REPOSITORY_URL } from '/@shared/src/repository-infos';

const exampleImage = 'registry.gitlab.com/fedora/bootc/examples/httpd:latest';

const mockBootcImages: ImageInfo[] = [
  {
    Id: 'registry.gitlab.com/fedora/bootc/examples/httpd',
    RepoTags: ['latest'],
    Labels: {
      bootc: 'true',
    },
    engineId: 'engine1',
    engineName: 'engine1',
    ParentId: 'parent1',
    Created: 0,
    VirtualSize: 0,
    Size: 0,
    Containers: 0,
    SharedSize: 0,
    Digest: 'sha256:1234567890abcdef',
  },
];

const mockDiskImage: BootcBuildInfo = {
  id: 'disk-image',
  image: 'localhost/bootc',
  imageId: 'image-id',
  tag: 'latest',
  engineId: 'engine1',
  type: ['qcow2'],
  folder: '/images',
};

vi.mock('tinro', () => ({ router: { goto: vi.fn() } }));

vi.mock('/@/api/client', async () => {
  return {
    bootcClient: {
      listHistoryInfo: vi.fn(),
      listBootcImages: vi.fn(),
      isMac: vi.fn(),
      isWindows: vi.fn(),
      openLink: vi.fn(),
      pullImage: vi.fn(),
      telemetryLogUsage: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue([]);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue([]);
});

test('Show the dashboard sections', () => {
  render(Dashboard);

  expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Bootable Containers' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Build a disk image' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Try an Example Image' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Images' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Learn more' })).toBeInTheDocument();
});

test.each([0, 1, 23])('Show image counts of %i', async count => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(Array.from({ length: count }, () => mockDiskImage));
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(Array.from({ length: count }, () => mockBootcImages[0]));
  render(Dashboard);

  await waitFor(() => {
    expect(screen.getByLabelText('BootC container images count')).toHaveTextContent(String(count));
    expect(screen.getByLabelText('Disk images count')).toHaveTextContent(String(count));
  });
});

test.each([
  ['Build disk image', '/disk-images/build'],
  ['View images', '/images/'],
  ['View disk images', '/disk-images/'],
])('Navigate from %s', async (name, destination) => {
  render(Dashboard);

  await fireEvent.click(screen.getByRole('button', { name }));

  expect(router.goto).toHaveBeenCalledWith(destination);
});

test.each([
  ['link', 'View documentation', REPOSITORY_URL],
  ['button', 'Read guide', 'https://osbuild.org/docs/user-guide/introduction/'],
  ['button', 'Read article', 'https://developers.redhat.com/articles/2024/05/07/image-mode-rhel-bootable-containers'],
  ['button', 'Read docs', 'https://docs.fedoraproject.org/en-US/bootc/getting-started/'],
])('Open the %s %s through the backend', async (role, name, url) => {
  render(Dashboard);

  await fireEvent.click(screen.getByRole(role, { name }));

  expect(bootcClient.openLink).toHaveBeenCalledWith(url);
});

test('Disable the example action until the pull completes', async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  vi.mocked(bootcClient.pullImage).mockReturnValue(promise);
  render(Dashboard);

  const pullButton = await screen.findByRole('button', { name: 'Pull example image' });
  await fireEvent.click(pullButton);

  expect(bootcClient.pullImage).toHaveBeenCalledWith(exampleImage);
  expect(pullButton).toBeDisabled();

  resolve();
  await waitFor(() => expect(pullButton).toBeEnabled());
});

test('Build the example with its image and tag selected', async () => {
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue([{ ...mockBootcImages[0], RepoTags: [exampleImage] }]);
  render(Dashboard);

  const buildButton = await screen.findByRole('button', { name: 'Build example image' });
  expect(buildButton).toHaveAttribute('title', exampleImage);
  expect(screen.queryByRole('button', { name: 'Pull example image' })).not.toBeInTheDocument();

  await fireEvent.click(buildButton);

  expect(router.goto).toHaveBeenCalledWith(
    '/disk-images/build/registry.gitlab.com%2Ffedora%2Fbootc%2Fexamples%2Fhttpd/latest',
  );
});
