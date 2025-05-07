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

/* eslint-disable sonarjs/no-ignored-exceptions */
import * as extensionApi from '@podman-desktop/api';
import { compare } from 'compare-versions';

import { BaseCheck } from '../base-check';
import { isUserAdmin } from './utils';

export interface WSLVersionInfo {
  wslVersion?: string;
  kernelVersion?: string;
  windowsVersion?: string;
}

export class WslHelper {
  async getWSLVersionData(): Promise<WSLVersionInfo> {
    const { stdout } = await extensionApi.process.exec('wsl', ['--version'], { encoding: 'utf16le' });
    /*
      got something like
      WSL version: 1.2.5.0
      Kernel version: 5.15.90.1
      WSLg version: 1.0.51
      MSRDC version: 1.2.3770
      Direct3D version: 1.608.2-61064218
      DXCore version: 10.0.25131.1002-220531-1700.rs-onecore-base2-hyp
      Windows version: 10.0.22621.2134

      N.B: the label before the colon symbol changes based on the system language. In an italian system you would have

      Versione WSL: 1.2.5.0
      Versione kernel: 5.15.90.1
      ...
    */

    // split the output in lines
    const lines = normalizeWSLOutput(stdout).split('\n');

    // the first line should display the version of the wsl - WSL version: 1.2.5.0
    const wslVersion = getVersionFromWSLOutput(lines[0], 'wsl');

    // the second line should display the kernel version - Kernel version: 5.15.90.1
    const kernelVersion = getVersionFromWSLOutput(lines[1], 'kernel');

    // the last line should display the Windows version - Windows version: 10.0.22621.2134
    const windowsVersion = getVersionFromWSLOutput(lines[6], 'windows');

    return { wslVersion, kernelVersion, windowsVersion };
  }
}

/**
 * it extract the content after the colon which should be the version of the tool/system
 * @param line the content to analyze
 * @param value the tool/system to find the version for
 * @returns the content after the colon if the line belongs to the tool/system we are searching info for
 */
function getVersionFromWSLOutput(line: string, value: string): string | undefined {
  if (!line) {
    return undefined;
  }
  const colonPosition = indexOfColons(line);
  if (colonPosition >= 0 && line.substring(0, colonPosition).toLowerCase().includes(value)) {
    return line.substring(colonPosition + 1).trim();
  }
  return undefined;
}

/**
 * When using a non-latin language like chinese, WSL also uses a different value for the colon symbol
 * There are three colons:
 * symbol | name            | number
 * :      | vertical colon  | 58
 * ：     | fullwidth colon | 65306
 * ﹕     | small colon     | 65109
 * This function returns the position of the first colon symbol found in the string
 */
function indexOfColons(value: string): number {
  for (let i = 0; i < value.length; i++) {
    const codeChar = value.charCodeAt(i);
    if (codeChar === 58 || codeChar === 65306 || codeChar === 65109) {
      return i;
    }
  }
  return -1;
}

// this is workaround, wsl2 some time send output in utf16le, but we treat that as utf8,
// this code just eliminate every 'empty' character
/**
 * this function is a workaround to clean the output received by WSL2. Some time it sends output in utf16le, but we treat that as utf8,
 * this code just eliminate every 'empty' character
 * @param out the string to clean
 * @returns the string cleaned
 */
function normalizeWSLOutput(out: string): string {
  let str = '';
  for (let i = 0; i < out.length; i++) {
    if (out.charCodeAt(i) !== 0) {
      str += out.charAt(i);
    }
  }
  return str;
}

export class WSLVersionCheck extends BaseCheck {
  title = 'WSL Version';

  minVersion = '1.2.5';

  async execute(): Promise<extensionApi.CheckResult> {
    try {
      const wslHelper = new WslHelper();
      const wslVersionData = await wslHelper.getWSLVersionData();
      if (wslVersionData.wslVersion) {
        if (compare(wslVersionData.wslVersion, this.minVersion, '>=')) {
          return this.createSuccessfulResult();
        } else {
          return this.createFailureResult({
            description: `Your WSL version is ${wslVersionData.wslVersion} but it should be >= ${this.minVersion}.`,
            docLinksDescription: `Call 'wsl --update' to update your WSL installation. If you do not have access to the Windows store you can run 'wsl --update --web-download'. If you still receive an error please contact your IT administator as 'Windows Store Applications' may have been disabled.`,
          });
        }
      }
    } catch (err) {
      // ignore error
    }
    return this.createFailureResult({
      description: `WSL version should be >= ${this.minVersion}.`,
      docLinksDescription: `Call 'wsl --version' in a terminal to check your wsl version.`,
    });
  }
}

