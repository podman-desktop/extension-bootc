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
} from '@podman-desktop/tests-playwright';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { BootcNavigationBar } from './model/bootc-navigationbar';
import {
  removeBootcExtensionIfNeeded,
  handleWebview,
  installBootcExtensionIfNeeded,
  stripImageTag,
  cleanupRawVideoFiles,
} from './bootc-test-utils';

let page: Page;
let webview: Page;
const isLinux = os.platform() === 'linux';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const examples = [
  { appName: 'Podman systemd', imageName: 'registry.gitlab.com/fedora/bootc/examples/app-podman-systemd:latest' },
];

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
  runner.setVideoAndTraceName('bootc-examples');
  await welcomePage.handleWelcomePage(true);
  await waitForPodmanMachineStartup(page);
});

test.afterAll(async ({ runner, page }) => {
  test.setTimeout(180_000);
  try {
    for (const example of examples) {
      await deleteImage(page, stripImageTag(example.imageName));
    }
  } catch (error) {
    console.log(`Error deleting image: ${error}`);
  } finally {
    await removeFolderIfExists('tests/output/images');
    await runner.close(120_000);
    cleanupRawVideoFiles('tests/output');
  }
});

test.describe('BootC Examples', () => {
  test.skip(isLinux);

  test.beforeAll(async ({ navigationBar }) => {
    test.setTimeout(200_000);
    await installBootcExtensionIfNeeded(navigationBar);
  });

  for (const example of examples) {
    test.describe
      .serial(`Bootc examples for bootable image`, () => {
        test(`Pull ${example.appName} bootable image`, async ({ runner }) => {
          test.setTimeout(610_000);

          [page, webview] = await handleWebview(runner);
          const bootcNavigationBar = new BootcNavigationBar(page, webview);
          const bootcExamplesPage = await bootcNavigationBar.openBootcExamples();
          await playExpect(bootcExamplesPage.heading).toBeVisible();
          await bootcExamplesPage.pullImage(example.appName, 600_000);
        });

        const types = ['QCOW2'];

        for (const type of types) {
          test.describe
            .serial('Building images ', () => {
              test(`Building ${example.appName} bootable image type: ${type}`, async ({ runner }) => {
                test.setTimeout(1_250_000);

                [page, webview] = await handleWebview(runner);
                const bootcNavigationBar = new BootcNavigationBar(page, webview);
                const bootcExamplesPage = await bootcNavigationBar.openBootcExamples();
                await playExpect(bootcExamplesPage.heading).toBeVisible();
                await playExpect(bootcExamplesPage.buildImageButtonLocator(example.appName)).toBeEnabled();

                const pathToStore = path.resolve(
                  __dirname,
                  '..',
                  'tests',
                  'output',
                  'images',
                  `${example.appName}-${type}`,
                );

                const result = await bootcExamplesPage.buildImage(
                  example.appName,
                  example.imageName,
                  pathToStore,
                  type,
                  1_200_000,
                );
                playExpect(result).toBeTruthy();
              });
            });
        }
      });
  }

  test.afterAll(async ({ navigationBar }) => {
    await removeBootcExtensionIfNeeded(navigationBar);
  });
});
