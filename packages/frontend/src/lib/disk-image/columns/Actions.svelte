<script lang="ts">
import DiskImageActions from '../DiskImageActions.svelte';
import type { Props } from './props';

let { object }: Props = $props();
</script>

<DiskImageActions object={object} />
