<script lang="ts">
import ListItemButtonIcon from '/@/lib/upstream/ListItemButtonIcon.svelte';
import type { ImageInfoUI } from './ImageInfoUI';
import { faBuilding } from '@fortawesome/free-solid-svg-icons';
import { gotoImageBuild } from '../navigation';

interface Props {
  object: ImageInfoUI;
}

let { object }: Props = $props();

async function goToImageBuild(): Promise<void> {
  await gotoImageBuild(object.name, object.tag);
}
</script>

<ListItemButtonIcon title="Build Disk Image" onClick={goToImageBuild} icon={faBuilding} />
