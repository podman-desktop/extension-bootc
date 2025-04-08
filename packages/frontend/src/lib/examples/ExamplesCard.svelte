<script lang="ts">
import Card from '/@/lib/Card.svelte';
import ExampleCard from './ExampleCard.svelte';
import type { Example, Category } from '/@shared/src/models/examples';
import { imageInfo } from '../../stores/imageInfo';

interface Props {
  category: Category;
  examples: Example[];
}
let { category, examples = $bindable() }: Props = $props();

// Function to update examples based on available images
function updateExamplesWithPulledImages(): void {
  if ($imageInfo) {
    // Set each state to 'unpulled' by default before updating, as this prevents 'flickering'
    // and unsure states when images are being updated
    for (const example of examples) {
      example.state = 'unpulled';
    }

    for (const image of $imageInfo) {
      // Only do it if there is a RepoTags
      const [imageRepo, imageTag] = image.RepoTags?.[0]?.split(':') ?? [];
      // Find by image name and tag if it's in the list of examples
      const example = examples.find(example => example.image === imageRepo && example.tag === imageTag);
      if (example) {
        example.state = 'pulled';
      }
    }

    // Update examples to trigger a re-render
    examples = [...examples];
  }
}

// Reactive statement to call the function each time bootcAvailableImages updates
$effect(() => {
  updateExamplesWithPulledImages();
});
</script>

<Card title={category.name}>
  <div class="w-full">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {#each examples as example (example.id)}
        <ExampleCard example={example} />
      {/each}
    </div>
  </div>
</Card>
