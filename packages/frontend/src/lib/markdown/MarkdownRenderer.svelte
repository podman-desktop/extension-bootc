<script lang="ts">
import SvelteMarkdown from 'svelte-markdown';

interface Props {
  source?: string;
}
let { source }: Props = $props();
</script>

<article class="prose min-w-full text-base">
  <SvelteMarkdown source={source} />
</article>
