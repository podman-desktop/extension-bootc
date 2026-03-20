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

import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { markTestFileComplete } from './extension-lifecycle.js';

/**
 * Playwright reporter that keeps the extension-lifecycle counter accurate
 * when entire spec files are skipped.
 *
 * When every test in a file has status "skipped", the file's afterAll hooks
 * never execute, so the counter is never decremented for that file.  This
 * reporter detects fully-skipped files and decrements on their behalf,
 * ensuring the last *running* file correctly triggers extension cleanup.
 *
 * Relies on workers: 1 so files are processed sequentially.
 */
class ExtensionLifecycleReporter implements Reporter {
  private currentFile = '';
  private currentFileFullySkipped = true;

  onTestEnd(test: TestCase, result: TestResult): void {
    const file = test.location.file;

    if (file !== this.currentFile) {
      this.decrementIfFullySkipped();
      this.currentFile = file;
      this.currentFileFullySkipped = true;
    }

    if (result.status !== 'skipped') {
      this.currentFileFullySkipped = false;
    }
  }

  onEnd(_result: FullResult): void {
    this.decrementIfFullySkipped();
  }

  private decrementIfFullySkipped(): void {
    if (this.currentFile && this.currentFileFullySkipped) {
      console.log(
        `[ExtensionLifecycleReporter] All tests skipped in ${this.currentFile} — decrementing lifecycle counter`,
      );
      markTestFileComplete();
    }
    this.currentFile = '';
  }
}

export default ExtensionLifecycleReporter;
