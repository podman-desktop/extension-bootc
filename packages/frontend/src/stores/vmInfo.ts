import { derived } from 'svelte/store';
import { BootcAPI } from '@podman-desktop/extension-bootc';
import { rpcReadable } from './rpcReadable';

const api = BootcAPI.getInstance();

export const vmStatuses = rpcReadable([], () => api.impl.getVmStatuses(), 3000);

export const vmStatusSummary = derived(vmStatuses, $vmStatuses => {
 return $vmStatuses.reduce(
    (acc, vm) => {
      acc.total += 1;
      if (vm.status === 'running') {
        acc.running += 1;
      } else if (vm.status === 'stopped') {
        acc.stopped += 1;
      } else if (vm.status === 'error') {
        acc.error += 1;
      }
      return acc;
    },
    {
      running: 0,
      stopped: 0,
      error: 0,
      total: 0,
    },
 );
});
