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

import type { ContainerCreateOptions } from '@podman-desktop/api';
import * as extensionApi from '@podman-desktop/api';
import * as fs from 'node:fs';
import path, { resolve } from 'node:path';
import os from 'node:os';
import * as containerUtils from './container-utils';
import { imageBuilder, imageBuilderDefault, imageBuilderRHEL9, imageBuilderRHEL10 } from './constants';
import type { BootcBuildInfo, BuildConfig, BuildType } from '/@shared/src/models/bootc';
import type { History } from './history';
import * as machineUtils from './machine-utils';
import { getConfigurationValue, telemetryLogger } from './extension';
import { getContainerEngine } from './container-utils';

const OUTPUT_FILENAMES: Record<BuildType, string> = {
  qcow2: 'disk.qcow2',
  ami: 'image.raw',
  raw: 'disk.raw',
  vmdk: 'disk.vmdk',
  vhd: 'disk.vhd',
  gce: 'image.tar.gz',
};

export async function buildExists(folder: string, types: BuildType[]): Promise<boolean> {
  for (const type of types) {
    const imageName = OUTPUT_FILENAMES[type] ?? '';
    if (!imageName) {
      continue;
    }
    if (fs.existsSync(resolve(folder, imageName))) {
      return true;
    }
  }
  return false;
}

