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

import { derived, writable, type Readable } from 'svelte/store';
import { Messages } from '/@shared/src/messages/Messages';
import { bootcClient } from '/@/api/client';
import type { BootcBuildInfo } from '/@shared/src/models/bootc';
import { RPCReadable } from '/@/stores/rpcReadable';
import { findMatchInLeaves } from '../lib/upstream/search-util';

export const historyInfo: Readable<BootcBuildInfo[]> = RPCReadable<BootcBuildInfo[]>(
  [],
  [Messages.MSG_HISTORY_UPDATE],
  bootcClient.listHistoryInfo,
);

// For searching
export const searchPattern = writable('');

export const filtered = derived([searchPattern, historyInfo], ([$searchPattern, $historyInfo]) =>
  $historyInfo.filter(historyInfo => findMatchInLeaves(historyInfo, $searchPattern.toLowerCase())),
);
