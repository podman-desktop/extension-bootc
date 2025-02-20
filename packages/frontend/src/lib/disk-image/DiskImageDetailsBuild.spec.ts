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

import { render, screen, waitFor } from '@testing-library/svelte';
import { vi, test, expect, beforeAll, beforeEach } from 'vitest';
import DiskImageDetailsBuild from './DiskImageDetailsBuild.svelte';
import { bootcClient } from '/@/api/client';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';

vi.mock('/@/api/client', async () => ({
  bootcClient: {
    loadLogsFromFolder: vi.fn(),
    getConfigurationValue: vi.fn(),
  },
  rpcBrowser: {
    subscribe: (): Subscriber => {
      return {
        unsubscribe: (): void => {},
      };
    },
  },
}));

beforeAll(() => {
  Object.defineProperty(window, 'ResizeObserver', {
    value: vi.fn().mockReturnValue({ observe: vi.fn(), unobserve: vi.fn() }),
  });
  Object.defineProperty(window, 'matchMedia', {
    value: () => {
      return {
        matches: false,
        addListener: (): void => {},
        removeListener: (): void => {},
      };
    },
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

const mockLogs = `Build log line 1
Build log line 2
Build log line 3`;

test('Render logs and terminal setup', async () => {
  vi.mocked(bootcClient.loadLogsFromFolder).mockResolvedValue(mockLogs);
  vi.mocked(bootcClient.getConfigurationValue).mockResolvedValue(14);

  const folderLocation = '/path/to/logs';
  render(DiskImageDetailsBuild, { folder: folderLocation });

  // Wait for the logs to be shown
  await waitFor(() => {
    expect(bootcClient.loadLogsFromFolder).toHaveBeenCalledWith('/path/to/logs');
    expect(screen.queryByText('Build log line 1')).toBeDefined();
    expect(screen.queryByText('Build log line 2')).toBeDefined();
    expect(screen.queryByText('Build log line 3')).toBeDefined();
  });
});

test('Handles empty logs correctly', async () => {
  vi.mocked(bootcClient.loadLogsFromFolder).mockResolvedValue('');
  vi.mocked(bootcClient.getConfigurationValue).mockResolvedValue(14);

  const folderLocation = '/empty/logs';
  render(DiskImageDetailsBuild, { folder: folderLocation });

  // Verify no logs message is displayed when logs are empty
  const emptyMessage = await screen.findByText('Unable to read image-build.log file from /empty/logs');
  expect(emptyMessage).toBeDefined();
});

test('Refreshes logs correctly', async () => {
  vi.mocked(bootcClient.loadLogsFromFolder).mockResolvedValue(mockLogs);
  vi.mocked(bootcClient.getConfigurationValue).mockResolvedValue(14);

  render(DiskImageDetailsBuild, { folder: '/empty/logs' });

  // verify we start refreshing logs
  await vi.waitFor(
    () => {
      expect(bootcClient.loadLogsFromFolder).toHaveBeenCalledTimes(2);
    },
    {
      timeout: 3_500,
      interval: 250,
    },
  );
});
