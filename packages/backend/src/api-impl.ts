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

import * as podmanDesktopApi from '@podman-desktop/api';
import type { CreateVmOptions, VmDetails } from '@crc-org/macadam.js';
import type { ImageInfo, ContainerInfo } from '@podman-desktop/api';
import type { BootcApi } from '/@shared/src/BootcAPI';
import type { BootcBuildInfo, BuildType } from '/@shared/src/models/bootc';
import { buildDiskImage, buildExists } from './build-disk-image';
import { History } from './history';
import * as containerUtils from './container-utils';
import { Messages } from '/@shared/src/messages/Messages';
import { telemetryLogger } from './extension';
import { checkPrereqs, isLinux, isMac, isWindows, getUidGid, getArch } from './machine-utils';
import * as fs from 'node:fs';
import path from 'node:path';
import { getContainerEngine } from './container-utils';
import { createVMManager, stopCurrentVM } from './vm-manager';
import examplesCatalog from '../assets/examples.json';
import type { ExamplesList } from '/@shared/src/models/examples';
import { MacadamHandler } from './macadam';

export class BootcApiImpl implements BootcApi {
  static readonly CHANNEL: string = 'BootcApi';
  private history: History;
  private webview: podmanDesktopApi.Webview;

  constructor(
    private readonly extensionContext: podmanDesktopApi.ExtensionContext,
    webview: podmanDesktopApi.Webview,
  ) {
    this.history = new History(extensionContext.storagePath);
    this.webview = webview;
  }

  async getExamples(): Promise<ExamplesList> {
    return examplesCatalog as ExamplesList;
  }

  async checkPrereqs(): Promise<string | undefined> {
    return checkPrereqs(await getContainerEngine());
  }

  async checkVMLaunchPrereqs(buildId: string): Promise<string | undefined> {
    const build = this.history.getHistory().find(build => build.id === buildId);
    if (!build) {
      throw new Error(`Could not find build: ${buildId}`);
    }
    return createVMManager(build).checkVMLaunchPrereqs();
  }

  async buildExists(folder: string, types: BuildType[]): Promise<boolean> {
    return buildExists(folder, types);
  }

  async buildImage(build: BootcBuildInfo, overwrite?: boolean): Promise<void> {
    return buildDiskImage(build, this.history, overwrite);
  }

  // Launches a macadam VM by initializing the class and initializing the VM
  async createVM(options: CreateVmOptions): Promise<void> {
    const macadam = new MacadamHandler();
    await macadam.createVm(options);
  }

  // Returns a list of all the VM's currently in use
  async listVMs(): Promise<VmDetails[]> {
    const macadam = new MacadamHandler();
    return await macadam.listVms();
  }

  async launchVM(buildId: string): Promise<void> {
    try {
      const build = this.history.getHistory().find(build => build.id === buildId);
      if (!build) {
        await this.notify(Messages.MSG_VM_LAUNCH_ERROR, { success: '', error: 'Could not find build to launch' });
      } else {
        await createVMManager(build).launchVM();
        // Notify it has successfully launched
        await this.notify(Messages.MSG_VM_LAUNCH_ERROR, { success: 'Launched!', error: '' });
      }
    } catch (e) {
      // Make sure that we are able to display the "stderr" information if it exists as that actually shows
      // the error when running the command.
      let errorMessage: string;
      if (e instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        errorMessage = `${e.message} ${'stderr' in e ? (e as any).stderr : ''}`;
      } else {
        errorMessage = String(e);
      }
      await this.notify(Messages.MSG_VM_LAUNCH_ERROR, { success: '', error: errorMessage });
    }
  }

  // Stop VM by pid file on the system
  async stopCurrentVM(): Promise<void> {
    return stopCurrentVM();
  }

  async deleteBuilds(buildIds: string[]): Promise<void> {
    const response = await podmanDesktopApi.window.showWarningMessage(
      `Are you sure you want to remove the selected disk images from the build history? This will remove the history of the build as well as remove any lingering build containers.`,
      'Yes',
      'No',
    );
    if (response === 'Yes') {
      // create an array of builds. invalid build ids are ignored
      const builds = buildIds
        .map(id => this.history.getHistory().find(build => build.id === id))
        .filter(build => !!build);

      // Map each build to a delete operation promise
      const deletePromises = builds.map(build => this.deleteBuildContainer(build));

      try {
        await Promise.all(deletePromises);
      } catch (error) {
        await podmanDesktopApi.window.showErrorMessage(`An error occurred while deleting build: ${error}`);
        console.error('An error occurred while deleting build:', error);
      }
    }
  }

