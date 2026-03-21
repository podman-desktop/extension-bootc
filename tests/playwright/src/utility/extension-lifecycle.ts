/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const COUNTER_FILE = join(tmpdir(), 'bootc-e2e-extension-counter');
const completedFiles = new Set<string>();

export function initExtensionLifecycle(totalFiles: number): void {
  writeFileSync(COUNTER_FILE, String(totalFiles), 'utf-8');
}

/**
 * Decrements the remaining file counter exactly once per unique {@link fileId}.
 * Returns `true` when this is the last test file to complete, signalling that
 * extension cleanup should run.
 *
 * When a spec file iterates over multiple categories (architectures, types, etc.)
 * using `test.describe.serial`, Playwright may invoke the parent describe's
 * `afterAll` more than once for the same file. The in-memory Set prevents the
 * counter from being decremented more than once per spec file.
 *
 * If the counter file is missing (e.g. running a single spec directly without
 * globalSetup), returns `true` so the extension still gets cleaned up.
 */
export function markTestFileComplete(fileId: string): boolean {
  if (completedFiles.has(fileId)) {
    console.log(`[markTestFileComplete] '${fileId}' already counted — skipping decrement`);
    return false;
  }

  completedFiles.add(fileId);

  if (!existsSync(COUNTER_FILE)) return true;

  const remaining = parseInt(readFileSync(COUNTER_FILE, 'utf-8'), 10) - 1;
  if (remaining <= 0) {
    unlinkSync(COUNTER_FILE);
    return true;
  }

  writeFileSync(COUNTER_FILE, String(remaining), 'utf-8');
  return false;
}
