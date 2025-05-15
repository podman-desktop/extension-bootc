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

import { beforeEach, vi, test, expect } from 'vitest';
import type { BootcBuildInfo } from '/@shared/src/models/bootc';
import { bootcClient } from '/@/api/client';
import { screen, render } from '@testing-library/svelte';
import DiskImageActions from './DiskImageActions.svelte';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';
import { router } from 'tinro';
import userEvent from '@testing-library/user-event';

vi.mock('/@/api/client', async () => {
  return {
    bootcClient: {
      deleteBuilds: vi.fn(),
      isWindows: vi.fn(),
      isMac: vi.fn(),
      isLinux: vi.fn(),
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

vi.mock('tinro', () => {
  return {
    router: {
      goto: vi.fn(),
    },
  };
});

const mockHistoryInfo: BootcBuildInfo = {
  id: 'name1',
  image: 'image1',
  imageId: 'sha256:imageId1',
  engineId: 'engine1',
  tag: 'latest',
  type: ['raw'],
  folder: '/foo/image1',
  arch: 'x86_64',
};

beforeEach(() => {
  vi.clearAllMocks();
});

test('Renders Delete Build button', async () => {
  vi.mocked(bootcClient.isWindows).mockResolvedValue(false);
  render(DiskImageActions, { object: mockHistoryInfo });

  const deleteButton = screen.getAllByRole('button', { name: 'Delete Build' })[0];
  expect(deleteButton).not.toBeNull();
});

test('Test clicking on delete button', async () => {
  vi.mocked(bootcClient.isWindows).mockResolvedValue(false);
  render(DiskImageActions, { object: mockHistoryInfo });

  // Click on delete button
  const deleteButton = screen.getAllByRole('button', { name: 'Delete Build' })[0];
  deleteButton.click();

  expect(bootcClient.deleteBuilds).toHaveBeenCalledWith(['name1']);
});

test('Test clicking on logs button', async () => {
  vi.mocked(bootcClient.isWindows).mockResolvedValue(false);
  render(DiskImageActions, { object: mockHistoryInfo });

  // Click on logs button
  const logsButton = screen.getAllByRole('button', { name: 'Build Logs' })[0];
  await userEvent.click(logsButton);

  expect(router.goto).toHaveBeenCalledWith('/disk-image/bmFtZTE=/build');
});

test('Render the Create VM button if NOT on Windows', async () => {
  vi.mocked(bootcClient.isWindows).mockResolvedValue(false);
  render(DiskImageActions, { object: mockHistoryInfo });

  await vi.waitFor(() => {
    const createVmButton = screen.getByRole('button', { name: 'Create VM' });
    expect(createVmButton).not.toBeNull();
  });
});

test('Test clicking on create VM button for raw', async () => {
  vi.mocked(bootcClient.isWindows).mockResolvedValue(false);
  render(DiskImageActions, { object: mockHistoryInfo });

  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Create VM' })).not.toBeNull();
  });

  const createVmButton = screen.getByRole('button', { name: 'Create VM' });
  await userEvent.click(createVmButton);

  expect(router.goto).toHaveBeenCalledWith('/disk-images/createVM/aW1hZ2Ux/L2Zvby9pbWFnZTEvaW1hZ2UvZGlzay5yYXc=');
});

test('Test clicking on create VM button for qcow2', async () => {
  vi.mocked(bootcClient.isWindows).mockResolvedValue(false);
  mockHistoryInfo.type = ['qcow2'];
  render(DiskImageActions, { object: mockHistoryInfo });

  await vi.waitFor(() => {
    expect(screen.getByRole('button', { name: 'Create VM' })).not.toBeNull();
  });

  const createVmButton = screen.getByRole('button', { name: 'Create VM' });
  await userEvent.click(createVmButton);

  expect(router.goto).toHaveBeenCalledWith('/disk-images/createVM/aW1hZ2Ux/L2Zvby9pbWFnZTEvcWNvdzIvZGlzay5xY293Mg==');
});

test('Do not render the Create VM button if on Windows', async () => {
  vi.mocked(bootcClient.isWindows).mockResolvedValue(true);
  render(DiskImageActions, { object: mockHistoryInfo });

  await vi.waitFor(() => {
    const createVmButton = screen.queryByRole('button', { name: 'Create VM' });
    expect(createVmButton).toBeNull();
  });
});
