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

export class BootcDashboardPage {
  readonly page: Page;
  readonly webview: Page;
  readonly heading: Locator;
  readonly pullDemoImageButton: Locator;
  readonly buildDemoImageButton: Locator;

  constructor(page: Page, webview: Page) {
    this.page = page;
    this.webview = webview;
    this.heading = webview.getByText('Welcome to bootable containers');
    this.pullDemoImageButton = webview.getByLabel('Pull image', { exact: true });
    this.buildDemoImageButton = webview.getByLabel('Build image', { exact: true });
  }

  public async pullDemoImage(timeout = 300_000): Promise<void> {
    await playExpect(this.pullDemoImageButton).toBeEnabled();
    await this.pullDemoImageButton.click();
    await playExpect(this.pullDemoImageButton).toBeDisabled({ timeout: 10_000 });
    await playExpect(this.buildDemoImageButton).toBeEnabled({ timeout: timeout });
  }

  public async buildDemoImage(pathToStore: string, type: string, timeout = 600_000): Promise<boolean> {
    await playExpect(this.buildDemoImageButton).toBeEnabled();
    const imageName = await this.getDemoImageName();
    playExpect(imageName).toBeTruthy();
    await this.buildDemoImageButton.click();
    await playExpect(this.heading).not.toBeVisible({ timeout: 10_000 });

    const bootcBuildImagePage = new BootcPage(this.page, this.webview);
    await playExpect(bootcBuildImagePage.heading).toBeVisible({ timeout: 10_000 });
    return await bootcBuildImagePage.buildDiskImage(imageName, pathToStore, type, ArchitectureType.Default, timeout);
  }

  public async getDemoImageName(): Promise<string> {
    const text = await this.buildDemoImageButton.innerText();
    return text.split(' ')[1];
  }
}
