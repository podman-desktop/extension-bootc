<script lang="ts">
import type { TinroRouteMeta } from 'tinro';
import { SettingsNavItem } from '@podman-desktop/ui-svelte';
import { faHouse, faBookOpen, faGear } from '@fortawesome/free-solid-svg-icons';
import BootcImageIcon from './lib/BootcImageIcon.svelte';
import bootcIcon from './lib/bootc-icon.png';
import DiskImageIcon from './lib/DiskImageIcon.svelte';

interface Props {
  meta: TinroRouteMeta;
}
let { meta }: Props = $props();
</script>

<nav
  class="z-1 w-leftsidebar min-w-leftsidebar flex-col justify-between flex transition-all duration-500 ease-in-out bg-[var(--pd-secondary-nav-bg)] border-[var(--pd-global-nav-bg-border)] border-r-[1px]"
  aria-label="Navigation">
  <div class="flex items-center">
    <a href="/" title="Navigate to dashboard" class="pt-4 px-3 mb-5 flex items-center gap-3">
      <img src={bootcIcon} alt="Bootable Containers" class="w-7 h-7" />
      <p class="text-xl font-semibold text-[color:var(--pd-secondary-nav-header-text)] border-l-[4px] border-transparent">Bootable Containers</p>
    </a>
  </div>
  <div class="h-full overflow-y-auto" style="margin-bottom:auto">
    <!-- FontAwesome icons rendered via SettingsNavItem are slightly narrower than custom Svelte component icons
         (which get wrapped in a <span> by the Icon component). The pl-[1px] compensates for this alignment difference. -->
    <div class="pl-[1px]">
      <SettingsNavItem title="Dashboard" icon={faHouse} selected={meta.url === '/'} href="/" />
    </div>
    <SettingsNavItem title="Images" icon={BootcImageIcon} selected={meta.url.startsWith('/images')} href="/images" />
    <SettingsNavItem title="Disk Images" icon={DiskImageIcon} selected={meta.url.startsWith('/disk-image')} href="/disk-images" />
    <div class="pl-[1px]">
      <SettingsNavItem title="Examples" icon={faBookOpen} selected={meta.url.startsWith('/examples')} href="/examples" />
    </div>
    <div class="pl-[1px]">
      <SettingsNavItem title="Preferences" icon={faGear} selected={meta.url.startsWith('/preferences')} href="/preferences" />
    </div>
  </div>
</nav>

