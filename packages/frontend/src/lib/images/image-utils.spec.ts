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

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ContainerInfo, ImageInfo } from '@podman-desktop/api';
import { ImageUtils } from './image-utils';

let imageUtils: ImageUtils;

beforeEach(() => {
  vi.clearAllMocks();
  imageUtils = new ImageUtils();
});

describe.each([
  { created: 0, expectedCreated: '1970-01-01T00:00:00.000Z' },
  { created: 1000, expectedCreated: '1970-01-01T00:16:40.000Z' },
  { created: 100000, expectedCreated: '1970-01-02T03:46:40.000Z' },
  { created: 1234567890, expectedCreated: '2009-02-13T23:31:30.000Z' },
])('Expect created time', ({ created, expectedCreated }) => {
  test(`${created}`, () => {
    expect(imageUtils.getCreated(created)).toEqual(new Date(expectedCreated));
  });
});

describe.each([
  { id: 'sha256:20788b36c279607e600e12697ec1b3afdd8fd79f9eff3fd73aa8', expectedShortId: '20788b36c279' },
  { id: 'sha256:ba14bdfa6ab04c0645a5b1db40e6bf9ffaab2e847ad046ac4150', expectedShortId: 'ba14bdfa6ab0' },
  { id: 'sha256:a629b79d4d1191b2a80bfc4066d1a260adcfb2000aba31dda168', expectedShortId: 'a629b79d4d11' },
  { id: 'sha256:6f5cb97db480aeb465ceffa0bd8e73d92a37a63f445ae2ebe9ee', expectedShortId: '6f5cb97db480' },
])('Expect short id conversion', ({ id, expectedShortId }) => {
  test(`${id}`, () => {
    expect(imageUtils.getShortId(id)).toBe(expectedShortId);
  });
});

describe.each([
  { repoTag: 'nginx:latest', expectedName: 'nginx', expectedTag: 'latest' },
  { repoTag: 'quay.io/podman/hello:latest', expectedName: 'quay.io/podman/hello', expectedTag: 'latest' },
  {
    repoTag: 'my.registry:1234/podman/hello:latest',
    expectedName: 'my.registry:1234/podman/hello',
    expectedTag: 'latest',
  },
  {
    repoTag: 'my.registry:1234/podman/hello:my-custom-tag',
    expectedName: 'my.registry:1234/podman/hello',
    expectedTag: 'my-custom-tag',
  },
])('Expect repo tags parsing', ({ repoTag, expectedName, expectedTag }) => {
  test(`${repoTag}`, () => {
    expect(imageUtils.getName(repoTag)).toBe(expectedName);
    expect(imageUtils.getTag(repoTag)).toBe(expectedTag);
  });
});

describe('Expect inuse determination', () => {
  const imageInfoHello = {
    Id: 'sha256:1b10fa0fd8d184d9de22a553688af8f9f8adbabb11f5dfc15f1a0fdd21873db2',
    RepoTags: ['quay.io/podman/hello3:latest', 'quay.io/podman/hello2:latest', 'quay.io/podman/hello:latest'],
  } as unknown as ImageInfo;

  const untaggedImageInfo = {
    Id: 'sha256:1b10fa0fd8d184d9de22a553688af8f9f8adbabb11f5dfc15f1a0fdd21873db2',
  } as unknown as ImageInfo;

  const containerInfo = {
    Id: 'container1',
    Image: 'quay.io/podman/hello:latest',
    ImageID: 'sha256:1b10fa0fd8d184d9de22a553688af8f9f8adbabb11f5dfc15f1a0fdd21873db2',
  } as unknown as ContainerInfo;

  test('Untagged image in use', async () => {
    const containerInfo = {
      Id: 'container1',
      Image: 'sha256:1b10fa0fd8d184d9de22a553688af8f9f8adbabb11f5dfc15f1a0fdd21873db2',
      ImageID: 'sha256:1b10fa0fd8d184d9de22a553688af8f9f8adbabb11f5dfc15f1a0fdd21873db2',
    } as unknown as ContainerInfo;

    expect(imageUtils.getInUse(untaggedImageInfo, undefined, [containerInfo])).toBeTruthy();
  });

  test('Not in use when no containers', async () => {
    expect(imageUtils.getInUse(imageInfoHello)).toBeFalsy();
  });

  test.each([
    ['quay.io/podman/hello:latest', true],
    ['quay.io/podman/hello2:latest', false],
    ['quay.io/podman/hello3:latest', false],
  ])('inUse for repoTag %s', async (repoTag: string, expected: boolean) => {
    expect(imageUtils.getInUse(imageInfoHello, repoTag, [containerInfo])).toBe(expected);
  });
});