export async function buildDiskImage(build: BootcBuildInfo, history: History, overwrite?: boolean): Promise<void> {
  const connection = await getContainerEngine();
  const prereqs = await machineUtils.checkPrereqs(connection);
  if (prereqs) {
    await extensionApi.window.showErrorMessage(prereqs);
    throw new Error(prereqs);
  }

  const requiredFields = [
    { field: 'id', message: 'Bootc image id is required.' },
    { field: 'tag', message: 'Bootc image tag is required.' },
    { field: 'type', message: 'Bootc image type is required.' },
    { field: 'engineId', message: 'Bootc image engineId is required.' },
    { field: 'folder', message: 'Bootc image folder is required.' },
    { field: 'arch', message: 'Bootc image architecture is required.' },
  ];

  // VALIDATION CHECKS
  for (const { field, message } of requiredFields) {
    if (!build[field as keyof BootcBuildInfo]) {
      await extensionApi.window.showErrorMessage(message);
      throw new Error(message);
    }
  }

  // If one of awsAmiName, awsBucket, or awsRegion is defined, all three must be defined
  if (
    (build.awsAmiName && !build.awsBucket) ??
    (!build.awsAmiName && build.awsBucket) ??
    (!build.awsAmiName && build.awsBucket && build.awsRegion)
  ) {
    const response = 'If you are using AWS, you must provide an AMI name, bucket, and region.';
    await extensionApi.window.showErrorMessage(response);
    throw new Error(response);
  }

  // Use build.type to check for existing files
  if (
    !overwrite &&
    (await buildExists(build.folder, build.type)) &&
    (await extensionApi.window.showWarningMessage('File already exists, do you want to overwrite?', 'Yes', 'No')) ===
      'No'
  ) {
    return;
  }

  // Add the 'history' information before we start the build
  // this will be improved in the future to add more information
  build.status = 'creating';
  await history.addOrUpdateBuildInfo(build);

  // Store the build information for telemetry
  const telemetryData: Record<string, unknown> = {};

  // remove paths, user info, and other potentially identifiable info
  const buildInfo = structuredClone(build);
  buildInfo.image = 'image';
  if (buildInfo.buildConfig) {
    if (buildInfo.buildConfig.user) {
      buildInfo.buildConfig.user = [];
    }
    buildInfo.buildConfig.filesystem = undefined;
  }
  buildInfo.awsBucket = undefined;
  buildInfo.awsAmiName = undefined;
  if (buildInfo.buildConfigFilePath) {
    buildInfo.buildConfigFilePath = 'user-path';
  }
  if (buildInfo.chown) {
    buildInfo.chown = 'chown';
  }
  buildInfo.folder = 'folder';
  telemetryData.build = buildInfo;

  // Kick off task using withProgress to build in the background
  let errorMessage: string;
  extensionApi.window
    .withProgress(
      { location: extensionApi.ProgressLocation.TASK_WIDGET, title: `Building disk image ${build.image}` },
      async progress => {
        const buildContainerName = build.image.split('/').pop() + '-' + imageBuilder;
        let successful: boolean = false;
        let logData: string = 'Build Image Log ----------\n';
        logData += 'ID:     ' + build.id + '\n';
        logData += 'Image:  ' + build.image + '\n';
        logData += 'Type:   ' + build.type + '\n';
        logData += 'Folder: ' + build.folder + '\n';
        logData += '----------\n';

        // Create log folder
        if (!fs.existsSync(build.folder)) {
          await fs.promises.mkdir(build.folder, { recursive: true });
        }
        const logPath = resolve(build.folder, 'image-build.log');
        if (fs.existsSync(logPath)) {
          fs.unlinkSync(logPath);
        }

        const builder = await getBuilder();

        // Create the image-builder container options for the build.
        const containerName = await getUnusedName(buildContainerName);
        const buildImageContainer = createBuilderImageOptions(containerName, build, builder);
        logData += JSON.stringify(buildImageContainer, undefined, 2);
        logData += '\n----------\n';
        // Output new line with `\` added at end for each in the array.
        logData += createPodmanCLIRunCommand(buildImageContainer).join(' \\\n');
        logData += '\n----------\n';
        try {
          await fs.promises.writeFile(logPath, logData);
        } catch (e) {
          console.debug('Could not write bootc build log: ', e);
        }

        if (!buildImageContainer) {
          await extensionApi.window.showErrorMessage('Error creating container options.');
          return;
        }
        try {
          /* LINUX BUILD SUPPORT
           * Linux uses the CLI directly to avoid podman machine.
           * We transfer the non-root image to the root storage, then run
           * image-builder via podman with escalated privileges.
           */
          if (machineUtils.isLinux()) {
            console.log(
              'Linux OS detected. Using Linux build support to build the image. This will include escalated privileges / asking for password.',
            );

            // Set as 'running' before we start the build.
            build.status = 'running';
            await history.addOrUpdateBuildInfo(build);

            // Create random name for the image to be imported as.
            // of the id of the image + a random number and .tar
            // must create a random one each time to avoid conflicts when transfering.
            const imagePath = path.join(
              '/tmp',
              // eslint-disable-next-line sonarjs/pseudo-random
              `${build.imageId.replace('sha256:', '')}-${Math.floor(Math.random() * 100000)}.tar`,
            );

            // Step 1. Save the image to a tar file on the hosts /tmp/ directory.
            console.log('Linux build support: Exporting image to: ', imagePath);
            // Note: It is **VERY** important that we save it based upon the ID and NOT the name, or else it may
            // use the image that is based upon a different OS (ex. amd64, vs arm64), or even the manifest "root" image,
            //  so instead we will save and transfer based on imageID.
            // Trying the built-in save functionality of the PD API does not work correctly at the moment with saving image ID's.
            const {
              command: saveCommand,
              stdout: saveStdout,
              stderr: saveStderr,
            } = await extensionApi.process.exec('podman', ['save', '-o', imagePath, build.imageId]);
            console.log(
              `Linux build support: Save command: ${saveCommand}\nstdout: ${saveStdout}\nstderr: ${saveStderr}`,
            );
            // No 'safe' way to report information at the moment, so we will just increment by 50% as it's done
            // in two steps anyways. We cannot get a callback of the progress of the exec command yet.
            progress.report({ increment: 50 });

            // Step 2. Run the command to import and build the image in one command.
            const command = linuxBuildCommand(buildImageContainer, build, logPath, imagePath);
            console.log('Linux build support: Running command: ', command);
            const {
              command: buildCommand,
              stdout: buildStdout,
              stderr: buildStderr,
            } = await extensionApi.process.exec('sh', ['-c', `${command}`], { isAdmin: true });
            console.log(
              `Linux build support: Build command: ${buildCommand}\nstdout: ${buildStdout}\nstderr: ${buildStderr}`,
            );
          } else {
            // Step 1. Pull the image-builder container image.
            progress.report({ increment: 4 });
            if (buildImageContainer.Image) {
              await containerUtils.pullImage(connection, buildImageContainer.Image);
            } else {
              throw new Error('No image to pull');
            }

            // Step 2. Check if there are any previous builds and remove them
            progress.report({ increment: 5 });
            if (buildImageContainer.name) {
              await containerUtils.removeContainerIfExists(build.engineId, buildImageContainer.name);
            } else {
              throw new Error('No container name to remove');
            }

            // Step 3. Create and start the container for the actual build
            progress.report({ increment: 6 });
            build.status = 'running';
            await history.addOrUpdateBuildInfo(build);
            const containerId = await containerUtils.createAndStartContainer(build.engineId, buildImageContainer);

            // Update the history with the container id that was used to build the image
            build.buildContainerId = containerId;
            await history.addOrUpdateBuildInfo(build);

            // Step 3.1 Since we have started the container, we can now go get the logs
            await logContainer(build.engineId, containerId, progress, data => {
              // update the log file asyncronously
              fs.promises.appendFile(logPath, data).catch((error: unknown) => {
                console.debug('Could not write bootc build log: ', error);
              });
            });

            // Step 4. Wait for the container to exit
            // This function will ensure it exits with a zero exit code
            // if it does not, it will error out.
            progress.report({ increment: 7 });

            try {
              await containerUtils.waitForContainerToExit(containerId);
            } catch (error) {
              // If we error out, BUT the container does not exist in the history, we will silently error
              // as it's possible that the container was removed by the user during the build cycle / deleted from history.

              // Check if history has an entry with a containerId
              const historyExists = history.getHistory().some(info => info.buildContainerId === containerId);
              if (!historyExists) {
                console.error(
                  `Container ${build.buildContainerId} for build ${build.image}:${build.arch} has errored out, but there is no container history. This is likely due to the container being removed intentionally during the build cycle. Ignore this. Error: ${error}`,
                );
                return;
              } else {
                throw error;
              }
            }
          }

          // If we get here, the container has exited with a zero exit code
          // it's successful as well so we will write the log file
          successful = true;
          telemetryData.success = true;
        } catch (error: unknown) {
          errorMessage = (error as Error).message;
          console.error(error);
          telemetryData.error = error;

          // Append the error to the file as well for debugging purposes, but do not worry if it fails / errors out the build.
          await fs.promises.appendFile(logPath, errorMessage).catch((error: unknown) => {
            console.debug('Could not write error to bootc build log: ', error);
          });
        } finally {
          // ###########
          // # CLEANUP #
          // ###########
          // Regardless what happens, we will need to clean up what we started (if anything)
          // which could be containers, volumes, images, etc.

          // Only do this on mac or windows, as linux uses the CLI directly and with --rm so no need to remove container / volumes after.
          if (buildImageContainer.name && !machineUtils.isLinux()) {
            await containerUtils.removeContainerAndVolumes(build.engineId, buildImageContainer.name);
          }
        }

        // Mark the task as completed
        progress.report({ increment: 100 });
        telemetryLogger.logUsage('buildDiskImage', telemetryData);

        try {
          // Update the image build status
          build.status = successful ? 'success' : 'error';
          await history.addOrUpdateBuildInfo(build);
        } catch (e) {
          // If for any reason there is an error.. (example, unable to write to history file)
          // we do not want to stop the notification to the user, so
          // just output this to console and continue.
          console.error('Error updating image build status', e);
        }
        if (!successful) {
          if (!errorMessage.endsWith('.')) {
            errorMessage += '.';
          }
          throw new Error(errorMessage);
        }
      },
    )
    .then(async () => {
      if (build.status === 'success') {
        // Notify the user that the image has been built successfully
        await extensionApi.window.showInformationMessage(
          `Success! A disk image derived from your bootable container has been succesfully created in ${build.folder}`,
          'OK',
        );
      } else {
        // Notify on an error
        const logPath = resolve(build.folder, 'image-build.log');
        await extensionApi.window.showErrorMessage(
          `There was an error building the image: ${errorMessage} Check logs at ${logPath}`,
          'OK',
        );
      }
    })
    .catch((e: unknown) => console.error('error building disk image', e));
}

