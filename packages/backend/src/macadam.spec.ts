/**********************************************************************
 * Copyright (C) 2025-2026 Red Hat, Inc.
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
import type { Mock } from 'vitest';
import { beforeEach, expect, test, vi } from 'vitest';
import { MacadamHandler } from './macadam';
import * as macadam from '@crc-org/macadam.js';
import * as extensionApi from '@podman-desktop/api';

// Mock ensureMacadamInitialized from extension.ts
vi.mock('./extension', () => ({
  ensureMacadamInitialized: vi.fn().mockResolvedValue(undefined),
}));

const TELEMETRY_LOGGER_MOCK: extensionApi.TelemetryLogger = {
  logUsage: vi.fn(),
} as unknown as extensionApi.TelemetryLogger;

vi.mock(
  import('@podman-desktop/api'),
  () =>
    ({
      env: {
        createTelemetryLogger: vi.fn(),
        isLinux: false,
        isMac: false,
        isWindows: false,
      },
      window: {
        withProgress: vi.fn(),
        showErrorMessage: vi.fn(),
      },
      ProgressLocation: {
        TASK_WIDGET: 'TASK_WIDGET',
      },
      telemetryLogger: {
        logUsage: vi.fn(),
      },
    }) as unknown as typeof extensionApi,
);

const progress = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  report: (): void => {},
};

vi.mock(
  import('@crc-org/macadam.js'),
  () =>
    ({
      Macadam: vi.fn(
        class {
          createVm = vi.fn();
          init = vi.fn();
          listVms = vi.fn();
        },
      ),
    }) as unknown as typeof macadam,
);

beforeEach(() => {
  vi.resetAllMocks();
});

test('Test creating Mac VM with MacadamHandler', async () => {
  const macadamVm = new MacadamHandler(TELEMETRY_LOGGER_MOCK); // This must come first
  const macadamInstance = vi.mocked(macadam.Macadam).mock.results[0].value;
  macadamInstance.createVm.mockResolvedValue({ stdout: '', stderr: '' });

  vi.spyOn(extensionApi.window, 'withProgress').mockImplementation((_options, task) => {
    return task(progress, {} as unknown as extensionApi.CancellationToken);
  });
  vi.mocked(extensionApi.env).isMac = true;

  await macadamVm.createVm({
    name: 'foobar',
    imagePath: '~/test-image.qcow2',
    sshIdentityPath: '~/test-ssh-key',
  });

  expect(macadamInstance.createVm).toHaveBeenCalled();

  const callOptions = macadamInstance.createVm.mock.calls[0][0];
  expect(callOptions.imagePath).not.toContain('~/');
  expect(callOptions.sshIdentityPath).not.toContain('~/');
  expect(TELEMETRY_LOGGER_MOCK.logUsage).toHaveBeenCalledWith('createVM', {
    success: true,
    type: 'qcow2',
    provider: 'applehv',
  });
});

test('Test creating Windows VM with MacadamHandler', async () => {
  const macadamVm = new MacadamHandler(TELEMETRY_LOGGER_MOCK); // This must come first
  const macadamInstance = (macadam.Macadam as Mock).mock.results[0].value;
  macadamInstance.createVm.mockResolvedValue({ stdout: '', stderr: '' });

  vi.spyOn(extensionApi.window, 'withProgress').mockImplementation((_options, task) => {
    return task(progress, {} as unknown as extensionApi.CancellationToken);
  });
  vi.mocked(extensionApi.env).isMac = false;
  vi.mocked(extensionApi.env).isWindows = true;

  await macadamVm.createVm({
    name: 'foobar',
    imagePath: '~/test-image.wsl2',
    sshIdentityPath: '~/test-ssh-key',
  });

  expect(macadamInstance.createVm).toHaveBeenCalled();

  const callOptions = macadamInstance.createVm.mock.calls[0][0];
  expect(callOptions.imagePath).not.toContain('~/');
  expect(callOptions.sshIdentityPath).not.toContain('~/');
  expect(TELEMETRY_LOGGER_MOCK.logUsage).toHaveBeenCalledWith('createVM', {
    success: true,
    type: 'wsl2',
    provider: 'hyperv',
  });
});

test('Test creating Linux VM with MacadamHandler', async () => {
  const macadamVm = new MacadamHandler(TELEMETRY_LOGGER_MOCK); // This must come first
  const macadamInstance = (macadam.Macadam as Mock).mock.results[0].value;
  macadamInstance.createVm.mockResolvedValue({ stdout: '', stderr: '' });

  vi.spyOn(extensionApi.window, 'withProgress').mockImplementation((_options, task) => {
    return task(progress, {} as unknown as extensionApi.CancellationToken);
  });
  vi.mocked(extensionApi.env).isWindows = false;
  vi.mocked(extensionApi.env).isLinux = true;

  await macadamVm.createVm({
    name: 'foobar',
    imagePath: '~/test-image.raw',
    sshIdentityPath: '~/test-ssh-key',
  });

  expect(macadamInstance.createVm).toHaveBeenCalled();

  const callOptions = macadamInstance.createVm.mock.calls[0][0];
  expect(callOptions.imagePath).not.toContain('~/');
  expect(callOptions.sshIdentityPath).not.toContain('~/');
  expect(TELEMETRY_LOGGER_MOCK.logUsage).toHaveBeenCalledWith('createVM', {
    success: true,
    type: 'raw',
    provider: undefined,
  });
});

test('Test listing VMs with MacadamHandler', async () => {
  const macadamVm = new MacadamHandler(TELEMETRY_LOGGER_MOCK); // This must come first
  const macadamInstance = (macadam.Macadam as Mock).mock.results[0].value;
  macadamInstance.listVms.mockResolvedValue([{ name: 'test-vm' }]);

  const vms = await macadamVm.listVms();

  expect(macadamInstance.listVms).toHaveBeenCalled();
  expect(vms).toEqual([{ name: 'test-vm' }]);
});
