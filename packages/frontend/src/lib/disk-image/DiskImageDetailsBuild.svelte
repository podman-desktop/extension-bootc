<script lang="ts">
import '@xterm/xterm/css/xterm.css';

import { EmptyScreen } from '@podman-desktop/ui-svelte';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { onDestroy, onMount } from 'svelte';
import { router } from 'tinro';
import { bootcClient } from '/@/api/client';
import { getTerminalTheme } from '/@/lib/upstream/terminal-theme';

interface Props {
  folder?: string;
}
let { folder }: Props = $props();

// Log
let logsXtermDiv = $state<HTMLDivElement>();
let noLogs = $state(true);
let previousLogs = $state('');
const refreshInterval = 2_000;

// Terminal resize
let resizeObserver = $state<ResizeObserver>();
let termFit = $state<FitAddon>();

let logsTerminal = $state<Terminal>();
let logInterval = $state<NodeJS.Timeout>();

async function fetchFolderLogs(): Promise<void> {
  if (!folder) {
    return;
  }

  const logs = await bootcClient.loadLogsFromFolder(folder);

  // We will write only the new logs to the terminal,
  // this is a simple way of updating the logs as we update it by calling the function
  // every 2 seconds instead of setting up a file watcher (unable to do so through RPC calls, due to long-running process)
  if (logs !== previousLogs) {
    // Write only the new logs to the log
    const newLogs = logs.slice(previousLogs.length);
    logsTerminal?.write(newLogs);
    previousLogs = logs; // Update the stored logs
    noLogs = false; // Make sure that the logs are visible
  }
}

async function refreshTerminal(): Promise<void> {
  // missing element, return
  if (!logsXtermDiv) {
    console.log('missing xterm div, exiting...');
    return;
  }

  // Retrieve the user configuration settings for the terminal to match the rest of Podman Desktop.
  const fontSize = (await bootcClient.getConfigurationValue('terminal', 'integrated.fontSize')) as number;
  const lineHeight = (await bootcClient.getConfigurationValue('terminal', 'integrated.lineHeight')) as number;

  logsTerminal = new Terminal({
    fontSize: fontSize,
    lineHeight: lineHeight,
    disableStdin: true,
    theme: getTerminalTheme(),
    convertEol: true,
  });
  termFit = new FitAddon();
  logsTerminal.loadAddon(termFit);

  logsTerminal.open(logsXtermDiv);

  // Disable cursor as we are just reading the logs
  logsTerminal.write('\x1b[?25l');

  // Call fit addon each time we resize the window
  window.addEventListener('resize', () => {
    termFit?.fit();
  });
  termFit.fit();
}

onMount(async () => {
  // Refresh the terminal on initial load
  await refreshTerminal();

  // Fetch logs initially and set up the interval to run every 2 seconds
  // we do this to avoid having to setup a file watcher since long-running commands to the backend is
  // not possible through RPC calls (yet).
  await fetchFolderLogs();
  logInterval = setInterval(() => {
    fetchFolderLogs().catch((e: unknown) => console.error('error fetching logs', e));
  }, refreshInterval);

  // Resize the terminal each time we change the div size
  resizeObserver = new ResizeObserver(() => {
    termFit?.fit();
  });

  // Observe the terminal div
  if (logsXtermDiv) {
    resizeObserver.observe(logsXtermDiv);
  }
});

onDestroy(() => {
  // Cleanup the observer on destroy
  if (logsXtermDiv) {
    resizeObserver?.unobserve(logsXtermDiv);
  }

  // Clear the interval when the component is destroyed
  clearInterval(logInterval);
});

export function goToHomePage(): void {
  router.goto('/');
}
</script>

<EmptyScreen
  icon={undefined}
  title="No log file"
  message="Unable to read image-build.log file from {folder}"
  hidden={noLogs === false} />

<div
  class="min-w-full flex flex-col p-[5px] pr-0 bg-[var(--pd-terminal-background)]"
  class:invisible={noLogs === true}
  class:h-0={noLogs === true}
  class:h-full={noLogs === false}
  bind:this={logsXtermDiv}>
</div>
