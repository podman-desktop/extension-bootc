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

import type * as extensionApi from '@podman-desktop/api';

import { BaseCheck } from '../base-check';
import { getPowerShellClient } from './powershell';
import { isPodmanDesktopElevated, isUserAdmin } from './utils';

async function isHyperVInstalled(): Promise<boolean> {
  const client = await getPowerShellClient();
  return client.isHyperVInstalled();
}

async function isHyperVRunning(): Promise<boolean> {
  const client = await getPowerShellClient();
  return client.isHyperVRunning();
}

export class HyperVCheck extends BaseCheck {
  title = 'Hyper-V installed';
  static readonly PODMAN_MINIMUM_VERSION_FOR_HYPERV = '5.2.0';

  constructor() {
    super();
  }

  async execute(): Promise<extensionApi.CheckResult> {
    if (!(await isUserAdmin())) {
      return this.createFailureResult({
        description: 'You must have administrative rights to run Hyper-V Podman machines',
        docLinksDescription: 'Contact your Administrator to setup Hyper-V.',
        docLinks: {
          url: 'https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v',
          title: 'Hyper-V Manual Installation Steps',
        },
      });
    }
    if (!(await isPodmanDesktopElevated())) {
      return this.createFailureResult({
        description: 'You must run Podman Desktop with administrative rights to run Hyper-V Podman machines.',
      });
    }
    if (!(await isHyperVInstalled())) {
      return this.createFailureResult({
        description: 'Hyper-V is not installed on your system.',
        docLinksDescription: 'call DISM /Online /Enable-Feature /All /FeatureName:Microsoft-Hyper-V in a terminal',
        docLinks: {
          url: 'https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v',
          title: 'Hyper-V Manual Installation Steps',
        },
      });
    }
    if (!(await isHyperVRunning())) {
      return this.createFailureResult({
        description: 'Hyper-V is not running on your system.',
        docLinksDescription: 'call sc start vmms in a terminal',
        docLinks: {
          url: 'https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v',
          title: 'Hyper-V Manual Installation Steps',
        },
      });
    }
    return this.createSuccessfulResult();
  }
}
