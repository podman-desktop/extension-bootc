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
    try {
      // Before going forward, make sure that the path names for both imagePath and sshIdentityPath are the full
      // paths (not using ~/). This is important since the macadam library does not handle this case.
      if (options.sshIdentityPath) {
        options.sshIdentityPath = options.sshIdentityPath.replace(/^~\//, `${process.env.HOME}/`);
      }
      options.imagePath = options.imagePath.replace(/^~\//, `${process.env.HOME}/`);

      await this.macadam.init();
      await this.macadam.createVm(options);
    } catch (e) {
      // Use this below since createVm returns stderr in the error object as well. This comes in handy when
      // the VM creation fails due to a missing image or other issues.
      let errorMessage: string;
      if (e instanceof Error) {
        const stderrError = e as StderrError;
        errorMessage = `${stderrError.message} ${stderrError.stderr ?? ''}`;
      } else {
        errorMessage = String(e);
      }
      console.error('Failed to create VM:', errorMessage);
      throw new Error(`VM creation failed: ${errorMessage}`);
    }
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
