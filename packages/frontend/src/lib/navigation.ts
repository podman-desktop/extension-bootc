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
import { router } from 'tinro';
import { bootcClient } from '../api/client';

export function goToDiskImages(): void {
  router.goto('/disk-images');
}

export async function gotoBuild(): Promise<void> {
  await bootcClient.telemetryLogUsage('nav-build');
  router.goto('/disk-images/build');
}

export async function gotoImage(id: string, engineId: string, tag: string): Promise<void> {
  await bootcClient.openImage(id, engineId, tag);
}

export async function gotoImageBuild(): Promise<void> {
  await bootcClient.telemetryLogUsage('nav-image-build');
  await bootcClient.openImageBuild();
}

export async function gotoDiskImageBuild(name: string, tag: string): Promise<void> {
  await bootcClient.telemetryLogUsage('nav-build');
  router.goto(`/disk-images/build/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

export async function gotoCreateVMForm(): Promise<void> {
  await bootcClient.telemetryLogUsage('nav-create-vm');
  router.goto('/disk-images/createVM');
}

export async function gotoCreateVM(image: string, path: string): Promise<void> {
  await bootcClient.telemetryLogUsage('nav-create-vm');
  router.goto(`/disk-images/createVM/${btoa(image)}/${btoa(path)}`);
}
