<script lang="ts">
import BootcStatusIcon from '../../BootcStatusIcon.svelte';
import DiskImageIcon from '../../DiskImageIcon.svelte';

import type { Props } from './props';

let { object }: Props = $props();
</script>

<BootcStatusIcon icon={DiskImageIcon} status={object.status} />
