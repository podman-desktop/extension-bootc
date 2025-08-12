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
import { waitUntil, ArchitectureType } from '@podman-desktop/tests-playwright';
import { BootcNavigationBar } from './bootc-navigationbar';
import { BootcImageDetailsPage } from './bootc-image-details';

export class BootcPage {
  readonly page: Page;
  readonly webview: Page;
  readonly heading: Locator;
  readonly outputFolderPath: Locator;
  readonly rawCheckbox: Locator;
  readonly qcow2Checkbox: Locator;
  readonly isoCheckbox: Locator;
  readonly vmdkCheckbox: Locator;
  readonly amiCheckbox: Locator;
  readonly vhdCheckbox: Locator;
  readonly amd64Button: Locator;
  readonly arm64Button: Locator;
  readonly buildButton: Locator;
  readonly imageSelect: Locator;
  readonly goBackButton: Locator;
  readonly rowGroup: Locator;
  readonly latestBuiltImage: Locator;
  readonly getCurrentStatusOfLatestBuildImage: Locator;
  readonly bootcListPage: Locator;
  readonly bootcBuildDiskPage: Locator;
  readonly getTypeOfLatestBuildImage: Locator;

  constructor(page: Page, webview: Page) {
    this.page = page;
    this.webview = webview;
    this.heading = webview.getByLabel('Build Disk Image');
    this.outputFolderPath = webview.getByLabel('folder-select');
    this.imageSelect = webview.getByLabel('image-select');
    this.rawCheckbox = webview.getByLabel('raw-checkbox');
    this.qcow2Checkbox = webview.getByLabel('qcow2-checkbox');
    this.isoCheckbox = webview.getByLabel('iso-checkbox');
    this.vmdkCheckbox = webview.getByLabel('vmdk-checkbox');
    this.amiCheckbox = webview.getByLabel('ami-checkbox');
    this.vhdCheckbox = webview.getByLabel('vhd-checkbox');
    this.amd64Button = webview.getByLabel('amd64-button');
    this.arm64Button = webview.getByLabel('arm64-button');
    this.bootcListPage = webview.getByRole('region', { name: 'Bootable Containers', exact: true });
    this.bootcBuildDiskPage = webview.getByLabel('Build Disk Image');
    this.buildButton = webview.getByRole('button', { name: 'Build', exact: true });
    this.goBackButton = webview.getByRole('button', { name: 'Go back', exact: true });
    this.rowGroup = webview.getByRole('rowgroup').nth(1);
    this.latestBuiltImage = this.rowGroup.getByRole('row').first();
    this.getCurrentStatusOfLatestBuildImage = this.latestBuiltImage.getByRole('status');
    this.getTypeOfLatestBuildImage = this.latestBuiltImage.getByRole('cell').nth(4);
  }