  protected async deleteBuildContainer(build: BootcBuildInfo): Promise<void> {
    // Update status to 'deleting'
    await this.history.addOrUpdateBuildInfo({ ...build, status: 'deleting' });

    const containers = await podmanDesktopApi.containerEngine.listContainers();
    const container = containers.find(c => c.Id === build.buildContainerId);

    // If we found the container, clean it up
    if (container) {
      const containerName = container.Names[0].replace('/', '');
      await containerUtils.removeContainerAndVolumes(container.engineId, containerName);
    }

    await this.history.removeBuildInfo(build);
  }

  async selectOutputFolder(): Promise<string> {
    const path = await podmanDesktopApi.window.showOpenDialog({
      title: 'Select output folder',
      selectors: ['openDirectory'],
    });
    if (path && path.length > 0) {
      return path[0].fsPath;
    }
    return '';
  }

  // Select a .raw or .qcow2 VM file
  async selectVMImageFile(): Promise<string> {
    const path = await podmanDesktopApi.window.showOpenDialog({
      title: 'Select VM file',
      selectors: ['openFile'],
      filters: [
        {
          name: '*',
          extensions: ['raw', 'qcow2'],
        },
      ],
    });
    if (path && path.length > 0) {
      return path[0].fsPath;
    }
    return '';
  }

  // Select a private key (doesn't matter what extension)
  async selectSSHPrivateKeyFile(): Promise<string> {
    const path = await podmanDesktopApi.window.showOpenDialog({
      title: 'Select private key file',
      selectors: ['openFile'],
    });
    if (path && path.length > 0) {
      return path[0].fsPath;
    }
    return '';
  }

  // Build config file will only ever be config.yaml or config.json as per bootc-iamge-builder requirements / constraints
  async selectBuildConfigFile(): Promise<string> {
    const path = await podmanDesktopApi.window.showOpenDialog({
      title: 'Select build config file',
      selectors: ['openFile'],
      filters: [
        {
          name: '*',
          extensions: ['toml', 'json'],
        },
      ],
    });
    if (path && path.length > 0) {
      return path[0].fsPath;
    }
    return '';
  }

  // Anaconda kickstart file ends in .ks extension
  async selectAnacondaKickstartFile(): Promise<string> {
    const path = await podmanDesktopApi.window.showOpenDialog({
      title: 'Select Anaconda kickstart file',
      selectors: ['openFile'],
      filters: [
        {
          name: '*',
          extensions: ['ks'],
        },
      ],
    });
    if (path && path.length > 0) {
      return path[0].fsPath;
    }
    return '';
  }

  async listAllImages(): Promise<ImageInfo[]> {
    let images: ImageInfo[] = [];
    try {
      images = await podmanDesktopApi.containerEngine.listImages();
    } catch (err) {
      await podmanDesktopApi.window.showErrorMessage(`Error listing images: ${err}`);
      console.error('Error listing images: ', err);
    }
    return images;
  }

  async deleteImage(engineId: string, id: string): Promise<void> {
    try {
      await podmanDesktopApi.containerEngine.deleteImage(engineId, id);
    } catch (err) {
      await podmanDesktopApi.window.showErrorMessage(`Error deleting image: ${err}`);
      console.error('Error deleting image: ', err);
    } finally {
      // Notify the frontend the images list may have changed
      await this.notify(Messages.MSG_IMAGE_UPDATE, {});
    }
  }

  async listBootcImages(): Promise<ImageInfo[]> {
    let images: ImageInfo[] = [];
    try {
      const retrievedImages = await podmanDesktopApi.containerEngine.listImages();
      const filteredImages: ImageInfo[] = [];
      for (const image of retrievedImages) {
        let includeImage = false;

        // The image must have RepoTags and Labels to be considered a bootc image
        if (image.RepoTags && image.Labels) {
          // Convert to boolean by checking the string is non-empty
          includeImage = !!(image.Labels['bootc'] ?? image.Labels['containers.bootc']);
        } else if (image?.isManifest) {
          // Manifests **usually** do not have any labels. If this is the case, we must find the images associated to the
          // manifest in order to determine if we are going to return the manifest or not.
          const manifestImages = await containerUtils.getImagesFromManifest(image, retrievedImages);
          // Checking if any associated image has a non-empty label
          includeImage = manifestImages.some(
            manifestImage => !!(manifestImage.Labels['bootc'] ?? manifestImage.Labels['containers.bootc']),
          );
        }

        if (includeImage) {
          filteredImages.push(image);
        }
      }
      images = filteredImages;
    } catch (err) {
      await podmanDesktopApi.window.showErrorMessage(`Error listing images: ${err}`);
      console.error('Error listing images: ', err);
    }
    return images;
  }

  async listContainers(): Promise<ContainerInfo[]> {
    try {
      return await podmanDesktopApi.containerEngine.listContainers();
    } catch (err) {
      await podmanDesktopApi.window.showErrorMessage(`Error listing containers: ${err}`);
      console.error('Error listing containers: ', err);
      return [];
    }
  }

