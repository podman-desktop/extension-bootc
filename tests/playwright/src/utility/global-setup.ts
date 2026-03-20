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

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initExtensionLifecycle } from './extension-lifecycle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function globalSetup(): void {
  const srcDir = join(__dirname, '..');
  const specFiles = readdirSync(srcDir).filter(f => f.endsWith('.spec.ts'));
  console.log(`[globalSetup] Found ${specFiles.length} spec files — extension will be removed after the last one`);
  initExtensionLifecycle(specFiles.length);
}
