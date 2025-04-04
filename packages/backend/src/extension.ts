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

import type { ExtensionContext } from '@podman-desktop/api';
import * as extensionApi from '@podman-desktop/api';
import { History } from './history';
import fs from 'node:fs';
import { RpcExtension } from '/@shared/src/messages/MessageProxy';
import { BootcApiImpl } from './api-impl';
import { HistoryNotifier } from './history/historyNotifier';
import { Messages } from '/@shared/src/messages/Messages';
import { satisfies, minVersion, coerce } from 'semver';
import { engines } from '../package.json';

export const telemetryLogger = extensionApi.env.createTelemetryLogger();

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  console.log('starting bootc extension');

  // Ensure version is above the minimum Podman Desktop version required
  const version = extensionApi.version ?? 'unknown';
  if (!checkVersion(version)) {
    const min = minVersion(engines['podman-desktop']);
    telemetryLogger.logError('start.incompatible', {
      version: version,
      message: `error activating extension on version below ${min?.version}`,
    });
    throw new Error(
      `Extension is not compatible with Podman Desktop version below ${min?.version} (Current ${version}).`,
    );
  }

  telemetryLogger.logUsage('start');

  await fs.promises.mkdir(extensionContext.storagePath, { recursive: true });
  const history = new History(extensionContext.storagePath);
  await history.loadFile();

  const panel = extensionApi.window.createWebviewPanel('bootc', 'Bootable Containers', {
    localResourceRoots: [extensionApi.Uri.joinPath(extensionContext.extensionUri, 'media')],
  });
  extensionContext.subscriptions.push(panel);

  const indexHtmlUri = extensionApi.Uri.joinPath(extensionContext.extensionUri, 'media', 'index.html');
  const indexHtmlPath = indexHtmlUri.fsPath;
  let indexHtml = await fs.promises.readFile(indexHtmlPath, 'utf8');

  // replace links with webView Uri links
  // in the content <script type="module" crossorigin src="./index-RKnfBG18.js"></script> replace src with webview.asWebviewUri
  // eslint-disable-next-line sonarjs/slow-regex
  const scriptLink = indexHtml.match(/<script.*?src="(.*?)".*?>/g);
  if (scriptLink) {
    const regEx: RegExp = RegExp(/src="(.*?)"/);
    scriptLink.forEach(link => {
      const src = regEx.exec(link);
      if (src) {
        const webviewSrc = panel.webview.asWebviewUri(
          extensionApi.Uri.joinPath(extensionContext.extensionUri, 'media', src[1]),
        );
        indexHtml = indexHtml.replace(src[1], webviewSrc.toString());
      }
    });
  }

  // and now replace for css file as well
  // eslint-disable-next-line sonarjs/slow-regex
  const cssLink = indexHtml.match(/<link.*?href="(.*?)".*?>/g);
  if (cssLink) {
    const regEx: RegExp = RegExp(/href="(.*?)"/);
    cssLink.forEach(link => {
      const href = regEx.exec(link);
      if (href) {
        const webviewHref = panel.webview.asWebviewUri(
          extensionApi.Uri.joinPath(extensionContext.extensionUri, 'media', href[1]),
        );
        indexHtml = indexHtml.replace(href[1], webviewHref.toString());
      }
    });
  }

  // Update the html
  panel.webview.html = indexHtml;

  // Register the 'api' for the webview to communicate to the backend
  const rpcExtension = new RpcExtension(panel.webview);
  rpcExtension.init();
  extensionContext.subscriptions.push(rpcExtension);

  const bootcApi = new BootcApiImpl(extensionContext, panel.webview);
  rpcExtension.registerInstance<BootcApiImpl>(BootcApiImpl, bootcApi);

  // Create the historyNotifier and push to subscriptions
  // so the frontend can be notified when the history changes and so we can update the UI / call listHistoryInfo
  const historyNotifier = new HistoryNotifier(panel.webview, extensionContext.storagePath);
  extensionContext.subscriptions.push(historyNotifier);

  extensionContext.subscriptions.push(
    extensionApi.commands.registerCommand('bootc.image.build', async image => {
      await openBuildPage(panel, image);
    }),
  );
}

function checkVersion(version: string): boolean {
  if (!version) {
    return false;
  }

  const current = coerce(version);
  if (!current) {
    return false;
  }

  return satisfies(current, engines['podman-desktop']);
}

export async function openBuildPage(
  panel: extensionApi.WebviewPanel,
  image: { name: string; tag: string },
): Promise<void> {
  // this should use webview reveal function in the future
  const webviews = extensionApi.window.listWebviews();
  const bootcWebView = (await webviews).find(webview => webview.viewType === 'bootc');

  if (!bootcWebView) {
    console.error('Could not find bootc webview');
    return;
  }

  await extensionApi.navigation.navigateToWebview(bootcWebView.id);

  // if we trigger immediately, the webview hasn't loaded yet and can't redirect
  // if we trigger too slow, there's a visible flash as the homepage appears first
  await new Promise(r => setTimeout(r, 100));

  await panel.webview.postMessage({
    id: Messages.MSG_NAVIGATE_BUILD,
    body: encodeURIComponent(image.name) + '/' + encodeURIComponent(image.tag),
  });
}

export async function getConfigurationValue<T>(property: string): Promise<T | undefined> {
  return extensionApi.configuration.getConfiguration('bootc').get<T>(property);
}

export async function deactivate(): Promise<void> {
  console.log('stopping bootc extension');
}
