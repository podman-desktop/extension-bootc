<script lang="ts">
import { DetailsPage, Button } from '@podman-desktop/ui-svelte';
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import ExampleDetailsLayout from './ExampleDetailsLayout.svelte';
import { router } from 'tinro';
import { onMount } from 'svelte';
import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons';
import { bootcClient } from '/@/api/client';
import type { Example } from '/@shared/src/models/examples';
import DiskImageIcon from '/@/lib/DiskImageIcon.svelte';

export let id: string;
let example: Example;

export function goToExamplesPage(): void {
  router.goto('/examples');
}
async function openURL(): Promise<void> {
  await bootcClient.openLink(example.repository);
}

onMount(async () => {
  // Get all the examples
  let examples = await bootcClient.getExamples();

  // Find the example with the given id
  const foundExample = examples.examples.find(example => example.id === id);
  if (foundExample) {
    example = foundExample;
  } else {
    console.error(`Example with id ${id} not found`);
  }
});
</script>

<DetailsPage
  title={example?.name}
  breadcrumbLeftPart="Examples"
  breadcrumbRightPart={example?.name}
  onclose={goToExamplesPage}
  onbreadcrumbClick={goToExamplesPage}>
  {#snippet iconSnippet()}
    <DiskImageIcon size="30px" />
  {/snippet}
  {#snippet contentSnippet()}
    <div class="bg-[var(--pd-content-bg)] h-full overflow-y-auto">
      <ExampleDetailsLayout detailsTitle="Example details" detailsLabel="Example details">
        <svelte:fragment slot="content">
          <MarkdownRenderer source={example?.readme} />
        </svelte:fragment>
        <svelte:fragment slot="details">
          <div class="flex flex-col w-full space-y-4 rounded-md bg-[var(--pd-content-bg)] p-4">
            <div class="flex flex-col w-full space-y-2">
              <Button
                on:click={openURL}
                icon={faArrowUpRightFromSquare}
                aria-label="More Details"
                title="More Details"
                type="link"
                class="mr-2">Source Repository</Button>
            </div>
          </div>
        </svelte:fragment>
      </ExampleDetailsLayout>
    </div>
  {/snippet}
</DetailsPage>
