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

import ImageEmptyScreen from './ImageEmptyScreen.svelte';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';
import { bootcClient } from '/@/api/client';

vi.mock('/@/api/client', async () => {
  return {
    bootcClient: {
      listBootcImages: vi.fn(),
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

test('Expect basic content', async () => {
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue([]);
  render(ImageEmptyScreen);

  const title = screen.getByText('No bootable container images');
  expect(title).toBeInTheDocument();
});

test('Expect page to contain pull image button', async () => {
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue([]);
  render(ImageEmptyScreen);

  const pullButton = screen.getByRole('button', { name: 'Pull image' });
  expect(pullButton).toBeInTheDocument();
});
