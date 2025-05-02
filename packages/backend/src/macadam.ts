/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import * as macadam from '@crc-org/macadam.js';
import { macadamName } from './constants';
import { telemetryLogger } from './extension';
import * as extensionApi from '@podman-desktop/api';

interface StderrError extends Error {
  stderr?: string;
}
export class MacadamHandler {
  private macadam: macadam.Macadam;

  constructor() {
    // IMPORTANT NOTE
    // In order for this to work with the RHEL VM extension, you must use 'rhel' as the macadam name.
    // This is the given "type" and will only appear within Settings > Resources if it's prefixed with rhel.
    this.macadam = new macadam.Macadam(macadamName);
  }

  async createVm(options: macadam.CreateVmOptions): Promise<void> {
    // Store information for telemetry, starting with the type
    const telemetryData: Record<string, unknown> = {};
    telemetryData.type = options.imagePath.substring(options.imagePath.lastIndexOf('.') + 1);

    await extensionApi.window
      .withProgress(
        { location: extensionApi.ProgressLocation.TASK_WIDGET, title: `Creating Virtual Machine ${options.name}` },
        async progress => {
          // Before going forward, make sure that the path names for both imagePath and sshIdentityPath are the full
          // paths (not using ~/). This is important since the macadam library does not handle this case.
          if (options.sshIdentityPath) {
            options.sshIdentityPath = options.sshIdentityPath.replace(/^~\//, `${process.env.HOME}/`);
          }
          options.imagePath = options.imagePath.replace(/^~\//, `${process.env.HOME}/`);

          await this.macadam.init();
          progress.report({ increment: 10 });
          await this.macadam.createVm(options);
          telemetryData.success = true;
          progress.report({ increment: 100 });
        },
      )
      .catch((e: unknown) => {
        // Use this below since createVm returns stderr in the error object as well. This comes in handy when
        // the VM creation fails due to a missing image or other issues.
        let errorMessage: string;
        if (e instanceof Error) {
          const stderrError = e as StderrError;
          errorMessage = `${stderrError.message} ${stderrError.stderr ?? ''}`;
        } else {
          errorMessage = String(e);
        }
        telemetryData.error = errorMessage;
        console.error('Failed to create VM:', errorMessage);
        throw new Error(`VM creation failed: ${errorMessage}`);
      })
      .finally(() => {
        telemetryLogger.logUsage('createVM', telemetryData);
      });
  }

  // List all virtual machines.
  async listVms(): Promise<macadam.VmDetails[]> {
    try {
      await this.macadam.init();
      const vms = await this.macadam.listVms({});
      return vms;
    } catch (err) {
      console.error('Failed to list VMs:', err);
      throw new Error(`VM listing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