async function logContainer(
  engineId: string,
  containerId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  progress: any,
  callback: (data: string) => void,
): Promise<void> {
  await extensionApi.containerEngine.logsContainer(engineId, containerId, (_name: string, data: string) => {
    if (data) {
      callback(data);
      // look for specific output to mark incremental progress
      if (data.includes('org.osbuild.rpm')) {
        progress.report({ increment: 8 });
      } else if (data.includes('org.osbuild.selinux')) {
        progress.report({ increment: 25 });
      } else if (data.includes('org.osbuild.ostree.config')) {
        progress.report({ increment: 48 });
      } else if (data.includes('org.osbuild.qemu')) {
        progress.report({ increment: 59 });
      } else if (data.includes('Build complete!')) {
        progress.report({ increment: 98 });
      }
    }
  });
}

// find an unused container name
export async function getUnusedName(name: string): Promise<string> {
  let containers: string[] = [];
  try {
    // get a list of all existing container names, which may start with /
    containers = (await extensionApi.containerEngine.listContainers())
      .map(c => c.Names)
      .reduce((a, val) => [...a, ...val], [])
      .map(n => (n.startsWith('/') ? n.substring(1) : n));
  } catch (e) {
    console.warn('Could not get existing container names');
    console.warn(e);
  }

  let unusedName = name;
  let count = 2;
  while (containers.includes(unusedName)) {
    unusedName = name + '-' + count++;
  }
  return unusedName;
}

