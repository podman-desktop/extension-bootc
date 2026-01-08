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

import { afterEach, beforeEach, expect, test, vi, describe } from 'vitest';
import * as podmanDesktopApi from '@podman-desktop/api';
import { activate, deactivate, openBuildPage, getJSONMachineListByProvider } from './extension';
import * as fs from 'node:fs';
import os from 'node:os';

/// mock console.log
const originalConsoleLog = console.log;

const mocks = vi.hoisted(() => ({
  logUsageMock: vi.fn(),
  logErrorMock: vi.fn(),
  consoleLogMock: vi.fn(),
  consoleWarnMock: vi.fn(),
  consoleErrorMock: vi.fn(),
  macadamInitMock: vi.fn(),
  macadamListVmsMock: vi.fn(),
  areBinariesAvailableMock: vi.fn(),
}));

vi.mock('../package.json', () => ({
  engines: {
    'podman-desktop': '>=1.0.0',
  },
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    version: '1.8.0',
    env: {
      createTelemetryLogger: (): podmanDesktopApi.TelemetryLogger =>
        ({
          logUsage: mocks.logUsageMock,
          logError: mocks.logErrorMock,
        }) as unknown as podmanDesktopApi.TelemetryLogger,
      isMac: false,
      isWindows: false,
      isLinux: false,
    },
    commands: {
      registerCommand: vi.fn(),
    },
    Uri: class {
      static readonly joinPath = (): podmanDesktopApi.Uri => ({ fsPath: '.' }) as podmanDesktopApi.Uri;
    },
    window: {
      createWebviewPanel: (): podmanDesktopApi.WebviewPanel =>
        ({
          webview: {
            html: '',
            onDidReceiveMessage: vi.fn(),
            postMessage: vi.fn(),
          },
          onDidChangeViewState: vi.fn(),
        }) as unknown as podmanDesktopApi.WebviewPanel,
      listWebviews: vi.fn().mockReturnValue([{ viewType: 'a' }, { id: 'test', viewType: 'bootc' }, { viewType: 'b' }]),
    },
    navigation: {
      navigateToWebview: vi.fn(),
    },
    fs: {
      createFileSystemWatcher: (): podmanDesktopApi.FileSystemWatcher => ({
        onDidCreate: vi.fn(),
        onDidDelete: vi.fn(),
        onDidChange: vi.fn(),
        dispose: vi.fn(),
      }),
    },
    provider: {
      createProvider: (): podmanDesktopApi.Provider =>
        ({
          setVmProviderConnectionFactory: vi.fn(),
        }) as unknown as podmanDesktopApi.Provider,
    },
  };
});

