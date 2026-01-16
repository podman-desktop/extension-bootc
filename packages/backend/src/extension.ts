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
import { EventEmitter } from 'node:events';
import { RpcExtension } from '/@shared/src/messages/MessageProxy';
import { BootcApiImpl } from './api-impl';
import { HistoryNotifier } from './history/historyNotifier';
import { Messages } from '/@shared/src/messages/Messages';
import { satisfies, minVersion, coerce } from 'semver';
import { engines } from '../package.json';
import * as macadamJSPackage from '@crc-org/macadam.js';
import { isHyperVEnabled, isWSLEnabled } from './macadam/win/utils';
import { getErrorMessage, verifyContainerProivder } from './macadam/utils';
import { LoggerDelegator } from './macadam/logger';
import { ProviderConnectionShellAccessImpl } from './macadam/macadam-machine-stream';
import { macadamName } from './constants';
import { isWindows } from './machine-utils';

export const telemetryLogger = extensionApi.env.createTelemetryLogger();

const EXTENSION_DESCRIPTION_MARKDOWN = `Bootable container-based virtual machines run via Macadam`;

let stopLoop = false;

type StatusHandler = (name: string, event: extensionApi.ProviderConnectionStatus) => void;
const macadamMachinesInfo = new Map<string, MachineInfo>();
const currentConnections = new Map<string, extensionApi.Disposable>();

let wslAndHypervEnabledContextValue = false;
const WSL_HYPERV_ENABLED_KEY = 'macadam.wslHypervEnabled';

let macadamInitialized = false;

// Event emitter for macadam lifecycle events - separates initialization from monitoring
const macadamEvents = new EventEmitter();
const MACADAM_INITIALIZED_EVENT = 'initialized';

const listeners = new Set<StatusHandler>();

export interface BinaryInfo {
  path: string;
  version: string;
  installationSource: 'extension' | 'external';
}

export type MachineInfo = {
  name: string;
  image: string;
  cpus: number;
  memory: number;
  diskSize: number;
  port: number;
  remoteUsername: string;
  identityPath: string;
  vmType: string;
};

type MachineJSON = {
  Name: string;
  Image: string;
  CPUs: number;
  Memory: string;
  DiskSize: string;
  Running: boolean;
  Starting: boolean;
  Port: number;
  RemoteUsername: string;
  IdentityPath: string;
  VMType: string;
};

type MachineJSONListOutput = {
  list: MachineJSON[];
  error: string;
};

export let macadam: macadamJSPackage.Macadam;

export const macadamMachinesStatuses = new Map<string, extensionApi.ProviderConnectionStatus>();

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

  const bootcApi = new BootcApiImpl(extensionContext, telemetryLogger, panel.webview);
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

  if (!isWindows()) {
    macadam = new macadamJSPackage.Macadam(macadamName);

    const provider = await createProvider(extensionContext);

    // Register listener to start monitoring when macadam is initialized
    macadamEvents.on(MACADAM_INITIALIZED_EVENT, () => {
      monitorMachines(provider, extensionContext).catch((error: unknown) => {
        console.error('Error while monitoring machines', error);
      });
    });

    // Only initialize and start monitoring if macadam binary is already installed.
    // This avoids prompting for sudo on extension activation (macOS).
    // If not installed, init() will be called lazily when user performs a VM operation.
    if (macadam.areBinariesAvailable()) {
      try {
        await macadam.init();
        macadamInitialized = true;
      } catch (error) {
        console.error('Error initializing macadam', error);
      }

      macadamEvents.emit(MACADAM_INITIALIZED_EVENT);
    }
  }
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

