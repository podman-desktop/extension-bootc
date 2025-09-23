<script lang="ts">
import { onDestroy, onMount } from 'svelte';
import type { BootcBuildInfo } from '/@shared/src/models/bootc';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import DiskImageColumnActions from './columns/Actions.svelte';
import { bootcClient } from '/@/api/client';
import { searchPattern, filtered } from '../../stores/historyInfo';
import DiskImageIcon from '../DiskImageIcon.svelte';
import DiskImageColumnStatus from './columns/Status.svelte';
import DiskImageColumnFolder from './columns/Folder.svelte';
import DiskImageColumnImage from './columns/Image.svelte';
import {
  Button,
  Table,
  TableColumn,
  TableRow,
  TableSimpleColumn,
  NavPage,
  FilteredEmptyScreen,
} from '@podman-desktop/ui-svelte';
import DiskImageEmptyScreen from './DiskImageEmptyScreen.svelte';
import { gotoBuild, gotoCreateVMForm } from '../navigation';
import type { Unsubscriber } from 'svelte/store';

interface Props {
  searchTerm?: string;
}
let { searchTerm = '' }: Props = $props();
let isWindows = $state(false);
let historyInfoUnsubscribe = $state<Unsubscriber>();

$effect(() => {
  searchPattern.set(searchTerm);
});

let history = $state<BootcBuildInfoUI[]>([]);

interface BootcBuildInfoUI extends BootcBuildInfo {
  selected: boolean;
}

onMount(async () => {
  isWindows = await bootcClient.isWindows();

  historyInfoUnsubscribe = filtered.subscribe(value => {
    history = value.map(build => ({ ...build, selected: false }));
  });
});

onDestroy(() => {
  if (historyInfoUnsubscribe) {
    historyInfoUnsubscribe();
  }
});

// Bulk delete the selected builds
let bulkDeleteInProgress = $state(false);

async function deleteSelectedBuilds(): Promise<void> {
  const selected = history.filter(history => history.selected).map(history => history.id);
  if (selected.length === 0) {
    return;
  }

  // mark builds for deletion
  bulkDeleteInProgress = true;

  // Delete all the selected builds
  await bootcClient.deleteBuilds(selected);
  bulkDeleteInProgress = false;
}

let selectedItemsNumber = $state<number>(0);
let table = $state<Table<BootcBuildInfoUI>>();

// COLUMNS
let statusColumn = new TableColumn<BootcBuildInfoUI>('Status', {
  align: 'center',
  width: '70px',
  renderer: DiskImageColumnStatus,
});

let imageColumn = new TableColumn<BootcBuildInfoUI>('Image', {
  width: '2fr',
  renderer: DiskImageColumnImage,
  comparator: (a, b): number => a.image.localeCompare(b.image),
});

let typeColumn = new TableColumn<BootcBuildInfoUI, string>('Type', {
  renderMapping: (object: BootcBuildInfo): string => object.type.join(),
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.type.join().localeCompare(b.type.join()),
});

let archColumn = new TableColumn<BootcBuildInfoUI, string>('Arch', {
  renderMapping: (object: BootcBuildInfo): string => object.arch ?? '',
  renderer: TableSimpleColumn,
  comparator: (a, b): number => {
    if (a.arch && b.arch) {
      return a.arch.localeCompare(b.arch);
    } else if (a.arch) {
      return 1;
    }
    return -1;
  },
});

let folderColumn = new TableColumn<BootcBuildInfo>('Folder', {
  renderer: DiskImageColumnFolder,
  comparator: (a, b): number => a.folder.localeCompare(b.folder),
});

const columns = [
  statusColumn,
  imageColumn,
  typeColumn,
  archColumn,
  folderColumn,
  new TableColumn<BootcBuildInfo>('Actions', { align: 'right', renderer: DiskImageColumnActions, overflow: true }),
];

const row = new TableRow<BootcBuildInfoUI>({
  selectable: (_build): boolean => true,
});
</script>

<NavPage bind:searchTerm={searchTerm} title="disk images" searchEnabled={true}>
  {#snippet additionalActions()}
  <!-- Only show for macOS and Linux -->
  {#if !isWindows}
    <Button on:click={gotoCreateVMForm} icon={DiskImageIcon} title="Create VM">Create VM</Button>
  {/if}
    <Button on:click={gotoBuild} icon={DiskImageIcon} title="Build">Build</Button>
  {/snippet}

  {#snippet bottomAdditionalActions()}
    {#if selectedItemsNumber > 0}
      <Button
        on:click={deleteSelectedBuilds}
        title="Delete {selectedItemsNumber} selected items"
        inProgress={bulkDeleteInProgress}
        icon={faTrash} />
      <span>On {selectedItemsNumber} selected items.</span>
    {/if}
  {/snippet}

  {#snippet content()}
  <div class="flex min-w-full h-full">
    <Table
      kind="disk images"
      bind:this={table}
      bind:selectedItemsNumber={selectedItemsNumber}
      data={history}
      columns={columns}
      row={row}
      defaultSortColumn="Name"
      on:update={(): void => {
        history = history;
      }}>
    </Table>

    {#if $filtered.length === 0 && searchTerm}
      <FilteredEmptyScreen icon={DiskImageIcon} kind="disk images" bind:searchTerm={searchTerm} />
    {:else if history.length === 0}
      <DiskImageEmptyScreen />
    {/if}
  </div>
  {/snippet}
</NavPage>
