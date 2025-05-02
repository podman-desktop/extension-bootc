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
import { BootcApi } from '../BootcAPI';
import { getChannel } from './utils';

export const noTimeoutChannels: string[] = [
  getChannel(BootcApi, 'launchVM'),
  getChannel(BootcApi, 'pullImage'),
  getChannel(BootcApi, 'selectOutputFolder'),
  getChannel(BootcApi, 'selectBuildConfigFile'),
  getChannel(BootcApi, 'selectAnacondaKickstartFile'),
  getChannel(BootcApi, 'selectSSHPrivateKeyFile'),
  getChannel(BootcApi, 'selectVMImageFile'),
  getChannel(BootcApi, 'createVM'),
];
