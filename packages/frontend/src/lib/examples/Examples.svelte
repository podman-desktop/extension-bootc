<script lang="ts">
import type { Example, Category } from '/@shared/src/models/examples';
import { onMount } from 'svelte';
import { NavPage } from '@podman-desktop/ui-svelte';
import { bootcClient } from '/@/api/client';
import ExamplesCard from './ExamplesCard.svelte';
import { SvelteMap } from 'svelte/reactivity';

let groups: Map<Category, Example[]> = new Map();

const UNCLASSIFIED: Category = {
  id: 'unclassified',
  name: 'Unclassified',
};

onMount(async () => {
  let examples = await bootcClient.getExamples();
  const categoryDict = Object.fromEntries(examples.categories.map((category: Category) => [category.id, category]));

  const output = new SvelteMap<Category, Example[]>();

  for (const example of examples.examples) {
    const processCategory = (key: Category): void => {
      // Get the existing array for the category or create a new one.
      const list = output.get(key);
      if (list) {
        list.push(example);
      } else {
        output.set(key, [example]);
      }
    };

    if (example.categories.length === 0) {
      processCategory(UNCLASSIFIED);
      continue;
    }

    for (const categoryId of example.categories) {
      const key = categoryDict[categoryId] ?? UNCLASSIFIED;
      processCategory(key);
    }
  }

  groups = output;
});
</script>

<NavPage title="Examples" searchEnabled={false}>
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="px-5 space-y-5">
        {#each groups.entries() as [category, examples](category.id)}
          <ExamplesCard category={category} examples={examples} />
        {/each}
      </div>
    </div>
  </div>
</NavPage>
