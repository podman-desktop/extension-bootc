<script lang="ts">
import './app.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { router } from 'tinro';
import Route from './lib/Route.svelte';
import Build from './Build.svelte';
import { onMount } from 'svelte';
import { getRouterState, rpcBrowser } from './api/client';
import { Messages } from '/@shared/src/messages/Messages';
import DiskImageDetails from './lib/disk-image/DiskImageDetails.svelte';
import Examples from './lib/examples/Examples.svelte';
import Navigation from './Navigation.svelte';
import DiskImagesList from './lib/disk-image/DiskImagesList.svelte';
import Dashboard from './lib/dashboard/Dashboard.svelte';
import ExampleDetails from './lib/examples/ExampleDetails.svelte';
import ImagesList from './lib/images/ImagesList.svelte';
import CreateVM from './CreateVM.svelte';
import SudoConfirmationDialog from './lib/SudoConfirmationDialog.svelte';
import type { SudoConfirmationRequest } from '/@shared/src/models/SudoConfirmationRequest';

router.mode.hash();

let isMounted = $state(false);
let sudoConfirmationRequest = $state<SudoConfirmationRequest | null>(null);
let resolveSudoConfirmation: ((value: { confirmed: boolean }) => void) | null = null;

onMount(() => {
  // Load router state on application startup
  const state = getRouterState();
  router.goto(state.url);
  isMounted = true;

  const unsubNavigate = rpcBrowser.subscribe(Messages.MSG_NAVIGATE_BUILD, (x: string) => {
    router.goto(`/disk-images/build/${x}`);
  });

  const unsubSudo = rpcBrowser.subscribe(Messages.MSG_SUDO_CONFIRMATION, (request: SudoConfirmationRequest) => {
    sudoConfirmationRequest = request;
    return new Promise<{ confirmed: boolean }>((resolve) => {
      resolveSudoConfirmation = resolve;
    });
  });

  return () => {
    unsubNavigate();
    unsubSudo();
  };
});
</script>

<Route path="/*" breadcrumb="Bootable Containers" isAppMounted={isMounted} let:meta>
  <main class="flex flex-col w-screen h-screen overflow-hidden bg-[var(--pd-content-bg)]">
    <div class="flex flex-row w-full h-full overflow-hidden">
      <Navigation meta={meta} />

      <Route path="/" breadcrumb="Dashboard">
        <Dashboard />
      </Route>
      <Route path="/examples" breadcrumb="Examples">
        <Examples />
      </Route>

      <Route path="/example/:id" breadcrumb="Example Details" let:meta>
        <ExampleDetails id={meta.params.id} />
      </Route>
      <Route path="/images/" breadcrumb="Images">
        <ImagesList />
      </Route>
      <Route path="/disk-images/" breadcrumb="Disk Images">
        <DiskImagesList />
      </Route>
      <Route path="/disk-image/:id/*" breadcrumb="Disk Image Details" let:meta>
        <DiskImageDetails id={meta.params.id} />
      </Route>

      <Route path="/disk-images/build" breadcrumb="Build">
        <Build />
      </Route>
      <Route path="/disk-images/build/:name/:tag" breadcrumb="Build" let:meta>
        <Build imageName={decodeURIComponent(meta.params.name)} imageTag={decodeURIComponent(meta.params.tag)} />
      </Route>
      <Route path="/disk-images/createVM" breadcrumb="Create Virtual Machine">
        <CreateVM />
      </Route>
      <Route path="/disk-images/createVM/:imageName/:imagePath" breadcrumb="Create Virtual Machine" let:meta>
        <CreateVM imageName={atob(meta.params.imageName)} imagePath={atob(meta.params.imagePath)} />
      </Route>
    </div>
  </main>

  {#if sudoConfirmationRequest}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <SudoConfirmationDialog
        bind:request={sudoConfirmationRequest}
        on:confirm={() => {
          resolveSudoConfirmation?.({ confirmed: true });
          sudoConfirmationRequest = null;
          resolveSudoConfirmation = null;
        }}
        on:cancel={() => {
          resolveSudoConfirmation?.({ confirmed: false });
          sudoConfirmationRequest = null;
          resolveSudoConfirmation = null;
        }}
      />
    </div>
  {/if}
</Route>
