<script lang="ts">
import Card from '/@/lib/Card.svelte';
import ExampleCard from './ExampleCard.svelte';
import type { Example, Category } from '/@shared/src/models/examples';
import { onMount } from 'svelte';
import { bootcClient, rpcBrowser } from '/@/api/client';
import type { ImageInfo } from '@podman-desktop/api';
import { Messages } from '/@shared/src/messages/Messages';

interface Props {
  category: Category;
  examples: Example[];
}
let { category, examples = $bindable() }: Props = $props();

let bootcAvailableImages = $state<ImageInfo[]>([]);

onMount(async () => {
  bootcAvailableImages = await bootcClient.listBootcImages();
  updateExamplesWithPulledImages();

  // Update the available bootc images if we receive a msg image pull update from the UI
  return rpcBrowser.subscribe(Messages.MSG_IMAGE_PULL_UPDATE, msg => {
    bootcClient
      .listBootcImages()
      .then(images => {
        bootcAvailableImages = images;
      })
      .catch((e: unknown) => console.error('error while updating images', e));

    if (msg.image) {
      const example = examples.find(example => example.image === msg.image);
      if (example) {
        example.state = 'pulled';
        examples = [...examples];
      }
    }
  });
});

// Function to update examples based on available images
function updateExamplesWithPulledImages(): void {
  if (bootcAvailableImages) {
    // Set each state to 'unpulled' by default before updating, as this prevents 'flickering'
    // and unsure states when images are being updated
    for (const example of examples) {
      example.state = 'unpulled';
    }

    for (const image of bootcAvailableImages) {
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
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      {#each examples as example (example.id)}
        <ExampleCard example={example} />
      {/each}
    </div>
  </div>
</Card>
