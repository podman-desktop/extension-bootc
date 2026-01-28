/**********************************************************************
 * Copyright (C) 2024-2026 Red Hat, Inc.
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

import type { BootcBuildInfo, BuildType } from './models/bootc';
import type { ImageInfo, ImageInspectInfo, ManifestInspectInfo, ContainerInfo } from '@podman-desktop/api';
import type { ExamplesList } from './models/examples';
import type { CreateVmOptions, VmDetails } from '@crc-org/macadam.js';

export abstract class BootcApi {
  static readonly CHANNEL: string = 'BootcApi';
  abstract checkPrereqs(): Promise<string | undefined>;
  abstract checkVMLaunchPrereqs(buildId: string): Promise<string | undefined>;
  abstract launchVM(buildId: string): Promise<void>;
  abstract createVM(options: CreateVmOptions): Promise<void>;
  abstract listVMs(): Promise<VmDetails[]>;
  abstract buildExists(folder: string, types: BuildType[]): Promise<boolean>;
  abstract buildImage(build: BootcBuildInfo, overwrite?: boolean): Promise<void>;
  abstract pullImage(image: string, arch?: string): Promise<void>;
  abstract inspectImage(image: ImageInfo): Promise<ImageInspectInfo>;
  abstract inspectManifest(image: ImageInfo): Promise<ManifestInspectInfo>;
  abstract deleteBuilds(buildIds: string[]): Promise<void>;
  abstract selectOutputFolder(): Promise<string>;
  abstract selectBuildConfigFile(): Promise<string>;
  abstract selectVMImageFile(): Promise<string>;
  abstract selectSSHPrivateKeyFile(): Promise<string>;
  abstract selectAnacondaKickstartFile(): Promise<string>;
  abstract listBootcImages(): Promise<ImageInfo[]>;
  abstract listContainers(): Promise<ContainerInfo[]>;
  abstract listAllImages(): Promise<ImageInfo[]>;
  abstract deleteImage(engineId: string, id: string): Promise<void>;
  abstract listHistoryInfo(): Promise<BootcBuildInfo[]>;
  abstract openFolder(folder: string): Promise<boolean>;
  abstract generateUniqueBuildID(name: string): Promise<string>;
  abstract openLink(link: string): Promise<void>;
  abstract openResources(): Promise<void>;
  abstract openImage(id: string, engineId: string, tag: string): Promise<void>;
  abstract openImageBuild(): Promise<void>;
  abstract isLinux(): Promise<boolean>;
  abstract isMac(): Promise<boolean>;
  abstract isWindows(): Promise<boolean>;
  abstract getArch(): Promise<string>;
  abstract getUidGid(): Promise<string>;
  abstract getExamples(): Promise<ExamplesList>;
  abstract loadLogsFromFolder(folder: string): Promise<string>;
  abstract getConfigurationValue(config: string, section: string): Promise<unknown>;
  abstract readFromClipboard(): Promise<string>;
  abstract stopCurrentVM(): Promise<void>;
  abstract telemetryLogUsage(eventName: string, data?: Record<string, unknown> | undefined): Promise<void>;
  abstract telemetryLogError(eventName: string, data?: Record<string, unknown> | undefined): Promise<void>;
}
