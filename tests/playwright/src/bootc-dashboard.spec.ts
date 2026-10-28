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
  test.setTimeout(320_000);
  const videoAndTraceName = runner.getVideoAndTraceName();
  try {
    await removeFolderIfExists('tests/output/images');
  } finally {
    await runner.close(200_000);
    cleanupRawVideoFiles('tests/output', videoAndTraceName);
  }
});

test.describe('BootC Dashboard', () => {
  test.beforeAll(async ({ navigationBar }) => {
    test.setTimeout(200_000);
    await installBootcExtensionIfNeeded(navigationBar);
  });

  test.describe
    .serial('Bootc Dashboard', () => {
      test('Show the dashboard sections and actions', async ({ runner }) => {
        [page, webview] = await handleWebview(runner);
        const bootcNavigationBar = new BootcNavigationBar(page, webview);
        const dashboard = await bootcNavigationBar.openBootcDashboard();
        await playExpect(dashboard.heading).toBeVisible();

        for (const name of ['Get Started', 'Images', 'Learn more']) {
          await playExpect(webview.getByRole('heading', { name, exact: true, level: 2 })).toBeVisible();
        }

        for (const name of [
          'Build disk image',
          'View images',
          'View disk images',
          'Read guide',
          'Read article',
          'Read docs',
        ]) {
          await playExpect(webview.getByRole('button', { name, exact: true })).toBeEnabled();
        }
        await playExpect(webview.getByRole('link', { name: 'View documentation' })).toBeVisible();
        await playExpect(webview.getByText(/^\d+ BootC container images$/)).toBeAttached();
        await playExpect(webview.getByText(/^\d+ Disk images$/)).toBeAttached();
      });

      for (const [action, role, destination] of [
        ['Build disk image', 'heading', 'Build Disk Image'],
        ['View images', 'region', 'images'],
        ['View disk images', 'region', 'disk images'],
      ] as const) {
        test(`Navigate from ${action}`, async ({ runner }) => {
          [page, webview] = await handleWebview(runner);
          const bootcNavigationBar = new BootcNavigationBar(page, webview);
          const dashboard = await bootcNavigationBar.openBootcDashboard();

          await webview.getByRole('button', { name: action, exact: true }).click();

          await playExpect(dashboard.heading).not.toBeVisible();
          await playExpect(webview.getByRole(role, { name: destination, exact: true })).toBeVisible();
        });
      }

      test('Pull or reuse demo image from dashboard', async ({ runner }) => {
        test.setTimeout(750_000);

        [page, webview] = await handleWebview(runner);
        const bootcNavigationBar = new BootcNavigationBar(page, webview);
        const bootcDashboardPage = await bootcNavigationBar.openBootcDashboard();
        await playExpect(bootcDashboardPage.heading).toBeVisible();
        await bootcDashboardPage.pullDemoImage(720_000);
      });

      test('Open the example build with its image selected', async ({ runner }) => {
        [page, webview] = await handleWebview(runner);
        const bootcNavigationBar = new BootcNavigationBar(page, webview);
        const dashboard = await bootcNavigationBar.openBootcDashboard();

        const buildPage = await dashboard.openDemoImageBuild();

        await playExpect(buildPage.imageSelect).toHaveValue('registry.gitlab.com/fedora/bootc/examples/httpd:latest');
      });

      test('Configure demo image through the build wizard', async ({ runner }) => {
        test.setTimeout(60_000);

        [page, webview] = await handleWebview(runner);
        const navigation = new BootcNavigationBar(page, webview);
        const dashboard = await navigation.openBootcDashboard();
        const buildPage = await dashboard.openDemoImageBuild();
        const imageName = await buildPage.imageSelect.inputValue();
        const next = webview.getByRole('button', { name: 'Next', exact: true });
        const back = webview.getByRole('button', { name: 'Back', exact: true });
        await playExpect(buildPage.imageSelect).toHaveValue(imageName);
        await playExpect(buildPage.outputFolderPath).toBeVisible();
        const buildStep = webview.getByRole('button', { name: 'Build configuration', exact: true });
        const userStep = webview.getByRole('button', { name: 'User configuration', exact: true });
        const steps = webview.getByRole('navigation', { name: 'Build steps' });
        await playExpect(steps.getByRole('button')).toHaveCount(3);
        await test.info().attach('build-wizard-select', { body: await webview.screenshot(), contentType: 'image/png' });

        // Require output options before the user can advance.
        await buildPage.outputFolderPath.fill('');
        for (const type of ['raw', 'qcow2', 'iso', 'vmdk', 'ami', 'vhd', 'gce']) {
          await webview.getByLabel(`${type}-checkbox`).uncheck();
        }
        await playExpect(next).toBeDisabled();
        await playExpect(userStep).toBeDisabled();
        await playExpect(buildStep).toBeDisabled();
        await playExpect(webview.getByRole('alert')).toHaveText('No output folder selected');
        await test.info().attach('build-wizard-output-error', {
          body: await webview.screenshot(),
          contentType: 'image/png',
        });
        const outputFolder = path.resolve(__dirname, '..', 'tests', 'output', 'images', 'wizard');
        await buildPage.outputFolderPath.fill(outputFolder);
        await playExpect(next).toBeDisabled();
        await buildPage.qcow2Checkbox.check();
        await next.click();
        await playExpect(buildPage.outputFolderPath).not.toBeVisible();
        await playExpect(webview.getByText('Advanced options', { exact: true })).toBeVisible();
        await playExpect(webview.getByRole('radio', { name: /^(amd64|arm64)-select$/, checked: true })).toBeChecked();
        await next.click();

        // Credentials are optional. The final step warns about missing login access.
        await playExpect(webview.getByRole('textbox', { name: 'Username', exact: true })).toBeVisible();
        await playExpect(webview.getByRole('heading', { name: 'VM login credentials' })).not.toBeVisible();
        await playExpect(webview.getByRole('alert')).toHaveCount(1);
        await test.info().attach('build-wizard-users', { body: await webview.screenshot(), contentType: 'image/png' });
        await playExpect(webview.getByRole('heading', { name: 'No login credentials configured' })).toBeVisible();
        await playExpect(buildPage.buildButton).toBeEnabled();
        await playExpect(next).not.toBeVisible();
        await webview.getByRole('textbox', { name: 'Username', exact: true }).fill('root');
        const sshKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITestKey bootc-wizard-test';
        await webview.getByRole('textbox', { name: 'SSH public key (recommended)' }).fill(sshKey);
        await playExpect(webview.getByRole('heading', { name: 'No login credentials configured' })).not.toBeVisible();
        await playExpect(buildPage.buildButton).toBeEnabled();
        await test.info().attach('build-wizard-review', { body: await webview.screenshot(), contentType: 'image/png' });

        // Both the stepper and Back preserve the form values.
        await buildStep.click();
        await userStep.focus();
        await webview.keyboard.press('Enter');
        await playExpect(webview.getByRole('textbox', { name: 'SSH public key (recommended)' })).toHaveValue(sshKey);
        await back.click();
        await playExpect(webview.getByText('Advanced options', { exact: true })).toBeVisible();
        await back.click();
        await playExpect(buildPage.outputFolderPath).toHaveValue(outputFolder);
        await playExpect(buildPage.qcow2Checkbox).toBeChecked();
        await playExpect(buildPage.imageSelect).toHaveValue(imageName);
        await userStep.click();
        await playExpect(buildPage.buildButton).toBeEnabled();
      });

      const types = ['AMI'];

      for (const type of types) {
        test(`Build demo image from dashboard for type ${type}`, async ({ runner }) => {
          // eslint-disable-next-line sonarjs/no-skipped-tests -- platform gate: bootable image builds unsupported on Linux
          test.skip(isLinux, 'Building bootable images is not supported on Linux');
          test.setTimeout(1_560_000);

          [page, webview] = await handleWebview(runner);
          const bootcNavigationBar = new BootcNavigationBar(page, webview);
          const bootcDashboardPage = await bootcNavigationBar.openBootcDashboard();
          await playExpect(bootcDashboardPage.heading).toBeVisible();
          await playExpect(bootcDashboardPage.buildDemoImageButton).toBeEnabled();

          const pathToStore = path.resolve(__dirname, '..', 'tests', 'output', 'images', `demoImage-${type}`);

          const result = await bootcDashboardPage.buildDemoImage(pathToStore, type, 1_500_000);
          playExpect(result).toBeTruthy();
        });
      }
    });

  test.afterAll(async ({ navigationBar }) => {
    if (markTestFileComplete(__filename)) {
      await removeBootcExtensionIfNeeded(navigationBar);
    }
  });
});
