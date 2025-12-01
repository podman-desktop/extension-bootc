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
import { beforeEach, expect, test, vi } from 'vitest';

import CreateVM from './CreateVM.svelte';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';
import { bootcClient } from './api/client';
import type { VmDetails } from '@crc-org/macadam.js';

vi.mock('./api/client', async () => {
  return {
    bootcClient: {
      listVMs: vi.fn(),
      createVM: vi.fn(),
      getConfigurationValue: vi.fn(),
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

beforeEach(() => {
  vi.mocked(bootcClient.listVMs).mockResolvedValue([]);
});

test('Expect CreateVM to load correctly', async () => {
  render(CreateVM, { imageName: 'foobar', imagePath: '/path/to/image' });

  // Expect that the buton "Create Virtual Machine" is present
  const createButton = screen.getByRole('button', { name: 'Create Virtual Machine' });
  expect(createButton).toBeInTheDocument();
});

test('Test adding *.qcow2 image, as well as a name is valid.', async () => {
  render(CreateVM, { imageName: 'foobar', imagePath: '/path/to/image.qcow2' });

  // Check that the button Create Virtual Machine is enabled
  const createButton = screen.getByRole('button', { name: 'Create Virtual Machine' });
  expect(createButton).toBeEnabled();
});

test('That that having a non qcow2 image is invalid.', async () => {
  render(CreateVM, { imageName: 'foobar', imagePath: '/path/to/image.img' });

  // Check that the button Create Virtual Machine is disabled
  const createButton = screen.getByRole('button', { name: 'Create Virtual Machine' });
  expect(createButton).toBeDisabled();
});

test('Mock vm list to show that there is already an image with the same name, and confirm that the button is disabled.', async () => {
  render(CreateVM, { imageName: 'foobar', imagePath: '/path/to/image.qcow2' });

  // Mock returning "foobar", so we make sure we get a disabled button.
  vi.mocked(bootcClient.listVMs).mockResolvedValue([{ Name: 'foobar' } as unknown as VmDetails]);

  // Button takes a second to show as disabled as it uses $effect on load / waiting for the vm list to be loaded.
  await vi.waitFor(() => {
    const createButton = screen.getByRole('button', { name: 'Create Virtual Machine' });
    expect(createButton).toBeDisabled();
  });
});

test('Test that getConfigurationValue was called to get the default values..', async () => {
  render(CreateVM, { imageName: 'foobar', imagePath: '/path/to/image.qcow2' });

  // Check that the button Create Virtual Machine is enabled
  const createButton = screen.getByRole('button', { name: 'Create Virtual Machine' });
  expect(createButton).toBeEnabled();

  // Expect it to be called with 'bootc', and 'macadam.ssh.private.key'
  expect(bootcClient.getConfigurationValue).toHaveBeenCalledWith('bootc', 'macadam.ssh.private.key');

  // Expect it to be called with bootc and macadam.ssh.username
  expect(bootcClient.getConfigurationValue).toHaveBeenCalledWith('bootc', 'macadam.ssh.username');
});

test('Test pressing Create Virtual Machine calls bootcClient.createVM', async () => {
  render(CreateVM, { imageName: 'foobar', imagePath: '/path/to/image.qcow2' });

  // Check that the button Create Virtual Machine is enabled
  const createButton = screen.getByRole('button', { name: 'Create Virtual Machine' });
  expect(createButton).toBeEnabled();

  // Click the button
  createButton.click();

  // Expect it to be called with 'foobar', and '/path/to/image.qcow2'
  // we do not care about sshIdentityPath and username, so we set them to empty strings.
  expect(bootcClient.createVM).toHaveBeenCalledWith({
    imagePath: '/path/to/image.qcow2',
    name: 'foobar',
    sshIdentityPath: '',
    username: '',
  });
});

test('Test that a failure with Create Virtual Machine will show the empty screen with the error message', async () => {
  render(CreateVM, { imageName: 'foobar', imagePath: '/path/to/image.qcow2' });

  // Check that the button Create Virtual Machine is enabled
  const createButton = screen.getByRole('button', { name: 'Create Virtual Machine' });
  expect(createButton).toBeEnabled();

  // Mock the createVM to throw an error
  vi.mocked(bootcClient.createVM).mockRejectedValue(new Error('error 123 test error'));

  // Click the button
  createButton.click();

  // Expect it to be called with 'foobar', and '/path/to/image.qcow2'
  // we do not care about sshIdentityPath and username, so we set them to empty strings.
  expect(bootcClient.createVM).toHaveBeenCalledWith({
    imagePath: '/path/to/image.qcow2',
    name: 'foobar',
    sshIdentityPath: '',
    username: '',
  });

  // Expect the error message to be shown
  await vi.waitFor(() => {
    // Expect the "error 123 test error" to be shown after the button is clicked.
    const errorMessage = screen.queryAllByText(/error 123 test error/);
    expect(errorMessage).toHaveLength(1);

    // Expect "Error with virtual machine creation" to be shown
    const errorTitle = screen.queryAllByText(/Error with virtual machine creation/);
    expect(errorTitle).toHaveLength(1);
  });
});
