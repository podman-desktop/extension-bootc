<script lang="ts">
import type { Example, Category } from '/@shared/src/models/examples';
import { onMount } from 'svelte';
import { NavPage } from '@podman-desktop/ui-svelte';
import { bootcClient } from '/@/api/client';
import ExamplesCard from './ExamplesCard.svelte';
import { SvelteMap } from 'svelte/reactivity';
import { imageInfo } from '/@/stores/imageInfo';

let baseExamples = $state<Example[]>([]);
let baseCategories = $state<Category[]>([]);

const UNCLASSIFIED: Category = {
  id: 'unclassified',
  name: 'Unclassified',
};

onMount(async () => {
  const data = await bootcClient.getExamples();
  baseExamples = data.examples;
  baseCategories = data.categories;
});

const examplesWithState = $derived.by(() => {
  const pulledImages = new Set($imageInfo?.map(image => image.RepoTags?.[0] ?? '') ?? []);
  return baseExamples.map(example => {
    const exampleWithState: Example = {
      ...example,
      state: pulledImages.has(`${example.image}:${example.tag}`) ? 'pulled' : 'unpulled',
    };
    return exampleWithState;
  });
});

const groups = $derived.by(() => {
  const newGroups = new SvelteMap<Category, Example[]>();
  const categoryDict = Object.fromEntries(baseCategories.map(c => [c.id, c]));

  for (const example of examplesWithState) {
    const addExampleToCategory = (key: Category): void => {
      const list = newGroups.get(key);
      if (list) {
        list.push(example);
      } else {
        newGroups.set(key, [example]);
      }
    };

    if (example.categories.length === 0) {
      addExampleToCategory(UNCLASSIFIED);
      continue;
    }

    for (const categoryId of example.categories) {
      const key = categoryDict[categoryId] ?? UNCLASSIFIED;
      addExampleToCategory(key);
    }
  }
  return newGroups;
});
</script>

<NavPage title="Examples" searchEnabled={false}>
  {#snippet content()}
  <div class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="px-5 space-y-5">
        {#each groups.entries() as [category, examples] (category.id)}
          <ExamplesCard {category} {examples} />
        {/each}
      </div>
    </div>
  </div>
  {/snippet}
</NavPage>
