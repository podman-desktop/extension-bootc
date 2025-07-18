/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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
import type { Runner } from '@podman-desktop/tests-playwright';
import {
  NavigationBar,
  deleteImage,
  removeFolderIfExists,
  waitForPodmanMachineStartup,
  test,
  expect as playExpect,
  RunnerOptions,
  ArchitectureType,
  PreferencesPage,
} from '@podman-desktop/tests-playwright';
import * as path from 'node:path';
import * as os from 'node:os';
import { BootcPage } from './model/bootc-page';
import { fileURLToPath } from 'node:url';
import { BootcNavigationBar } from './model/bootc-navigationbar';

let page: Page;
let webview: Page;
let extensionInstalled = false;
const imageName = 'quay.io/centos-bootc/centos-bootc';
const imageTag = 'stream9';
const extensionName = 'bootc';
const extensionLabel = 'redhat.bootc';
const extensionHeading = 'Bootable Container';
const isLinux = os.platform() === 'linux';
const isWindows = os.platform() === 'win32';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const containerFilePath = path.resolve(__dirname, '..', 'resources', 'bootable-containerfile');
const contextDirectory = path.resolve(__dirname, '..', 'resources');
const skipInstallation = process.env.SKIP_INSTALLATION;
const buildISOImage = process.env.BUILD_ISO_IMAGE;
let imageBuildFailed = true;
let types: string[] = [];

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
  runner.setVideoAndTraceName('bootc-e2e');
  await welcomePage.handleWelcomePage(true);
  await waitForPodmanMachineStartup(page);
});

test.afterAll(async ({ runner, page }) => {
  test.setTimeout(180_000);
  try {
    await deleteImage(page, imageName);
  } catch (error) {
    console.log(`Error deleting image: ${error}`);
  } finally {
    await removeFolderIfExists('tests/output/images');
    await runner.close();
  }
});

test.describe('BootC Extension', () => {
  test('Go to settings and check if extension is already installed', async ({ navigationBar }) => {
    const extensionsPage = await navigationBar.openExtensions();
    if (await extensionsPage.extensionIsInstalled(extensionLabel)) extensionInstalled = true;
  });

  test('Uninstalled previous version of bootc extension', async ({ navigationBar }) => {
    test.skip(!extensionInstalled || !!skipInstallation);
    test.setTimeout(200_000);
    console.log('Extension found already installed, trying to remove!');
    await ensureBootcIsRemoved(navigationBar);
  });

  test('Install extension through Extension page', async ({ navigationBar }) => {
    test.skip(!!skipInstallation);
    test.setTimeout(200_000);

    const extensionsPage = await navigationBar.openExtensions();
    await extensionsPage.installExtensionFromOCIImage('ghcr.io/podman-desktop/podman-desktop-extension-bootc:nightly');

    await playExpect
      .poll(async () => await extensionsPage.extensionIsInstalled(extensionLabel), { timeout: 30_000 })
      .toBeTruthy();
  });

  const architectures = [ArchitectureType.AMD64, ArchitectureType.ARM64];

  for (const architecture of architectures) {
    test.describe
      .serial(`Bootc images for architecture: ${architecture}`, () => {
        test(`Build bootc image from containerfile for architecture: ${architecture}`, async ({ navigationBar }) => {
          test.setTimeout(310_000);

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
            300_000,
          );

          await playExpect
            .poll(async () => await imagesPage.waitForImageExists(imageName, 30_000), { timeout: 0 })
            .toBeTruthy();
          await playExpect
            .poll(async () => await imagesPage.checkImageBadge(imageName, 'bootc'), { timeout: 30_000 })
            .toBeTruthy();

          imageBuildFailed = false;
        });

        types = ['QCOW2', 'AMI', 'RAW', 'VMDK', 'ISO', 'VHD'];

        for (const type of types) {
          test.describe
            .serial('Building images ', () => {
              test(`Building bootable image type: ${type}`, async ({ runner, navigationBar }) => {
                test.skip(isLinux);
                test.setTimeout(1_250_000);

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
                  1_200_000,
                );

                console.log(
                  `Building disk image for platform ${os.platform()} and architecture ${architecture} and type ${type} is ${result}`,
                );

                if (isWindows && architecture === ArchitectureType.ARM64) {
                  console.log('Expected to fail on Windows for ARM64');
                  playExpect(result).toBeFalsy();
                } else {
                  console.log('Expected to pass on Linux, Windows and macOS');
                  playExpect(result).toBeTruthy();
                }
              });
            });
        }
      });
  }

  const examples = [
    { appName: 'Podman systemd', imageName: 'registry.gitlab.com/fedora/bootc/examples/app-podman-systemd:latest' },
  ];

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

        types = ['QCOW2', 'AMI'];

        for (const type of types) {
          test.describe
            .serial('Building images ', () => {
              test(`Building ${example.appName} bootable image type: ${type}`, async ({ runner }) => {
                test.skip(isLinux);
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
                );
                playExpect(result).toBeTruthy();
              });
            });
        }
      });
  }

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

      types = ['QCOW2', 'AMI'];

      for (const type of types) {
        test(`Build demo image from dashboard for type ${type}`, async ({ runner }) => {
          test.skip(isLinux);
          test.setTimeout(1_250_000);

          [page, webview] = await handleWebview(runner);
          const bootcNavigationBar = new BootcNavigationBar(page, webview);
          const bootcDashboardPage = await bootcNavigationBar.openBootcDashboard();
          await playExpect(bootcDashboardPage.heading).toBeVisible();
          await playExpect(bootcDashboardPage.buildDemoImageButton).toBeEnabled();

          const pathToStore = path.resolve(__dirname, '..', 'tests', 'output', 'images', `demoImage-${type}`);

          const result = await bootcDashboardPage.buildDemoImage(pathToStore, type);
          playExpect(result).toBeTruthy();
        });
      }
    });

  test.describe
    .serial('Bootc image with RHEL builder', () => {
      test.skip(isLinux);

      test('Change builder to RHEL in Preferences', async ({ navigationBar }) => {
        await changeToRHELBuilderInPreferences(navigationBar);
      });

      const examples = [{ appName: 'WiFi', imageName: 'registry.gitlab.com/fedora/bootc/examples/wifi:latest' }];

      for (const example of examples) {
        test.describe
          .serial(`Bootc examples for bootable image`, () => {
            test(`Pull ${example.appName} bootable image`, async ({ runner }) => {
              test.setTimeout(310_000);

              [page, webview] = await handleWebview(runner);
              const bootcNavigationBar = new BootcNavigationBar(page, webview);
              const bootcExamplesPage = await bootcNavigationBar.openBootcExamples();
              await playExpect(bootcExamplesPage.heading).toBeVisible();
              await bootcExamplesPage.pullImage(example.appName);
            });

            types = ['QCOW2'];

            for (const type of types) {
              test.describe
                .serial('Building images ', () => {
                  test(`Building ${example.appName} bootable image type: ${type} with RHEL builder`, async ({
                    runner,
                    // eslint-disable-next-line sonarjs/no-nested-functions
                  }) => {
                    test.skip(isLinux);
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
                    );
                    playExpect(result).toBeTruthy();
                  });
                });
            }
          });
      }
    });

  test('Remove bootc extension through Settings', async ({ navigationBar }) => {
    await ensureBootcIsRemoved(navigationBar);
  });
});

