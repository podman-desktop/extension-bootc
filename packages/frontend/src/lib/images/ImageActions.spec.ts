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

import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import type { ImageInfoUI } from './ImageInfoUI';
import ImageActions from './ImageActions.svelte';
import userEvent from '@testing-library/user-event';
import { gotoImageBuild } from '../navigation';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';
import { bootcClient } from '/@/api/client';

vi.mock('/@/api/client', async () => {
  return {
    bootcClient: {
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

vi.mock('../navigation', async () => {
  return {
    gotoImageBuild: vi.fn(),
  };
});

test('Expect Build action works', async () => {
  const image: ImageInfoUI = {
    name: 'dummy',
    status: 'unused',
  } as ImageInfoUI;

  render(ImageActions, { object: image });

  const build = screen.getByTitle('Build Disk Image');
  expect(build).toBeDefined();

  await userEvent.click(build);

  expect(gotoImageBuild).toHaveBeenCalled();
});

test('Expect Delete action works', async () => {
  const image: ImageInfoUI = {
    id: 'test',
    engineId: 'podman',
    name: 'dummy',
    status: 'unused',
  } as ImageInfoUI;

  render(ImageActions, { object: image });

  const button = screen.getByTitle('Delete Image');
  expect(button).toBeDefined();

  await fireEvent.click(button);

  expect(bootcClient.deleteImage).toHaveBeenCalledWith('podman', 'test');
});
