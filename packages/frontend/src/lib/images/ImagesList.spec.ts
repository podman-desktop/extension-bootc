/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import { render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import type { ImageInfo } from '@podman-desktop/api';

import ImagesList from './ImagesList.svelte';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';
import { bootcClient } from '/@/api/client';

vi.mock('/@/api/client', async () => {
  return {
    bootcClient: {
      listBootcImages: vi.fn(),
      listContainers: vi.fn(),
      deleteImage: vi.fn(),
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

test('Expect no images', async () => {
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue([]);
  render(ImagesList);

  const title = screen.getByText('No bootable container images');
  expect(title).toBeInTheDocument();
});

test('Expect images being ordered by name', async () => {
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue([
    {
      Id: 'sha256:45645645645656',
      RepoTags: ['image2:latest'],
      Created: 123,
      Size: 123,
    },
    {
      Id: 'sha256:789789123456783',
      RepoTags: ['image3:recent'],
      Created: 123,
      Size: 123,
    },
    {
      Id: 'sha256:12345678901234',
      RepoTags: ['image1:old'],
      Created: 123,
      Size: 123,
    },
  ] as ImageInfo[]);

  render(ImagesList);

  await vi.waitFor(() => {
    screen.getByText('image1');
  });

  const image1 = screen.getByText('image1');
  const image2 = screen.getByText('image2');
  const image3 = screen.getByText('image3');
  expect(image1).toBeInTheDocument();
  expect(image2).toBeInTheDocument();
  expect(image3).toBeInTheDocument();

  expect(image3.compareDocumentPosition(image1)).toBe(2);
  expect(image3.compareDocumentPosition(image2)).toBe(2);
  expect(image1.compareDocumentPosition(image2)).toBe(4);
});

test('Expect filter empty screen', async () => {
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue([
    {
      Id: 'sha256:1234567890123',
      RepoTags: ['fedora:old'],
      Created: 1644009612,
      Size: 123,
    },
  ] as ImageInfo[]);

  render(ImagesList, { searchTerm: 'No match' });

  const filterButton = screen.getByRole('button', { name: 'Clear filter' });
  expect(filterButton).toBeInTheDocument();
});