  async inspectImage(image: ImageInfo): Promise<podmanDesktopApi.ImageInspectInfo> {
    let imageInspect: podmanDesktopApi.ImageInspectInfo;
    try {
      imageInspect = await podmanDesktopApi.containerEngine.getImageInspect(image.engineId, image.Id);
    } catch (err) {
      throw new Error(`Error inspecting image: ${err}`);
    }
    if (!imageInspect) {
      throw new Error('Unable to retrieve image inspect information');
    }
    return imageInspect;
  }

  // We pass in imageInfo because when we do listImages, it also lists manifests, and we can use imageInfo to get the manifest
  // name and engineId required.
  async inspectManifest(image: ImageInfo): Promise<podmanDesktopApi.ManifestInspectInfo> {
    let manifestInspect: podmanDesktopApi.ManifestInspectInfo;
    try {
      manifestInspect = await podmanDesktopApi.containerEngine.inspectManifest(image.engineId, image.Id);
    } catch (err) {
      throw new Error(`Error inspecting manifest: ${err}`);
    }
    if (!manifestInspect) {
      throw new Error('Unable to retrieve manifest inspect information');
    }
    return manifestInspect;
  }

  async listHistoryInfo(): Promise<BootcBuildInfo[]> {
    try {
      // Load the file so it retrieves the latest information.
      await this.history.loadFile();
    } catch (err) {
      await podmanDesktopApi.window.showErrorMessage(
        `Error loading history from ${this.extensionContext.storagePath}, error: ${err}`,
      );
      console.error('Error loading history: ', err);
    }
    return this.history.getHistory();
  }

  async openFolder(folder: string): Promise<boolean> {
    return await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.file(folder));
  }

  async openLink(link: string): Promise<void> {
    await podmanDesktopApi.env.openExternal(podmanDesktopApi.Uri.parse(link));
  }

  async openResources(): Promise<void> {
    return await podmanDesktopApi.navigation.navigateToResources();
  }

  async generateUniqueBuildID(name: string): Promise<string> {
    return this.history.getUnusedHistoryName(name);
  }

  // Pull an image from the registry
  async pullImage(imageName: string, arch?: string): Promise<void> {
    try {
      await containerUtils.pullImage(await getContainerEngine(), imageName, arch);
    } catch (err) {
      await podmanDesktopApi.window.showErrorMessage(`Error pulling image: ${err}`);
      console.error('Error pulling image: ', err);
      throw new Error(`Error pulling image: ${err}`);
    } finally {
      // Notify the frontend the images list may have changed
      await this.notify(Messages.MSG_IMAGE_UPDATE, {});
    }
  }

  // Log an event to telemetry
  async telemetryLogUsage(eventName: string, data?: Record<string, unknown>): Promise<void> {
    telemetryLogger.logUsage(eventName, data);
  }

  // Log an error to telemetry
  async telemetryLogError(eventName: string, data?: Record<string, unknown>): Promise<void> {
    telemetryLogger.logError(eventName, data);
  }

  async isLinux(): Promise<boolean> {
    return isLinux();
  }

  async isMac(): Promise<boolean> {
    return isMac();
  }

  async isWindows(): Promise<boolean> {
    return isWindows();
  }

  async getArch(): Promise<string> {
    return getArch();
  }

  async getUidGid(): Promise<string> {
    return getUidGid();
  }

  async loadLogsFromFolder(folder: string): Promise<string> {
    // Combine folder name  and image-build.log
    const filePath = path.join(folder, 'image-build.log');

    // Simply try to the read the file and return the contents, must use utf8 formatting
    // to ensure the file is read properly / no ascii characters.
    return fs.readFileSync(filePath, 'utf8');
  }

  // Get configuration values from Podman Desktop
  // specifically we do this so we can obtain the setting for terminal font size
  // returns "any" because the configuration values are not typed
  async getConfigurationValue(config: string, section: string): Promise<unknown> {
    try {
      return podmanDesktopApi.configuration.getConfiguration(config).get(section);
    } catch (err) {
      console.error('Error getting configuration, will return undefined: ', err);
    }
    return undefined;
  }

  // Read from the podman desktop clipboard
  async readFromClipboard(): Promise<string> {
    return podmanDesktopApi.env.clipboard.readText();
  }

  // The API does not allow callbacks through the RPC, so instead
  // we send "notify" messages to the frontend to trigger a refresh
  // this method is internal and meant to be used by the API implementation
  protected async notify(id: string, body: unknown = {}): Promise<void> {
    // Must pass in an empty body, if it is undefined this fails
    await this.webview.postMessage({
      id,
      body,
    });
  }
}
