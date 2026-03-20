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
  removeFolderIfExists,
  waitForPodmanMachineStartup,
  test,
  expect as playExpect,
  RunnerOptions,
  isLinux,
} from '@podman-desktop/tests-playwright';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BootcNavigationBar } from './model/bootc-navigationbar';
import {
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
  runner.setVideoAndTraceName('bootc-dashboard');
  await welcomePage.handleWelcomePage(true);
  await waitForPodmanMachineStartup(page);
});

test.afterAll(async ({ runner }) => {
  test.setTimeout(300_000);
  try {
    await removeFolderIfExists('tests/output/images');
  } finally {
    await runner.close(120_000);
    cleanupRawVideoFiles('tests/output', 'bootc-dashboard');
  }
});

test.describe('BootC Dashboard', () => {
  test.skip(isLinux);

  test.beforeAll(async ({ navigationBar }) => {
    test.setTimeout(200_000);
    await installBootcExtensionIfNeeded(navigationBar);
  });

  test.describe
    .serial('Bootc Dashboard', () => {
      test('Pull demo image from dashboard', async ({ runner }) => {
        test.setTimeout(610_000);

        [page, webview] = await handleWebview(runner);
        const bootcNavigationBar = new BootcNavigationBar(page, webview);
        const bootcDashboardPage = await bootcNavigationBar.openBootcDashboard();
        await playExpect(bootcDashboardPage.heading).toBeVisible();
        await bootcDashboardPage.pullDemoImage(600_000);
      });

      const types = ['AMI'];

      for (const type of types) {
        test(`Build demo image from dashboard for type ${type}`, async ({ runner }) => {
          test.setTimeout(1_250_000);

          [page, webview] = await handleWebview(runner);
          const bootcNavigationBar = new BootcNavigationBar(page, webview);
          const bootcDashboardPage = await bootcNavigationBar.openBootcDashboard();
          await playExpect(bootcDashboardPage.heading).toBeVisible();
          await playExpect(bootcDashboardPage.buildDemoImageButton).toBeEnabled();

          const pathToStore = path.resolve(__dirname, '..', 'tests', 'output', 'images', `demoImage-${type}`);

          const result = await bootcDashboardPage.buildDemoImage(pathToStore, type, 1_200_000);
          playExpect(result).toBeTruthy();
        });
      }
    });

  test.afterAll(async ({ navigationBar }) => {
    if (markTestFileComplete()) {
      await removeBootcExtensionIfNeeded(navigationBar);
    }
  });
});
