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

import { expect, test, vi } from 'vitest';
import examplesCatalog from '../assets/examples.json';
import type { ExamplesList } from '/@shared/src/models/examples';
import { BootcApiImpl } from './api-impl';
import * as podmanDesktopApi from '@podman-desktop/api';

vi.mock('@podman-desktop/api', async () => {
  return {
    window: {
      showErrorMessage: vi.fn(),
    },
    containerEngine: {
      listImages: vi.fn(),
      listContainers: vi.fn(),
      deleteImage: vi.fn(),
    },
    env: {
      openExternal: vi.fn(),
      createTelemetryLogger: vi.fn(),
    },
  };
});

test('getExamples should return examplesCatalog', async () => {
  const extensionContextMock = {
    storagePath: '/fake-path',
  } as unknown as podmanDesktopApi.ExtensionContext;

  const webviewMock = {} as podmanDesktopApi.Webview;

  const bootcApi = new BootcApiImpl(extensionContextMock, webviewMock);

  // When running get Examples we should return the examplesCatalog (it's exported)
  const result = await bootcApi.getExamples();
  // Check that the examples and categories are NOT empty
  expect(result.examples.length).not.toBe(0);
  expect(result.categories.length).not.toBe(0);

  expect(result).toEqual(examplesCatalog as ExamplesList);
});

test('listContainers should return list from extension api', async () => {
  const containers = [{}, {}] as podmanDesktopApi.ContainerInfo[];

  vi.mocked(podmanDesktopApi.containerEngine.listContainers).mockResolvedValue(containers);

  const apiImpl = new BootcApiImpl({} as podmanDesktopApi.ExtensionContext, {} as podmanDesktopApi.Webview);
  const result = await apiImpl.listContainers();

  expect(podmanDesktopApi.containerEngine.listContainers).toHaveBeenCalled();
  expect(result.length).toBe(2);
});

test('deleteImage should call the extension api and fire event', async () => {
  const postMessageMock = vi.fn().mockResolvedValue(undefined);

  const apiImpl = new BootcApiImpl(
    {} as podmanDesktopApi.ExtensionContext,
    { postMessage: postMessageMock } as unknown as podmanDesktopApi.Webview,
  );

  await apiImpl.deleteImage('a', 'b');

  expect(podmanDesktopApi.containerEngine.deleteImage).toHaveBeenCalledWith('a', 'b');
  expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'image-update' }));
});
