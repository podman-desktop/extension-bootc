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
import type { Mock } from 'vitest';
import { beforeEach, expect, test, vi } from 'vitest';
import { MacadamHandler } from './macadam';
import * as macadam from '@crc-org/macadam.js';
import * as extensionApi from '@podman-desktop/api';

const mocks = vi.hoisted(() => ({
  logUsageMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    env: {
      createTelemetryLogger: (): extensionApi.TelemetryLogger =>
        ({
          logUsage: mocks.logUsageMock,
        }) as unknown as extensionApi.TelemetryLogger,
      isLinux: false,
      isMac: false,
      isWindows: false,
    },
    window: {
      withProgress: vi.fn().mockImplementation,
      showErrorMessage: vi.fn(),
    },
    ProgressLocation: {
      TASK_WIDGET: 'TASK_WIDGET',
    },
    telemetryLogger: {
      logUsage: vi.fn(),
    },
  };
});

const progress = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  report: (): void => {},
};

vi.mock('@crc-org/macadam.js', () => {
  const mockInstance = {
    init: vi.fn(),
    createVm: vi.fn(),
    listVms: vi.fn(),
  };
  return {
    Macadam: vi.fn(() => mockInstance),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

test('Test creating Mac VM with MacadamHandler', async () => {
  const macadamVm = new MacadamHandler(); // This must come first
  const macadamInstance = (macadam.Macadam as Mock).mock.results[0].value;
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
  expect(mocks.logUsageMock).toHaveBeenCalledWith('createVM', {
    success: true,
    type: 'qcow2',
    provider: 'applehv',
  });
});

test('Test creating Windows VM with MacadamHandler', async () => {
  const macadamVm = new MacadamHandler(); // This must come first
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
  expect(mocks.logUsageMock).toHaveBeenCalledWith('createVM', {
    success: true,
    type: 'wsl2',
    provider: 'hyperv',
  });
});

test('Test creating Linux VM with MacadamHandler', async () => {
  const macadamVm = new MacadamHandler(); // This must come first
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
  expect(mocks.logUsageMock).toHaveBeenCalledWith('createVM', {
    success: true,
    type: 'raw',
    provider: undefined,
  });
});

test('Test listing VMs with MacadamHandler', async () => {
  const macadamVm = new MacadamHandler(); // This must come first
  const macadamInstance = (macadam.Macadam as Mock).mock.results[0].value;
  macadamInstance.listVms.mockResolvedValue([{ name: 'test-vm' }]);

  const vms = await macadamVm.listVms();

  expect(macadamInstance.listVms).toHaveBeenCalled();
  expect(vms).toEqual([{ name: 'test-vm' }]);
});
