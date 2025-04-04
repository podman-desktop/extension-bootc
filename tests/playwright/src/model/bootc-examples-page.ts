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

import type { Locator, Page } from '@playwright/test';
import { expect as playExpect } from '@playwright/test';
import { BootcPage } from './bootc-page';
import { ArchitectureType } from '@podman-desktop/tests-playwright';

export class BootcExamples {
  readonly page: Page;
  readonly webview: Page;
  readonly heading: Locator;
  readonly fedoraBootableContainerImages: Locator;

  constructor(page: Page, webview: Page) {
    this.page = page;
    this.webview = webview;
    this.heading = webview.getByRole('region', { name: 'Examples', exact: true });
    this.fedoraBootableContainerImages = webview.getByLabel('Fedora Bootable Container Images', { exact: true });
  }

  public async pullImage(name: string, timeout = 300_000): Promise<void> {
    const pullImageButton = this.pullImageButtonLocator(name);
    await playExpect(pullImageButton).toBeEnabled();
    await pullImageButton.click();
    await playExpect(pullImageButton).toBeDisabled({ timeout: 10_000 });
    await playExpect(this.buildImageButtonLocator(name)).toBeEnabled({ timeout: timeout });
  }

  public async buildImage(
    name: string,
    image: string,
    pathToStore: string,
    type: string,
    timeout = 600_000,
  ): Promise<boolean> {
    const buildImageButton = this.buildImageButtonLocator(name);
    await playExpect(buildImageButton).toBeEnabled();
    await buildImageButton.click();
    await playExpect(this.heading).not.toBeVisible({ timeout: 10_000 });

    const bootcBuildImagePage = new BootcPage(this.page, this.webview);
    await playExpect(bootcBuildImagePage.heading).toBeVisible({ timeout: 10_000 });
    return await bootcBuildImagePage.buildDiskImage(image, pathToStore, type, ArchitectureType.Default, timeout);
  }

  public pullImageButtonLocator(name: string): Locator {
    return this.bootableImageButtonLocator(name, 'Pull image');
  }

  public buildImageButtonLocator(name: string): Locator {
    return this.bootableImageButtonLocator(name, 'Build image');
  }

  public moreDetailsButtonLocator(name: string): Locator {
    return this.bootableImageButtonLocator(name, 'MoreDetails');
  }

  private bootableImageLocator(name: string): Locator {
    return this.fedoraBootableContainerImages.getByLabel(name, { exact: true });
  }

  private bootableImageButtonLocator(name: string, label: string): Locator {
    return this.bootableImageLocator(name).getByLabel(label, { exact: true });
  }
}