vi.mock('@crc-org/macadam.js', () => ({
  Macadam: vi.fn(
    class {
      init = mocks.macadamInitMock;
      listVms = mocks.macadamListVmsMock;
      areBinariesAvailable = mocks.areBinariesAvailableMock;
    },
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  console.log = mocks.consoleLogMock;
  console.warn = mocks.consoleWarnMock;
  console.error = mocks.consoleErrorMock;
});

afterEach(() => {
  console.log = originalConsoleLog;
});

const fakeContext = {
  subscriptions: {
    push: vi.fn(),
  },
  storagePath: os.tmpdir(),
} as unknown as podmanDesktopApi.ExtensionContext;

describe('test ensureMacadamInitialized doesnt double init', () => {
  beforeEach(() => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue('<html></html>');
    (podmanDesktopApi.version as string) = '1.8.0';
  });

  test('should propagate init error when lazy initializing via getJSONMachineListByProvider', async () => {
    vi.mocked(podmanDesktopApi.env).isMac = true;
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    mocks.areBinariesAvailableMock.mockReturnValue(false);
    mocks.macadamInitMock.mockRejectedValue(new Error('Init failed'));

    await activate(fakeContext);

    const result = await getJSONMachineListByProvider('applehv');
    expect(result.error).toContain('Init failed');
    expect(mocks.macadamListVmsMock).not.toHaveBeenCalled();
  });

  test('should lazily initialize macadam when listing VMs and binary was not installed at activation', async () => {
    vi.mocked(podmanDesktopApi.env).isMac = true;
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    mocks.areBinariesAvailableMock.mockReturnValue(false);
    mocks.macadamInitMock.mockResolvedValue(undefined);
    mocks.macadamListVmsMock.mockResolvedValue([]);

    // First activate without binary existing
    await activate(fakeContext);
    expect(mocks.macadamInitMock).not.toHaveBeenCalled();

    // trigger getJSONMachineListByProvider which would call init / list since the binary did not exist at activation
    await getJSONMachineListByProvider('applehv');

    // Make sure that init and listVms were called (meaning init was triggered and is going to install)
    expect(mocks.macadamInitMock).toHaveBeenCalled();
    expect(mocks.macadamListVmsMock).toHaveBeenCalled();
  });

  test('should not re-initialize macadam if already initialized', async () => {
    vi.mocked(podmanDesktopApi.env).isMac = true;
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    mocks.areBinariesAvailableMock.mockReturnValue(true);
    mocks.macadamInitMock.mockResolvedValue(undefined);
    mocks.macadamListVmsMock.mockResolvedValue([]);

    // Activate with binary existing (will call init)
    await activate(fakeContext);
    expect(mocks.macadamInitMock).toHaveBeenCalledTimes(1);

    // Run getJSONMachineListByProvider again!
    await getJSONMachineListByProvider('applehv');

    // Should NOT re-call init since we already activated it before, so we stick to 1
    expect(mocks.macadamInitMock).toHaveBeenCalledTimes(1);
  });
});

test('check activate', async () => {
  vi.spyOn(fs.promises, 'readFile').mockResolvedValue('<html></html>');
  await activate(fakeContext);

  expect(mocks.consoleLogMock).toBeCalledWith('starting bootc extension');
  expect(mocks.logUsageMock).toHaveBeenCalled();
});

describe('version checker', () => {
  test('incompatible version', async () => {
    (podmanDesktopApi.version as string) = '0.7.0';
    await expect(async () => {
      await activate(fakeContext);
    }).rejects.toThrowError('Extension is not compatible with Podman Desktop version below 1.0.0 (Current 0.7.0).');

    // expect the error to be logged
    expect(mocks.logErrorMock).toBeCalledWith('start.incompatible', {
      version: '0.7.0',
      message: 'error activating extension on version below 1.0.0',
    });
  });

  test('next version', async () => {
    (podmanDesktopApi.version as string) = '1.0.1-next';
    await activate(fakeContext);

    expect(mocks.logErrorMock).not.toHaveBeenCalled();
  });

  /**
   * This check ensure we do not support old nighties version to be used
   * update introduced in https://github.com/podman-desktop/podman-desktop/pull/7643
   */
  test('old nightlies version', async () => {
    (podmanDesktopApi.version as string) = 'v0.0.202404030805-3cb4544';
    await expect(async () => {
      await activate(fakeContext);
    }).rejects.toThrowError(
      'Extension is not compatible with Podman Desktop version below 1.0.0 (Current v0.0.202404030805-3cb4544).',
    );

    expect(mocks.logErrorMock).toHaveBeenCalled();
  });

  test('new version nighties', async () => {
    (podmanDesktopApi.version as string) = `1.0.0-${Date.now()}-b35e7bef`;

    expect(mocks.logErrorMock).not.toHaveBeenCalled();
  });

  test('invalid version', async () => {
    (podmanDesktopApi.version as string | undefined) = undefined;
    await expect(async () => {
      await activate(fakeContext);
    }).rejects.toThrowError('Extension is not compatible with Podman Desktop version below 1.0.0 (Current unknown).');

    // expect the activate method to be called on the studio class
    expect(mocks.logErrorMock).toBeCalledWith('start.incompatible', {
      version: 'unknown',
      message: 'error activating extension on version below 1.0.0',
    });
  });
});

test('check deactivate', async () => {
  await deactivate();

  expect(mocks.consoleLogMock).toBeCalledWith('stopping bootc extension');
});

test('check command triggers webview and redirects', async () => {
  const postMessageMock = vi.fn();
  const panel = {
    webview: {
      postMessage: postMessageMock,
    },
  } as unknown as podmanDesktopApi.WebviewPanel;

  const image = { name: 'build', tag: 'latest' };

  await openBuildPage(panel, image);

  expect(podmanDesktopApi.navigation.navigateToWebview).toHaveBeenCalled();
  expect(postMessageMock).toHaveBeenCalledWith({ body: 'build/latest', id: 'navigate-build' });
});

describe('lazy macadam initialization', () => {
  beforeEach(() => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue('<html></html>');
    (podmanDesktopApi.version as string) = '1.8.0';
  });

  test('macOs: should NOT initialize macadam on activate when binary does not exist', async () => {
    vi.mocked(podmanDesktopApi.env).isMac = true;
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    mocks.areBinariesAvailableMock.mockReturnValue(false);

    await activate(fakeContext);

    expect(mocks.macadamInitMock).not.toHaveBeenCalled();
  });

  test('macOS: should initialize macadam on activate when binary exists', async () => {
    vi.mocked(podmanDesktopApi.env).isMac = true;
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    mocks.areBinariesAvailableMock.mockReturnValue(true);
    mocks.macadamInitMock.mockResolvedValue(undefined);

    await activate(fakeContext);

    expect(mocks.macadamInitMock).toHaveBeenCalled();
  });

  test('linux: should NOT initialize macadam on activate when binary does not exist', async () => {
    vi.mocked(podmanDesktopApi.env).isMac = false;
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    vi.mocked(podmanDesktopApi.env).isLinux = true;
    mocks.areBinariesAvailableMock.mockReturnValue(false);

    await activate(fakeContext);

    expect(mocks.macadamInitMock).not.toHaveBeenCalled();
  });

  test('linux: should initialize macadam on activate when binary exists', async () => {
    vi.mocked(podmanDesktopApi.env).isMac = false;
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    vi.mocked(podmanDesktopApi.env).isLinux = true;
    mocks.areBinariesAvailableMock.mockReturnValue(true);
    mocks.macadamInitMock.mockResolvedValue(undefined);

    await activate(fakeContext);

    expect(mocks.macadamInitMock).toHaveBeenCalled();
  });

  test('windows: should skip macadam initialization on activate, since macadam isnt added yet', async () => {
    vi.mocked(podmanDesktopApi.env).isMac = false;
    vi.mocked(podmanDesktopApi.env).isWindows = true;
    vi.mocked(podmanDesktopApi.env).isLinux = false;

    await activate(fakeContext);

    expect(mocks.macadamInitMock).not.toHaveBeenCalled();
  });

  test('mac: should handle macadam init error gracefully during activate', async () => {
    vi.mocked(podmanDesktopApi.env).isMac = true;
    vi.mocked(podmanDesktopApi.env).isWindows = false;
    mocks.areBinariesAvailableMock.mockReturnValue(true);
    mocks.macadamInitMock.mockRejectedValue(new Error('Init failed'));

    await activate(fakeContext);

    expect(mocks.consoleErrorMock).toHaveBeenCalledWith('Error initializing macadam', expect.any(Error));
  });
});
