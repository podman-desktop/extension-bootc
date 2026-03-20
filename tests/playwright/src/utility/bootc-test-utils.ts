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
import type { Runner } from '@podman-desktop/tests-playwright';
import { NavigationBar, expect as playExpect, PreferencesPage, test } from '@podman-desktop/tests-playwright';
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export const imageName = 'quay.io/centos-bootc/centos-bootc';
export const imageTag = 'stream9';
export const extensionName = 'bootc';
export const extensionLabel = 'redhat.bootc';
export const extensionHeading = 'Bootable Container';
export const skipInstallation = process.env.SKIP_INSTALLATION;

export function stripImageTag(imageReference: string): string {
  const lastColon = imageReference.lastIndexOf(':');
  if (lastColon === -1 || lastColon < imageReference.lastIndexOf('/')) {
    return imageReference;
  }
  return imageReference.substring(0, lastColon);
}

export async function ensureBootcIsRemoved(navigationBar: NavigationBar): Promise<void> {
  console.log('Ensuring BootC extension is removed');
  let extensionsPage = await navigationBar.openExtensions();
  if (!(await extensionsPage.extensionIsInstalled(extensionLabel))) return;

  const bootcExtensionPage = await extensionsPage.openExtensionDetails(extensionName, extensionLabel, extensionHeading);
  await bootcExtensionPage.removeExtension();
  extensionsPage = await navigationBar.openExtensions();

  await playExpect
    .poll(async () => await extensionsPage.extensionIsInstalled(extensionLabel), { timeout: 30000 })
    .toBeFalsy();
  console.log('BootC extension removed');
}

export async function changeToRHELBuilderInPreferences(navigationBar: NavigationBar): Promise<void> {
  const settingsBar = await navigationBar.openSettings();
  const preferencesPage = await settingsBar.openTabPage(PreferencesPage);
  await playExpect(preferencesPage.heading).toBeVisible();

  const centosBuilderButton = preferencesPage.getPage().getByRole('button', { name: 'CentOS' });
  await playExpect(centosBuilderButton).toBeVisible({ timeout: 10_000 });
  await centosBuilderButton.scrollIntoViewIfNeeded();
  await centosBuilderButton.click();

  const rhelBuilderButton = preferencesPage.getPage().getByRole('button', { name: 'RHEL' }).first();
  await playExpect(rhelBuilderButton).toBeVisible({ timeout: 10_000 });
  await rhelBuilderButton.click();

  await playExpect(centosBuilderButton).not.toBeVisible({ timeout: 10_000 });
  await playExpect(rhelBuilderButton).toBeVisible({ timeout: 10_000 });
}

export async function handleWebview(runner: Runner): Promise<[Page, Page]> {
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

export async function removeBootcExtensionIfNeeded(navigationBar: NavigationBar): Promise<void> {
  if (skipInstallation) return;
  await ensureBootcIsRemoved(navigationBar);
}

export async function installBootcExtensionIfNeeded(navigationBar: NavigationBar): Promise<void> {
  console.log('Installing BootC extension if needed');
  const extensionsPage = await navigationBar.openExtensions();
  const extensionInstalled = await extensionsPage.extensionIsInstalled(extensionLabel);

  if (skipInstallation || extensionInstalled) {
    await playExpect
      .poll(async () => await extensionsPage.extensionIsInstalled(extensionLabel), { timeout: 30_000 })
      .toBeTruthy();
    return;
  }

  console.log('Installing BootC extension from OCIImage');
  await extensionsPage.installExtensionFromOCIImage('ghcr.io/podman-desktop/extension-bootc:next');

  await playExpect
    .poll(async () => await extensionsPage.extensionIsInstalled(extensionLabel), { timeout: 30_000 })
    .toBeTruthy();
  console.log('BootC extension installed');
}

/**
 * Playwright generates raw video files with 32-char hex names (from createGuid()).
 * Runner.close() only saves/deletes the main page's recording — additional Electron
 * windows (e.g. webviews) leave orphaned raw files.
 *
 * When {@link expectedVideoName} is provided and the corresponding named video
 * (`<name>.webm`) exists, raw files are simply deleted. If the named video is
 * absent (e.g. the Electron process was force-killed and `saveVideoAs` failed),
 * raw recordings are moved into a `backups/` subfolder under the videos directory
 * so they survive into the CI artifact instead of being lost.
 *
 * **Important:** `runner.close()` deletes the named video when the test passed
 * (via `removeTracesOnFinished`), so the named-video check alone would produce a
 * false-positive save-failure. This function reads `test.info().status` directly
 * to distinguish intentional cleanup from a genuine save failure.
 */
export function cleanupRawVideoFiles(outputFolder: string, expectedVideoName?: string): void {
  if (!existsSync(outputFolder)) return;

  const RAW_VIDEO_PATTERN = /^[0-9a-f]{32,}\.webm$/;

  const videoDirs: string[] = [];

  // videos/ directly under outputFolder (no profile)
  const topLevelVideos = join(outputFolder, 'videos');
  if (existsSync(topLevelVideos)) {
    videoDirs.push(topLevelVideos);
  }

  // <profile>/videos/ under outputFolder (when a profile is configured)
  const subdirs = readdirSync(outputFolder, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const subdir of subdirs) {
    const nested = join(outputFolder, subdir.name, 'videos');
    if (nested !== topLevelVideos && existsSync(nested)) {
      videoDirs.push(nested);
    }
  }

  const namedVideoMissing =
    !!expectedVideoName && !videoDirs.some(dir => existsSync(join(dir, `${expectedVideoName}.webm`)));
  const testPassed = test?.info()?.status === 'passed';
  const saveFailure = namedVideoMissing && !testPassed;

  if (saveFailure) {
    console.log(`Named video '${expectedVideoName}.webm' not found — moving raw recordings to backups/`);
  }

  for (const videosDir of videoDirs) {
    for (const file of readdirSync(videosDir)) {
      if (!RAW_VIDEO_PATTERN.test(file)) continue;

      const filePath = join(videosDir, file);

      if (saveFailure) {
        try {
          const backupsDir = join(videosDir, 'backups');
          if (!existsSync(backupsDir)) {
            mkdirSync(backupsDir, { recursive: true });
          }
          const dest = join(backupsDir, file);
          renameSync(filePath, dest);
          console.log(`Moved raw video to backup: ${dest}`);
        } catch (e) {
          console.log(`Failed to move raw video file to backups: ${e}`);
        }
      } else {
        try {
          unlinkSync(filePath);
          console.log(`Removed raw video file: ${filePath}`);
        } catch (e) {
          console.log(`Failed to remove raw video file: ${e}`);
        }
      }
    }
  }
}
