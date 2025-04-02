<script lang="ts">
import BootcImageIcon from '../../BootcImageIcon.svelte';
import BootcStatusIcon from '../../BootcStatusIcon.svelte';
import type { Props } from './props';

let { object }: Props = $props();
</script>

<BootcStatusIcon icon={BootcImageIcon} status={object.status} />