export class WSL2Check extends BaseCheck {
  title = 'WSL2 Installed';
  installWSLCommandId = 'podman.onboarding.installWSL';

  constructor(private extensionContext?: extensionApi.ExtensionContext) {
    super();
  }

  async init(): Promise<void> {
    if (this.extensionContext) {
      const wslCommand = extensionApi.commands.registerCommand(this.installWSLCommandId, async () => {
        const installSucceeded = await this.installWSL();
        if (installSucceeded) {
          // if action succeeded, do a re-check of all podman requirements so user can be moved forward if all missing pieces have been installed
          await extensionApi.commands.executeCommand('podman.onboarding.checkRequirementsCommand');
        }
      });
      this.extensionContext.subscriptions.push(wslCommand);
    }
  }

  async execute(): Promise<extensionApi.CheckResult> {
    try {
      const isAdmin = await isUserAdmin();
      const isWSL = await this.isWSLPresent();
      const isRebootNeeded = await this.isRebootNeeded();

      if (!isWSL) {
        if (isAdmin) {
          return this.createFailureResult({
            description: 'WSL2 is not installed.',
            docLinksDescription: `Call 'wsl --install --no-distribution' in a terminal.`,
            docLinks: {
              url: 'https://learn.microsoft.com/en-us/windows/wsl/install',
              title: 'WSL2 Manual Installation Steps',
            },
            fixCommand: {
              id: this.installWSLCommandId,
              title: 'Install WSL2',
            },
          });
        } else {
          return this.createFailureResult({
            description: 'WSL2 is not installed or you do not have permissions to run WSL2.',
            docLinksDescription: 'Contact your Administrator to setup WSL2.',
            docLinks: {
              url: 'https://learn.microsoft.com/en-us/windows/wsl/install',
              title: 'WSL2 Manual Installation Steps',
            },
          });
        }
      } else if (isRebootNeeded) {
        return this.createFailureResult({
          description:
            'WSL2 seems to be installed but the system needs to be restarted so the changes can take effect.',
          docLinksDescription: `If already restarted, call 'wsl --install --no-distribution' in a terminal.`,
          docLinks: {
            url: 'https://learn.microsoft.com/en-us/windows/wsl/install',
            title: 'WSL2 Manual Installation Steps',
          },
        });
      }
    } catch (err) {
      return this.createFailureResult({
        description: 'Could not detect WSL2',
        docLinks: {
          url: 'https://learn.microsoft.com/en-us/windows/wsl/install',
          title: 'WSL2 Manual Installation Steps',
        },
      });
    }

    return this.createSuccessfulResult();
  }

  private async isWSLPresent(): Promise<boolean> {
    try {
      const { stdout: res } = await extensionApi.process.exec('wsl', ['--set-default-version', '2'], {
        env: { WSL_UTF8: '1' },
      });
      const output = normalizeWSLOutput(res);
      return !!output;
    } catch (error) {
      return false;
    }
  }

  private async installWSL(): Promise<boolean> {
    try {
      await extensionApi.process.exec('wsl', ['--install', '--no-distribution'], {
        env: { WSL_UTF8: '1' },
      });

      return true;
    } catch (error) {
      const runError = error as extensionApi.RunError;
      let message = runError.message ? `${runError.message}\n` : '';
      message += runError.stdout || '';
      message += runError.stderr || '';
      throw new Error(message);
    }
  }

  private async isRebootNeeded(): Promise<boolean> {
    try {
      await extensionApi.process.exec('wsl', ['-l'], {
        env: { WSL_UTF8: '1' },
      });
    } catch (error) {
      // we only return true for the WSL_E_WSL_OPTIONAL_COMPONENT_REQUIRED error code
      // as other errors may not be connected to a reboot, like
      // WSL_E_DEFAULT_DISTRO_NOT_FOUND = wsl was installed without the default distro
      const runError = error as extensionApi.RunError;
      if (runError.stdout.includes('Wsl/WSL_E_WSL_OPTIONAL_COMPONENT_REQUIRED')) {
        return true;
      } else if (runError.stdout.includes('Wsl/WSL_E_DEFAULT_DISTRO_NOT_FOUND')) {
        // treating this log differently as we install wsl without any distro
        console.log('WSL has been installed without the default distribution');
      } else {
        console.error(error);
      }
    }
    return false;
  }
}
