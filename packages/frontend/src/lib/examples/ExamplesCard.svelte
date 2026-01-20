<script lang="ts">
import Card from '/@/lib/Card.svelte';
import ExampleCard from './ExampleCard.svelte';
import type { Example, Category } from '/@shared/src/models/examples';

interface Props {
  category: Category;
  examples: Example[];
}
let { category, examples }: Props = $props();
</script>

<Card title={category.name}>
  <div class="w-full">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {#each examples as example (example.id)}
        <ExampleCard {example} />
      {/each}
    </div>
    {#if examples.length == 0}
      There are no examples in this category.
    {/if}
  </div>
</Card>