// Ensures macadam is initialized before VM operations.
// This allows deferring the sudo prompt until the user actually tries to use VM features,
// rather than prompting on extension activation.
// Exported so MacadamHandler can trigger monitoring after VM creation.
// if you pass param checkForUpdates, it will ensure any updates are applied (ex. we want the most up to date when doing actions)
export async function ensureMacadamInitialized(checkForUpdates = false): Promise<void> {
  // If already initialized, optionally check for updates
  // this helps us in scenarios we don't care if we are on an old version (we are doing the machine json list calls),
  // but for operations like start/stop/create we want to ensure we have the latest binary
  if (macadamInitialized) {
    if (checkForUpdates) {
      await macadam.ensureBinariesUpToDate();
    }
    return;
  }

  // need to install/update binary (the method is an all-in-one anyways) and init
  await macadam.ensureBinariesUpToDate();

  try {
    await macadam.init();
    macadamInitialized = true;

    // Emit initialized event to trigger monitoring
    macadamEvents.emit(MACADAM_INITIALIZED_EVENT);
  } catch (error) {
    console.error('Error initializing macadam', error);
    throw error;
  }
}

async function getJSONMachineList(): Promise<MachineJSONListOutput> {
  const vmProviders: (string | undefined)[] = [];

  if (extensionApi.env.isWindows) {
    let hypervEnabled = false;
    let wslEnabled = false;
    if (await isWSLEnabled()) {
      wslEnabled = true;
      vmProviders.push('wsl');
    }

    if (await isHyperVEnabled()) {
      hypervEnabled = true;
      vmProviders.push('hyperv');
    }
    // update context "wsl-hyperv enabled" value
    updateWSLHyperVEnabledContextValue(wslEnabled && hypervEnabled);
  }

  if (extensionApi.env.isMac) {
    vmProviders.push('applehv');
  }

  if (vmProviders.length === 0) {
    // in all other cases we set undefined so that it executes normally by using the default vm provider
    vmProviders.push(undefined);
  }

  const list: MachineJSON[] = [];
  let error = '';

  try {
    for (const provider of vmProviders) {
      const machineListOutput = await getJSONMachineListByProvider(provider);
      list.push(...machineListOutput.list);
      if (machineListOutput.error && machineListOutput.error.trim() !== '') {
        error += machineListOutput.error + '\n';
      }
    }
  } catch (err) {
    error = getErrorMessage(err);
  }

  return { list, error };
}

export async function getJSONMachineListByProvider(vmProvider?: string): Promise<MachineJSONListOutput> {
  let stdout: macadamJSPackage.VmDetails[] = [];
  let stderr = '';
  try {
    await ensureMacadamInitialized();
    stdout = await macadam.listVms({ containerProvider: verifyContainerProivder(vmProvider ?? '') });
  } catch (err: unknown) {
    stderr = `${err}`;
  }
  return {
    list: stdout,
    error: stderr,
  };
}

async function startMachine(
  provider: extensionApi.Provider,
  machineInfo: MachineInfo,
  context?: extensionApi.LifecycleContext,
  logger?: extensionApi.Logger,
): Promise<void> {
  const telemetryRecords: Record<string, unknown> = {};
  telemetryRecords.provider = 'macadam';
  const startTime = performance.now();

  try {
    await ensureMacadamInitialized(true);
    await macadam.startVm({
      name: machineInfo.name,
      containerProvider: verifyContainerProivder(machineInfo.vmType),
      runOptions: { logger: new LoggerDelegator(context, logger) },
    });
    provider.updateStatus('started');
  } catch (err) {
    telemetryRecords.error = err;
    console.error(err);
    throw err;
  } finally {
    // send telemetry event
    const endTime = performance.now();
    telemetryRecords.duration = endTime - startTime;
    //in the POC we do not send any telemetry
    // sendTelemetryRecords('macadam.machine.start', telemetryRecords, true);
  }
}

