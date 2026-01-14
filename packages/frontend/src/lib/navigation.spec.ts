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

import '@testing-library/jest-dom/vitest';
import { router } from 'tinro';

import { beforeEach, expect, test, vi } from 'vitest';
import {
  gotoBuild,
  gotoCreateVM,
  gotoCreateVMForm,
  goToDiskImages,
  gotoImage,
  gotoDiskImageBuild,
  gotoImageBuild,
} from './navigation';
import { bootcClient } from '../api/client';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';

vi.mock('/@/api/client', async () => {
  return {
    bootcClient: {
      telemetryLogUsage: vi.fn(),
      openImage: vi.fn(),
      openImageBuild: vi.fn(),
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

beforeEach(() => {
  vi.resetAllMocks();
});

test('Test goToDiskImages navigation', async () => {
  goToDiskImages();

  expect(router.goto).toHaveBeenCalledWith('/disk-images');
});

test('Test gotoBuild navigation', async () => {
  await gotoBuild();

  expect(router.goto).toHaveBeenCalledWith('/disk-images/build');
  expect(bootcClient.telemetryLogUsage).toHaveBeenCalledWith('nav-build');
});

test('Test gotoImage navigation', async () => {
  await gotoImage('a', 'podman.Podman', 'foo:latest');

  expect(bootcClient.openImage).toHaveBeenCalledExactlyOnceWith('a', 'podman.Podman', 'foo:latest');
});

test('Test gotoImageBuild navigation', async () => {
  await gotoImageBuild();

  expect(bootcClient.openImageBuild).toHaveBeenCalledOnce();
  expect(bootcClient.telemetryLogUsage).toHaveBeenCalledWith('nav-image-build');
});

test('Test gotoDiskImageBuild navigation', async () => {
  await gotoDiskImageBuild('name', 'tag');

  expect(router.goto).toHaveBeenCalledWith('/disk-images/build/name/tag');
  expect(bootcClient.telemetryLogUsage).toHaveBeenCalledWith('nav-build');
});

test('Test gotoCreateVMForm navigation', async () => {
  await gotoCreateVMForm();

  expect(router.goto).toHaveBeenCalledWith('/disk-images/createVM');
  expect(bootcClient.telemetryLogUsage).toHaveBeenCalledWith('nav-create-vm');
});

test('Test gotoCreateVM navigation', async () => {
  await gotoCreateVM('image', 'path');

  expect(router.goto).toHaveBeenCalledWith('/disk-images/createVM/aW1hZ2U=/cGF0aA==');
  expect(bootcClient.telemetryLogUsage).toHaveBeenCalledWith('nav-create-vm');
});
