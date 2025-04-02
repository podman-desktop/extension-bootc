<script lang="ts">
import ImageActions from '../ImageActions.svelte';
import type { Props } from './props';

let { object }: Props = $props();
</script>

<ImageActions object={object} />
