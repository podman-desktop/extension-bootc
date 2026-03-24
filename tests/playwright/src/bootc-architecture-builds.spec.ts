/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import type { Page } from '@playwright/test';
import {
  deleteImage,
  removeFolderIfExists,
  waitForPodmanMachineStartup,
  test,
  expect as playExpect,
  RunnerOptions,
  ArchitectureType,
  isLinux,
  isMac,
  isWindows,
} from '@podman-desktop/tests-playwright';
import * as path from 'node:path';
import { BootcPage } from './model/bootc-page';
import { fileURLToPath } from 'node:url';
import {
  imageName,
  imageTag,
  removeBootcExtensionIfNeeded,
  handleWebview,
  installBootcExtensionIfNeeded,
  cleanupRawVideoFiles,
} from './utility/bootc-test-utils';
import { markTestFileComplete } from './utility/extension-lifecycle';

let page: Page;
let webview: Page;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const containerFilePath = path.resolve(__dirname, '..', 'resources', 'bootable-containerfile');
const contextDirectory = path.resolve(__dirname, '..', 'resources');
const buildISOImage = process.env.BUILD_ISO_IMAGE;
let imageBuildFailed = true;
test.use({
  runnerOptions: new RunnerOptions({
    customFolder: 'bootc-tests-pd',
    customOutputFolder: 'tests/output',
    autoUpdate: false,
    autoCheckUpdates: false,
  }),
});

test.beforeAll(async ({ runner, welcomePage, page }) => {
  await removeFolderIfExists('tests/output/images');
  runner.setVideoAndTraceName('bootc-architecture-builds');
  await welcomePage.handleWelcomePage(true);
  await waitForPodmanMachineStartup(page);
});

test.afterAll(async ({ runner, page }) => {
  test.setTimeout(320_000);
  try {
    await deleteImage(page, imageName);
  } catch (error) {
    console.log(`Error deleting image: ${error}`);
  } finally {
    const videoAndTraceName = runner.getVideoAndTraceName();
    await removeFolderIfExists('tests/output/images');
    await runner.close(200_000);
    cleanupRawVideoFiles('tests/output', videoAndTraceName);
  }
});

test.describe('BootC Architecture Builds', () => {
  test.beforeAll(async ({ navigationBar }) => {
    test.setTimeout(200_000);
    await installBootcExtensionIfNeeded(navigationBar);
  });

  const architectures = [ArchitectureType.AMD64, ArchitectureType.ARM64];

  for (const architecture of architectures) {
    test.describe
      .serial(`Bootc images for architecture: ${architecture}`, () => {
        test(`Build bootc image from containerfile for architecture: ${architecture}`, async ({ navigationBar }) => {
          test.setTimeout(1_560_000);

          imageBuildFailed = true;
          let imagesPage = await navigationBar.openImages();
          await playExpect(imagesPage.heading).toBeVisible();

          const buildImagePage = await imagesPage.openBuildImage();
          await playExpect(buildImagePage.heading).toBeVisible();

          imagesPage = await buildImagePage.buildImage(
            `${imageName}:${imageTag}`,
            containerFilePath,
            contextDirectory,
            [architecture],
            1_500_000,
          );

          await playExpect
            .poll(async () => await imagesPage.waitForImageExists(imageName, 30_000), { timeout: 0 })
            .toBeTruthy();
          await playExpect
            .poll(async () => await imagesPage.checkImageBadge(imageName, 'bootc'), { timeout: 30_000 })
            .toBeTruthy();

          imageBuildFailed = false;
        });

        const types = ['QCOW2', 'AMI', 'RAW', 'VMDK', 'ISO', 'VHD'];

        for (const type of types) {
          test.describe
            .serial('Building images ', () => {
              test(`Building bootable image type: ${type}`, async ({ runner, navigationBar }) => {
                test.skip(isLinux, 'Building bootable images is not supported on Linux');
                test.skip(
                  isMac && architecture === ArchitectureType.AMD64,
                  'Building amd64 bootable images is not supported on macOS',
                );
                test.skip(
                  isWindows && architecture === ArchitectureType.ARM64,
                  'Building arm64 bootable images is not supported on Windows',
                );
                test.skip(
                  isWindows && type === 'VMDK',
                  'VMDK builds are too slow on Windows virtualized environments (Hyper-V/WSL2 I/O bottleneck)',
                );
                test.setTimeout(1_560_000);

                if (imageBuildFailed) {
                  console.log('Image build failed, skipping test');
                  test.skip();
                }

                if (type === 'ISO' && !buildISOImage) {
                  console.log(`Building ISO image not requested, skipping test`);
                  test.skip();
                }

                const imagesPage = await navigationBar.openImages();
                await playExpect(imagesPage.heading).toBeVisible();

                const imageDetailPage = await imagesPage.openImageDetails(imageName);
                await playExpect(imageDetailPage.heading).toBeVisible();

                const pathToStore = path.resolve(
                  __dirname,
                  '..',
                  'tests',
                  'output',
                  'images',
                  `${type}-${architecture}`,
                );
                [page, webview] = await handleWebview(runner);
                const bootcPage = new BootcPage(page, webview);
                const result = await bootcPage.buildDiskImage(
                  `${imageName}:${imageTag}`,
                  pathToStore,
                  type,
                  architecture,
                  1_500_000,
                );

                console.log(
                  `Building disk image for platform ${process.platform} and architecture ${architecture} and type ${type} is ${result}`,
                );

                playExpect(result).toBeTruthy();
              });
            });
        }
      });
  }

  test.afterAll(async ({ navigationBar }) => {
    if (markTestFileComplete(__filename)) {
      await removeBootcExtensionIfNeeded(navigationBar);
    }
  });
});
