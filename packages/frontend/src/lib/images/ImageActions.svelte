<script lang="ts">
import ListItemButtonIcon from '/@/lib/upstream/ListItemButtonIcon.svelte';
import type { ImageInfoUI } from './ImageInfoUI';
import { faBuilding, faTrash } from '@fortawesome/free-solid-svg-icons';
import { gotoDiskImageBuild } from '../navigation';
import { bootcClient } from '/@/api/client';

interface Props {
  object: ImageInfoUI;
}

let { object }: Props = $props();

async function goToImageBuild(): Promise<void> {
  await gotoDiskImageBuild(object.name, object.tag);
}

async function deleteImage(): Promise<void> {
  object.status = 'deleting';
  await bootcClient.deleteImage(object.engineId, object.id);
}
</script>

<ListItemButtonIcon title="Build Disk Image" onClick={goToImageBuild} icon={faBuilding} />

<ListItemButtonIcon title="Delete Image" enabled={object.status === 'unused'} onClick={deleteImage} icon={faTrash} />
