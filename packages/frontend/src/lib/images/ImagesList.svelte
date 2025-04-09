<script lang="ts">
import {
  FilteredEmptyScreen,
  NavPage,
  Table,
  TableColumn,
  TableDurationColumn,
  TableRow,
  TableSimpleColumn,
} from '@podman-desktop/ui-svelte';
import { onDestroy, onMount } from 'svelte';
import { ImageUtils } from './image-utils';
import { filtered, searchPattern } from '/@/stores/imageInfo';
import type { ImageInfoUI } from './ImageInfoUI';
import Status from './columns/Status.svelte';
import Name from './columns/Name.svelte';
import Actions from './columns/Actions.svelte';
import moment from 'moment';
import BootcImageIcon from '../BootcImageIcon.svelte';
import ImageEmptyScreen from './ImageEmptyScreen.svelte';
import { filesize } from 'filesize';
import { bootcClient } from '/@/api/client';
import type { ContainerInfo } from '@podman-desktop/api';
import type { Unsubscriber } from 'svelte/store';

interface Props {
  searchTerm?: string;
}
let { searchTerm = '' }: Props = $props();

$effect(() => {
  searchPattern.set(searchTerm);
});

let images = $state<ImageInfoUI[]>([]);

const imageUtils = new ImageUtils();

let imageInfoUnsubscribe = $state<Unsubscriber>();
let containers = $state<ContainerInfo[]>([]);

onMount(async () => {
  containers = await bootcClient.listContainers();
  imageInfoUnsubscribe = filtered.subscribe(value => {
    images = value.map(image => imageUtils.getImagesInfoUI(image, containers)).flat();
  });
});

onDestroy(() => {
  if (imageInfoUnsubscribe) {
    imageInfoUnsubscribe();
  }
});

let selectedItemsNumber = $state<number>(0);
let table: Table;

let statusColumn = new TableColumn<ImageInfoUI>('Status', {
  align: 'center',
  width: '70px',
  renderer: Status,
  comparator: (a, b): number => b.status.localeCompare(a.status),
});

let nameColumn = new TableColumn<ImageInfoUI>('Name', {
  width: '4fr',
  renderer: Name,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

let ageColumn = new TableColumn<ImageInfoUI, Date>('Age', {
  renderMapping: (image): Date => image.created,
  renderer: TableDurationColumn,
  comparator: (a, b): number => moment(b.created).diff(moment(a.created)),
});

let sizeColumn = new TableColumn<ImageInfoUI, string>('Size', {
  align: 'right',
  renderMapping: (image): string => filesize(image.size),
  renderer: TableSimpleColumn,
  comparator: (a, b): number => b.size - a.size,
});

const columns = [
  statusColumn,
  nameColumn,
  ageColumn,
  sizeColumn,
  new TableColumn<ImageInfoUI>('Actions', { align: 'right', renderer: Actions, overflow: true }),
];

const row = new TableRow<ImageInfoUI>({
  // If it is a manifest, it is not selectable (no delete functionality yet)
  selectable: (image): boolean => image.status === 'unused' && !image.isManifest,
  disabledText: 'Image is used by a container',
});
</script>

<NavPage bind:searchTerm={searchTerm} title="images">
  <div class="flex min-w-full h-full" slot="content">
    <Table
      kind="image"
      bind:this={table}
      bind:selectedItemsNumber={selectedItemsNumber}
      data={images}
      columns={columns}
      row={row}
      defaultSortColumn="Name">
    </Table>

    {#if $filtered.length === 0}
      {#if searchTerm}
        <FilteredEmptyScreen icon={BootcImageIcon} kind="images" bind:searchTerm={searchTerm} />
      {:else}
        <ImageEmptyScreen />
      {/if}
    {/if}
  </div>
</NavPage>
