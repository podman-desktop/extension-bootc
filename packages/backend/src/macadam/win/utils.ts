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

import * as extensionApi from '@podman-desktop/api';

import { SequenceCheck } from '../base-check';
import { HyperVCheck } from './hyperv-helper';
import { getPowerShellClient } from './powershell';
import { WSL2Check, WSLVersionCheck } from './wsl-helper';

export async function isWSLEnabled(): Promise<boolean> {
  if (!extensionApi.env.isWindows) {
    return false;
  }
  const wslCheck = new SequenceCheck('WSL platform', [new WSLVersionCheck(), new WSL2Check()]);
  const wslCheckResult = await wslCheck.execute();
  return wslCheckResult.successful;
}

export async function isHyperVEnabled(): Promise<boolean> {
  if (!extensionApi.env.isWindows) {
    return false;
  }
  const hyperVCheck = new HyperVCheck();
  const hyperVCheckResult = await hyperVCheck.execute();
  return hyperVCheckResult.successful;
}

export async function isUserAdmin(): Promise<boolean> {
  const client = await getPowerShellClient();
  return client.isUserAdmin();
}

export async function isPodmanDesktopElevated(): Promise<boolean> {
  const client = await getPowerShellClient();
  return client.isRunningElevated();
}