async function stopMachine(
  provider: extensionApi.Provider,
  machineInfo: MachineInfo,
  context?: extensionApi.LifecycleContext,
  logger?: extensionApi.Logger,
): Promise<void> {
  const startTime = performance.now();
  const telemetryRecords: Record<string, unknown> = {};
  telemetryRecords.provider = 'macadam';
  try {
    await ensureMacadamInitialized(true);
    await macadam.stopVm({
      name: machineInfo.name,
      containerProvider: verifyContainerProivder(machineInfo.vmType),
      runOptions: { logger: new LoggerDelegator(context, logger) },
    });
    provider.updateStatus('stopped');
  } catch (err: unknown) {
    telemetryRecords.error = err;
    throw err;
  } finally {
    // send telemetry event
    const endTime = performance.now();
    telemetryRecords.duration = endTime - startTime;
    //in the POC we do not send any telemetry
    //sendTelemetryRecords('macadam.machine.stop', telemetryRecords, false);
  }
}

async function registerProviderFor(
  provider: extensionApi.Provider,
  machineInfo: MachineInfo,
  context: extensionApi.ExtensionContext,
): Promise<void> {
  const lifecycle: extensionApi.ProviderConnectionLifecycle = {
    start: async (context, logger): Promise<void> => {
      await startMachine(provider, machineInfo, context, logger);
    },
    stop: async (context, logger): Promise<void> => {
      await stopMachine(provider, machineInfo, context, logger);
    },
    delete: async (logger): Promise<void> => {
      await ensureMacadamInitialized(true);
      await macadam.removeVm({
        name: machineInfo.name,
        containerProvider: verifyContainerProivder(machineInfo.vmType),
        runOptions: { logger },
      });
    },
  };

  const providerConnectionShellAccess = new ProviderConnectionShellAccessImpl(machineInfo);
  context.subscriptions.push(providerConnectionShellAccess);

  const vmProviderConnection: extensionApi.VmProviderConnection = {
    name: machineInfo.name,
    status: () => macadamMachinesStatuses.get(machineInfo.image) ?? 'unknown',
    shellAccess: providerConnectionShellAccess,
    lifecycle,
  };

  const disposable = provider.registerVmProviderConnection(vmProviderConnection);
  provider.updateStatus('ready');

  // get configuration for this connection
  const vmConfiguration = extensionApi.configuration.getConfiguration('macadam', vmProviderConnection);

  // Set values for the machine
  await vmConfiguration.update('machine.cpus', machineInfo.cpus);
  await vmConfiguration.update('machine.memory', machineInfo.memory);
  await vmConfiguration.update('machine.diskSize', machineInfo.diskSize);

  currentConnections.set(machineInfo.image, disposable);
}