  async buildDiskImage(
    imageName: string,
    pathToStore: string,
    type: string,
    architecture: ArchitectureType,
    timeout = 600_000,
  ): Promise<boolean> {
    let result = false;

    console.log(
      `Building disk image for ${imageName} in path ${pathToStore} with type ${type} and architecture ${architecture}`,
    );

    const bootcNavigationBar = new BootcNavigationBar(this.page, this.webview);

    if (!(await this.heading.isVisible())) {
      const bootcImagesPage = await bootcNavigationBar.openBootcDiskImages();
      await playExpect(bootcImagesPage.heading).toBeVisible();
      await playExpect(bootcImagesPage.buildButton).toBeEnabled();
      await bootcImagesPage.buildButton.click();
    }

    await playExpect(this.heading).toBeVisible({ timeout: 10_000 });
    await this.imageSelect.selectOption({ label: imageName });

    await this.webview.waitForTimeout(5_000);
    await playExpect(this.outputFolderPath).toBeVisible({ timeout: 10_000 });
    await this.outputFolderPath.scrollIntoViewIfNeeded();

    await this.outputFolderPath.clear();
    await playExpect(this.outputFolderPath).toHaveValue('');

    await this.outputFolderPath.pressSequentially(pathToStore, { delay: 5 });
    await playExpect(this.outputFolderPath).toHaveValue(pathToStore);

    await this.uncheckedAllCheckboxes();
    await this.webview.waitForTimeout(10_000);

    switch (type.toLocaleLowerCase()) {
      case 'raw':
        await this.checkCheckbox(this.rawCheckbox);
        break;
      case 'qcow2':
        await this.checkCheckbox(this.qcow2Checkbox);
        break;
      case 'iso':
        await this.checkCheckbox(this.isoCheckbox);
        break;
      case 'vmdk':
        await this.checkCheckbox(this.vmdkCheckbox);
        break;
      case 'ami':
        await this.checkCheckbox(this.amiCheckbox);
        break;
      case 'vhd':
        await this.checkCheckbox(this.vhdCheckbox);
        break;
      default:
        throw new Error(`Unknown type: ${type}`);
    }

    await this.webview.waitForTimeout(10_000);

    switch (architecture) {
      case ArchitectureType.AMD64:
        await playExpect(this.amd64Button).toBeEnabled();
        await this.amd64Button.click();
        break;
      case ArchitectureType.ARM64:
        await playExpect(this.arm64Button).toBeEnabled();
        await this.arm64Button.click();
        break;
      case ArchitectureType.Default:
        // No action needed for default architecture
        break;
      default:
        throw new Error(`Unknown architecture: ${architecture}`);
    }

    await this.buildButton.scrollIntoViewIfNeeded();
    await playExpect(this.buildButton).toBeEnabled({ timeout: 15_000 });
    await this.buildButton.click();

    const errTimeoutLocator = this.webview.getByText('Error: Timeout', { exact: true });
    const detailsPage = new BootcImageDetailsPage(this.page, this.webview, imageName);
    await playExpect(detailsPage.heading.or(errTimeoutLocator).first()).toBeVisible({ timeout: 120_000 });

    const bootcImagesPage = await bootcNavigationBar.openBootcDiskImages();
    await playExpect(bootcImagesPage.heading).toBeVisible({ timeout: 10_000 });

    await playExpect(this.getTypeOfLatestBuildImage).toContainText(type.toLocaleLowerCase(), { timeout: 60_000 });
    await waitUntil(async () => await this.refreshPageWhileInCreatingState(), { timeout: 120_000, diff: 1_000 });
    await this.waitUntilCurrentBuildIsFinished(timeout);
    if ((await this.getCurrentStatusOfLatestEntry()) === 'error') {
      console.log('Error building image! Retuning false.');
      return false;
    }

    const dialogMessageLocator = this.page.getByLabel('Dialog Message');
    result = (await dialogMessageLocator.innerText()).includes('Success!');
    const okButtonLocator = this.page.getByRole('button', { name: 'OK' });
    await playExpect(okButtonLocator).toBeEnabled();
    await okButtonLocator.click();

    return result;
  }

  private async uncheckedAllCheckboxes(): Promise<void> {
    await this.uncheckCheckbox(this.rawCheckbox);
    await this.uncheckCheckbox(this.qcow2Checkbox);
    await this.uncheckCheckbox(this.isoCheckbox);
    await this.uncheckCheckbox(this.vmdkCheckbox);
    await this.uncheckCheckbox(this.amiCheckbox);
    await this.uncheckCheckbox(this.vhdCheckbox);
  }

  private async uncheckCheckbox(checkbox: Locator): Promise<void> {
    await playExpect(checkbox).toBeVisible();
    await checkbox.scrollIntoViewIfNeeded();

    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
    await playExpect(checkbox).not.toBeChecked();
  }

  private async checkCheckbox(checkbox: Locator): Promise<void> {
    await playExpect(checkbox).toBeVisible();
    await checkbox.scrollIntoViewIfNeeded();

    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
    await playExpect(checkbox).toBeChecked();
  }

  async getCurrentStatusOfLatestEntry(): Promise<string> {
    const status = await this.getCurrentStatusOfLatestBuildImage.getAttribute('title');

    if (status) return status.toLocaleLowerCase();
    return '';
  }

  async waitUntilCurrentBuildIsFinished(timeout = 600_000): Promise<void> {
    const dialogMessageLocator = this.page.getByLabel('Dialog Message');
    await waitUntil(
      async () =>
        (await this.getCurrentStatusOfLatestEntry()) === 'error' ||
        (await this.getCurrentStatusOfLatestEntry()) === 'success' ||
        (await dialogMessageLocator.isVisible()),
      { timeout: timeout, diff: 2_500, message: `Build didn't finish before timeout!` },
    );
  }

  async refreshPageWhileInCreatingState(): Promise<boolean> {
    if ((await this.getCurrentStatusOfLatestEntry()) !== 'creating') return true;

    const navigationBar = new BootcNavigationBar(this.page, this.webview);
    const dashboardPage = await navigationBar.openBootcDashboard();
    await playExpect(dashboardPage.heading).toBeVisible();
    const imagesPage = await navigationBar.openBootcDiskImages();
    await playExpect(imagesPage.heading).toBeVisible();
    return false;
  }
}
