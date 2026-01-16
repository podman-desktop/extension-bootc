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

import { render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';

import Name from './Name.svelte';
import type { ImageInfoUI } from '../ImageInfoUI';
import userEvent from '@testing-library/user-event';
import { bootcClient } from '/@/api/client';

vi.mock('/@/api/client', async () => {
  return {
    bootcClient: {
      openImage: vi.fn(),
      telemetryLogUsage: vi.fn(),
    },
  };
});

const image: ImageInfoUI = {
  name: 'my-image',
  shortId: 'short-id',
  tag: 'latest',
} as ImageInfoUI;

test('Expect simple column styling', async () => {
  render(Name, { object: image });

  const name = screen.getByText(image.name);
  expect(name).toBeInTheDocument();
  expect(name).toHaveClass('text-[var(--pd-table-body-text-highlight)]');
  expect(name).toHaveClass('overflow-hidden');
  expect(name).toHaveClass('text-ellipsis');

  const id = screen.getByText(image.shortId);
  expect(id).toBeInTheDocument();
  expect(id).toHaveClass('text-[var(--pd-table-body-text-sub-secondary)]');

  const tag = screen.getByText(image.tag);
  expect(tag).toBeInTheDocument();
  expect(tag).toHaveClass('text-[var(--pd-table-body-text)]');
  expect(tag).toHaveClass('font-extra-light');
});

test('Expect clicking on name goes to details', async () => {
  render(Name, { object: image });

  const name = screen.getByText(image.name);
  expect(name).toBeInTheDocument();

  await userEvent.click(name);

  expect(bootcClient.openImage).toHaveBeenCalledWith(image.id, image.engineId, `${image.name}:${image.tag}`);
});