async function updateMachines(provider: extensionApi.Provider, context: extensionApi.ExtensionContext): Promise<void> {
  // init machines available
  const machineListOutput = await getJSONMachineList();

  if (machineListOutput.error) {
    // TODO handle the error
    console.error(machineListOutput.error);
  }

  // parse output
  const machines = machineListOutput.list;

  // update status of existing machines - in the POC only one can exist, just to keep code that can be reused in future
  for (const machine of machines) {
    const running = machine?.Running === true;
    let status: extensionApi.ProviderConnectionStatus = running ? 'started' : 'stopped';

    // update the status to starting if the machine is running but still starting
    const starting = machine?.Starting === true;
    if (starting) {
      status = 'starting';
    }

    const previousStatus = macadamMachinesStatuses.get(machine.Image);
    if (previousStatus !== status) {
      // notify status change
      listeners.forEach(listener => listener(machine.Image, status));
      macadamMachinesStatuses.set(machine.Image, status);
    }

    // TODO update cpu/memory/disk usage

    macadamMachinesInfo.set(machine.Image, {
      name: machine.Name,
      image: machine.Image,
      memory: Number(machine.Memory),
      cpus: Number(machine.CPUs),
      diskSize: Number(machine.DiskSize),
      port: machine.Port,
      remoteUsername: machine.RemoteUsername,
      identityPath: machine.IdentityPath,
      vmType: machine.VMType,
    });

    if (!macadamMachinesStatuses.has(machine.Image)) {
      macadamMachinesStatuses.set(machine.Image, status);
    }
  }

  // remove machine no longer there
  const machinesToRemove = Array.from(macadamMachinesStatuses.keys()).filter(
    machine => !machines.find(m => m.Image === machine),
  );
  machinesToRemove.forEach(machine => {
    macadamMachinesStatuses.delete(machine);
  });

  // create connections for new machines
  const connectionsToCreate = Array.from(macadamMachinesStatuses.keys()).filter(
    machineStatusKey => !currentConnections.has(machineStatusKey),
  );
  await Promise.all(
    connectionsToCreate.map(async machineName => {
      const podmanMachineInfo = macadamMachinesInfo.get(machineName);
      if (podmanMachineInfo) {
        await registerProviderFor(provider, podmanMachineInfo, context);
      }
    }),
  );

  // delete connections for machines no longer there
  machinesToRemove.forEach(machine => {
    const disposable = currentConnections.get(machine);
    if (disposable) {
      disposable.dispose();
      currentConnections.delete(machine);
    }
  });

  // If the machine length is zero and we are on macOS or Windows,
  // we will update the provider as being 'installed', or ready / starting / configured if there is a machine
  // if we are on Linux, ignore this as podman machine is OPTIONAL and the provider status in Linux is based upon
  // the native podman installation / not machine.
  if (!extensionApi.env.isLinux) {
    if (machines.length === 0) {
      if (provider.status !== 'configuring') {
        provider.updateStatus('installed');
      }
    } else {
      /*
       * The machine can have 3 states, based on `Starting` and `Running` fields:
       * - !Running && !Starting -> configured
       * -  Running &&  Starting -> starting
       * -  Running && !Starting -> ready
       */
      const atLeastOneMachineRunning = machines.some(machine => machine.Running && !machine.Starting);
      const atLeastOneMachineStarting = machines.some(machine => machine.Starting);
      // if a machine is running it's started else it is ready
      if (atLeastOneMachineRunning) {
        provider.updateStatus('ready');
      } else if (atLeastOneMachineStarting) {
        // update to starting
        provider.updateStatus('starting');
      } else {
        // needs to start a machine
        provider.updateStatus('configured');
      }

      // Finally, we check to see if the machine that is running is set by default or not on the CLI
      // this will create a dialog that will ask the user if they wish to set the running machine as default.
      // this should only run if we at least one machine
      //await checkDefaultMachine(machines);
    }
  }
}

async function timeout(time: number): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, time);
  });
}

async function monitorMachines(provider: extensionApi.Provider, context: extensionApi.ExtensionContext): Promise<void> {
  // call us again
  if (!stopLoop) {
    try {
      await updateMachines(provider, context);
    } catch (error) {
      // ignore the update of machines
      console.warn('Error updating machines', error);
    }
    await timeout(5000);
    monitorMachines(provider, context).catch((error: unknown) => {
      console.error('Error monitoring machines', error);
    });
  }
}

async function createProvider(extensionContext: extensionApi.ExtensionContext): Promise<extensionApi.Provider> {
  const providerOptions: extensionApi.ProviderOptions = {
    name: 'Bootc VMs',
    id: 'bootc',
    status: 'unknown',
    images: {
      icon: './icon.png',
      logo: {
        dark: './icon.png',
        light: './icon.png',
      },
    },
    emptyConnectionMarkdownDescription: EXTENSION_DESCRIPTION_MARKDOWN,
  };

  const provider = extensionApi.provider.createProvider(providerOptions);

  extensionContext.subscriptions.push(provider);

  // enable factory
  provider.setVmProviderConnectionFactory({});

  return provider;
}

function updateWSLHyperVEnabledContextValue(value: boolean): void {
  if (wslAndHypervEnabledContextValue !== value) {
    wslAndHypervEnabledContextValue = value;
    extensionApi.context.setValue(WSL_HYPERV_ENABLED_KEY, value);
  }
}

export async function deactivate(): Promise<void> {
  stopLoop = true;
  console.log('stopping bootc extension');
}