async function ensureBootcIsRemoved(navigationBar: NavigationBar): Promise<void> {
  let extensionsPage = await navigationBar.openExtensions();
  if (!(await extensionsPage.extensionIsInstalled(extensionLabel))) return;

  const bootcExtensionPage = await extensionsPage.openExtensionDetails(extensionName, extensionLabel, extensionHeading);
  await bootcExtensionPage.removeExtension();
  extensionsPage = await navigationBar.openExtensions();

  await playExpect
    .poll(async () => await extensionsPage.extensionIsInstalled(extensionLabel), { timeout: 30000 })
    .toBeFalsy();
}

async function changeToRHELBuilderInPreferences(navigationBar: NavigationBar): Promise<void> {
  const settingsBar = await navigationBar.openSettings();
  const preferencesPage = await settingsBar.openTabPage(PreferencesPage);
  await playExpect(preferencesPage.heading).toBeVisible();

  const centosBuilderButton = preferencesPage.getPage().getByRole('button', { name: 'CentOS' });
  await playExpect(centosBuilderButton).toBeVisible({ timeout: 10_000 });
  await centosBuilderButton.scrollIntoViewIfNeeded();
  await centosBuilderButton.click();

  const rhelBuilderButton = preferencesPage.getPage().getByRole('button', { name: 'RHEL' });
  await playExpect(rhelBuilderButton).toBeVisible({ timeout: 10_000 });
  await rhelBuilderButton.click();

  await playExpect(centosBuilderButton).not.toBeVisible({ timeout: 10_000 });
  await playExpect(rhelBuilderButton).toBeVisible({ timeout: 10_000 });
}

async function handleWebview(runner: Runner): Promise<[Page, Page]> {
  const BOOTC_NAVBAR_EXTENSION_LABEL: string = 'Bootable Containers';
  const BOOTC_PAGE_BODY_LABEL: string = 'Webview Bootable Containers';

  const page = runner.getPage();
  const navigationBar = new NavigationBar(page);
  const bootcPodmanExtensionButton = navigationBar.navigationLocator.getByRole('link', {
    name: BOOTC_NAVBAR_EXTENSION_LABEL,
  });

  await playExpect(bootcPodmanExtensionButton).toBeEnabled();
  await bootcPodmanExtensionButton.click();
  await page.waitForTimeout(2_000);

  const webView = page.getByRole('document', { name: BOOTC_PAGE_BODY_LABEL });
  await playExpect(webView).toBeVisible();
  await new Promise(resolve => setTimeout(resolve, 1_000));
  const [mainPage, webViewPage] = runner.getElectronApp().windows();
  await mainPage.evaluate(() => {
    const element = document.querySelector('webview');
    if (element) {
      (element as HTMLElement).focus();
    } else {
      console.log(`element is null`);
    }
  });

  return [mainPage, webViewPage];
}