export async function getBuilder(): Promise<string> {
  const buildProp = await getConfigurationValue<string>('builder');

  if (buildProp === 'RHEL' || buildProp === 'RHEL9') {
    return imageBuilderRHEL9;
  } else if (buildProp === 'RHEL10') {
    return imageBuilderRHEL10;
  }

  return imageBuilderDefault;
}

// Builds the shared flags for each image-builder invocation.
export function buildImageBuilderFlags(build: BootcBuildInfo): string[] {
  const flags = [
    '--bootc-ref',
    `${build.image}:${build.tag}`,
    '--output-dir',
    '/output/',
    '--output-name',
    'disk',
    '--progress',
    'verbose',
  ];

  if (build.arch) {
    const archMap: Record<string, string> = { arm64: 'aarch64', amd64: 'x86_64' };
    flags.push('--arch', archMap[build.arch] ?? build.arch);
  }

  if (build.filesystem && (build.filesystem === 'ext4' || build.filesystem === 'xfs' || build.filesystem === 'btrfs')) {
    flags.push('--bootc-default-fs', build.filesystem);
  }

  if (build.awsAmiName && build.awsBucket && build.awsRegion) {
    flags.push('--aws-ami-name', build.awsAmiName, '--aws-bucket', build.awsBucket, '--aws-region', build.awsRegion);
  }

  return flags;
}

