/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 * * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { vi, test, expect, beforeEach } from 'vitest';
import { screen, render } from '@testing-library/svelte';
import type { BootcBuildInfo } from '/@shared/src/models/bootc';
import { bootcClient } from '/@/api/client';
import DiskImagesList from './DiskImagesList.svelte';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';

const mockHistoryInfo: BootcBuildInfo[] = [
  {
    id: 'name1',
    image: 'image1',
    imageId: 'sha256:imageId1',
    engineId: 'engine1',
    tag: 'latest',
    type: ['anaconda-iso'],
    folder: '/foo/image1',
    arch: 'x86_64',
  },
  {
    id: 'name2',
    image: 'image2',
    imageId: 'sha256:imageId2',
    engineId: 'engine2',
    tag: 'latest',
    type: ['anaconda-iso'],
    folder: '/foo/image1',
    arch: 'x86_64',
  },
];

vi.mock('/@/api/client', async () => {
  return {
    bootcClient: {
      listHistoryInfo: vi.fn(),
      listBootcImages: vi.fn(),
      deleteBuilds: vi.fn(),
      telemetryLogUsage: vi.fn(),
      isMac: vi.fn(),
      isWindows: vi.fn(),
      isLinux: vi.fn(),
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
});

test('Disk Images renders correctly with no past builds', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue([]);

  render(DiskImagesList);
  expect(screen.queryByText('No disk images')).not.toBeNull();
});

test('Homepage renders correctly with multiple rows', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);

  render(DiskImagesList);
  await vi.waitFor(() => {
    if (!screen.queryByText('disk images')) {
      throw new Error();
    }
  });

  await vi.waitFor(() => {
    // Name 'image1:latest' should be present
    expect(screen.queryByText('image1:latest')).not.toBeNull();

    // Name 'image2:latest' should be present
    expect(screen.queryByText('image2:latest')).not.toBeNull();
  });
});

test('Test clicking on delete button', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.deleteBuilds).mockResolvedValue(await Promise.resolve());

  render(DiskImagesList);
  await vi.waitFor(() => {
    if (!screen.queryByText('disk images')) {
      throw new Error();
    }
  });

  // Click on delete button
  await vi.waitFor(() => {
    const deleteButton = screen.getAllByRole('button', { name: 'Delete Build' })[0];
    deleteButton.click();
  });

  expect(bootcClient.deleteBuilds).toHaveBeenCalledWith(['name1']);
}, 10_000);

test('Test clicking on build button', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);

  render(DiskImagesList);
  await vi.waitFor(() => {
    if (!screen.queryByText('disk images')) {
      throw new Error();
    }
  });

  // Click on build button
  const buildButton = screen.getAllByRole('button', { name: 'Build' })[0];
  buildButton.click();

  expect(bootcClient.telemetryLogUsage).toHaveBeenCalled();
});

test('On non-windows, the Create VM button should show', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.isWindows).mockResolvedValue(false);

  render(DiskImagesList);
  await vi.waitFor(() => {
    if (!screen.queryByText('disk images')) {
      throw new Error();
    }
  });

  // Check that the Create VM button is present
  expect(screen.queryByText('Create VM')).not.toBeNull();
});

test('On windows, the Create VM button should not show', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue(mockHistoryInfo);
  vi.mocked(bootcClient.isWindows).mockResolvedValue(true);

  render(DiskImagesList);
  await vi.waitFor(() => {
    if (!screen.queryByText('disk images')) {
      throw new Error();
    }
  });

  // Have to wait for initial load (since it's async), wait for it to disappear.
  await vi.waitFor(() => {
    expect(screen.queryByText('Create VM')).toBeNull();
  });
});
