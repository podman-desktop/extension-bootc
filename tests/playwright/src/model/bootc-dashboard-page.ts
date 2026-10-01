/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
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

import type { Locator, Page } from '@playwright/test';
import { expect as playExpect } from '@playwright/test';
import { BootcPage } from './bootc-page';
import { ArchitectureType } from '@podman-desktop/tests-playwright';

const NAVIGATION_TIMEOUT = 10_000;

export class BootcDashboardPage {
  readonly page: Page;
  readonly webview: Page;
  readonly heading: Locator;
  readonly pullDemoImageButton: Locator;
  readonly buildDemoImageButton: Locator;

  constructor(page: Page, webview: Page) {
    this.page = page;
    this.webview = webview;
    this.heading = webview.getByRole('heading', { name: 'Welcome to Bootable Containers' });
    this.pullDemoImageButton = webview.getByRole('button', { name: 'Pull example image', exact: true });
    this.buildDemoImageButton = webview.getByRole('button', { name: 'Build example image', exact: true });
  }

  public async pullDemoImage(timeout = 300_000): Promise<void> {
    // A previous run can leave the example image in the engine cache.
    await playExpect(this.pullDemoImageButton.or(this.buildDemoImageButton)).toBeVisible();
    if (await this.buildDemoImageButton.isVisible()) {
      await playExpect(this.buildDemoImageButton).toBeEnabled();
      return;
    }

    await playExpect(this.pullDemoImageButton).toBeEnabled();
    await this.pullDemoImageButton.click();

    // A fast pull can replace the button before its disabled state is observed.
    await playExpect(this.buildDemoImageButton).toBeEnabled({ timeout: timeout });
    await playExpect(this.pullDemoImageButton).not.toBeVisible();
  }

  public async buildDemoImage(pathToStore: string, type: string, timeout = 600_000): Promise<boolean> {
    const bootcBuildImagePage = await this.openDemoImageBuild();

    // The dashboard button no longer contains the image reference. Read the selected image from the form.
    const imageName = await bootcBuildImagePage.imageSelect.inputValue();
    return await bootcBuildImagePage.buildDiskImage(imageName, pathToStore, type, ArchitectureType.Default, timeout);
  }

  public async openDemoImageBuild(): Promise<BootcPage> {
    await playExpect(this.buildDemoImageButton).toBeEnabled();
    await this.buildDemoImageButton.click();
    await playExpect(this.heading).not.toBeVisible({ timeout: NAVIGATION_TIMEOUT });

    const bootcBuildImagePage = new BootcPage(this.page, this.webview);
    await playExpect(bootcBuildImagePage.heading).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
    await playExpect(bootcBuildImagePage.imageSelect).not.toHaveValue('');
    return bootcBuildImagePage;
  }
}