export function createBuilderImageOptions(
  name: string,
  build: BootcBuildInfo,
  builder?: string,
): ContainerCreateOptions {
  const flags = buildImageBuilderFlags(build);

  const binds = [build.folder + ':/output/', '/var/lib/containers/storage:/var/lib/containers/storage'];

  if (build.awsAmiName && build.awsBucket && build.awsRegion) {
    binds.push(path.join(os.homedir(), '.aws') + ':/root/.aws:ro');
  }

  // Mount user-provided blueprint file
  if (build.buildConfigFilePath) {
    const ext = path.extname(build.buildConfigFilePath);
    binds.push(build.buildConfigFilePath + `:/config${ext}:ro`);
    flags.push('--blueprint', `/config${ext}`);
  }

  // Generate blueprint JSON from interactive build config
  if (build.buildConfig && !build.buildConfigFilePath) {
    const buildConfig = createBuildConfigJSON(build.buildConfig);

    if (buildConfig.customizations && Object.keys(buildConfig.customizations).length > 0) {
      const buildConfigPath = path.join(build.folder, 'config.json');
      fs.writeFileSync(buildConfigPath, JSON.stringify(buildConfig, undefined, 2));
      binds.push(buildConfigPath + ':/config.json:ro');
      flags.push('--blueprint', '/config.json');
    }
  }

  const cmd = ['build', ...flags, build.type[0]];

  const options: ContainerCreateOptions = {
    name: name,
    Image: builder ?? imageBuilderDefault,
    Tty: true,
    HostConfig: {
      Privileged: true,
      SecurityOpt: ['label=type:unconfined_t'],
      Binds: binds,
    },
    Labels: {
      'bootc.image.builder': 'true',
    },
    Cmd: cmd,
  };

  return options;
}

// Converts BuildConfig into the blueprint customizations JSON structure.
export function createBuildConfigJSON(buildConfig: BuildConfig): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  if (buildConfig.user && buildConfig.user.length > 0) {
    config.user = buildConfig.user;
  }

  if (buildConfig.filesystem && buildConfig.filesystem.length > 0) {
    config.filesystem = buildConfig.filesystem;
  }

  if (buildConfig.kernel?.append) {
    config.kernel = buildConfig.kernel;
  }

  return { customizations: config };
}

// Builds the full Linux shell command: import image, run the build, apply chown, log output.
export function linuxBuildCommand(
  options: ContainerCreateOptions,
  build: BootcBuildInfo,
  logPath: string,
  imagePath: string,
): string {
  if (!options.name) {
    throw new Error('Container name is required');
  }

  const transferToRoot = transferUserImageToRoot(imagePath, build.imageId, build.image, build.tag);
  const run = createPodmanCLIRunCommand(options);

  // Chain commands in a single sudo session to avoid multiple credential prompts.
  let command = `${transferToRoot} && ${run.join(' ')} >> ${logPath} 2>&1`;

  // image-builder has no --chown flag; apply ownership change as a post-build step.
  if (build.chown) {
    command += ` && chown -R ${build.chown} ${build.folder}`;
  }

  return command;
}

// Transfers the image from the normal user's storage to root storage.
export function transferUserImageToRoot(path: string, imageId: string, imageName: string, imageTag: string): string {
  imageId = imageId.replace('sha256:', '');
  return `podman load --input ${path} && podman tag ${imageId} ${imageName}:${imageTag}`;
}

// Generates the `podman run` CLI command from ContainerCreateOptions.
export function createPodmanCLIRunCommand(options: ContainerCreateOptions): string[] {
  // --rm to make it temporary.
  const command = ['podman', 'run', '--rm'];

  if (options.name) {
    command.push('--name', options.name);
  }

  if (options.Tty) {
    command.push('--tty');
  }

  if (options.HostConfig?.Privileged) {
    command.push('--privileged');
  }

  if (options.HostConfig?.SecurityOpt) {
    options.HostConfig.SecurityOpt.forEach(opt => {
      command.push('--security-opt', opt);
    });
  }

  if (options.HostConfig?.Binds) {
    options.HostConfig.Binds.forEach(bind => {
      command.push('-v', bind);
    });
  }

  if (options.Labels) {
    for (const [key, value] of Object.entries(options.Labels)) {
      command.push('--label', `${key}=${value}`);
    }
  }

  if (options.Image) {
    command.push(options.Image);
  }

  if (options.Cmd) {
    options.Cmd.forEach(cmd => {
      command.push(cmd);
    });
  }

  return command;
}
