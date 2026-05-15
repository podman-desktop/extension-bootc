---
name: playwright-testing
description: >-
  Guides writing and maintaining Playwright E2E tests for the bootc Podman
  Desktop extension. Covers the webview-aware test framework, extension
  lifecycle management, Page Object Models, and spec file patterns. Triggers
  when creating or modifying E2E spec files, building page object models,
  debugging Playwright failures, or asking about the test framework.
paths:
  - tests/playwright/**/*.ts
---

# Playwright E2E Testing for Bootc Extension

This extension runs inside Podman Desktop as a webview. E2E tests launch Podman
Desktop via Electron, install the extension from an OCI image, then interact
with the extension's webview UI. This is fundamentally different from testing
Podman Desktop itself — every test must handle the webview boundary.

## Project Structure

Tests live in `tests/playwright/`. Key directories:

- `src/*.spec.ts` — test spec files
- `src/model/` — Page Object Models (webview-aware, take both `page` and `webview`)
- `src/utility/` — test helpers (webview handling, extension lifecycle, cleanup)

```bash
# See the full structure
find tests/playwright/src -type f -name '*.ts' | sort
```

## Critical Concept: Webview Handling

Extensions render in a webview (a separate Electron BrowserWindow). You must
get BOTH the main page and the webview page to interact with extension UI:

```typescript
import { handleWebview } from './utility/bootc-test-utils';

// Returns [mainPage, webViewPage] — use webViewPage for extension UI locators
const [page, webview] = await handleWebview(runner);
```

**How `handleWebview()` works:**

1. Clicks the "Bootable Containers" link in Podman Desktop's main navigation
2. Waits for the webview document to appear
3. Gets the second Electron window via `runner.getWindows()`
4. Focuses the webview element
5. Returns `[mainPage, webViewPage]`

**All extension Page Object Models take both `page` and `webview` parameters.**
Use `webview` for extension-specific locators, `page` for Podman Desktop dialogs.

## Imports

Import `test`, `expect`, and utilities from `@podman-desktop/tests-playwright`:

```typescript
import {
  test,
  expect as playExpect,
  RunnerOptions,
  removeFolderIfExists,
  waitForPodmanMachineStartup,
  NavigationBar,
  waitUntil,
} from '@podman-desktop/tests-playwright';
import type { Page } from '@playwright/test';
```

Import extension-specific models and utilities locally:

```typescript
import { BootcNavigationBar } from './model/bootc-navigationbar';
import {
  handleWebview,
  installBootcExtensionIfNeeded,
  removeBootcExtensionIfNeeded,
  cleanupRawVideoFiles,
} from './utility/bootc-test-utils';
import { markTestFileComplete } from './utility/extension-lifecycle';
```

## Extension Lifecycle Management

The extension is installed once before the first spec file and removed after the
last one completes. This is managed by a file-based counter:

1. `global-setup.ts` counts spec files and writes the total to a temp file
2. Each spec's `afterAll` calls `markTestFileComplete(fileId)` which decrements
3. When the counter reaches zero, the last spec file triggers removal
4. `extension-reporter.ts` handles fully-skipped files (their afterAll never runs)

**Every spec file MUST include this in its outer `test.afterAll`:**

```typescript
import { fileURLToPath } from 'node:url';
import { markTestFileComplete } from './utility/extension-lifecycle';

const __filename = fileURLToPath(import.meta.url);

test.afterAll(async ({ navigationBar }) => {
  if (markTestFileComplete(__filename)) {
    await removeBootcExtensionIfNeeded(navigationBar);
  }
});
```

## Page Object Model Pattern

### Two-Parameter POMs

Unlike upstream Podman Desktop POMs (which take only `page`), bootc POMs take
both `page` and `webview`:

```typescript
export class BootcDashboardPage {
  readonly page: Page;
  readonly webview: Page;
  readonly heading: Locator;

  constructor(page: Page, webview: Page) {
    this.page = page;
    this.webview = webview;
    // Extension UI locators use webview
    this.heading = webview.getByText('Welcome to bootable containers');
  }
}
```

### Using POMs

POMs are in `tests/playwright/src/model/`. Read them for current methods and locators:

```bash
ls tests/playwright/src/model/
```

The navigation bar POM navigates within the extension's webview. Other POMs
wrap specific pages (build, dashboard, disk images, examples, etc.).

### Dialog Handling

Build completion shows a dialog on the **main page** (not webview). Always
use `this.page` (not `this.webview`) for Podman Desktop dialogs.

## Writing a New Spec File

### Template

```typescript
import type { Page } from '@playwright/test';
import {
  removeFolderIfExists,
  waitForPodmanMachineStartup,
  test,
  expect as playExpect,
  RunnerOptions,
  isLinux,
} from '@podman-desktop/tests-playwright';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BootcNavigationBar } from './model/bootc-navigationbar';
import {
  removeBootcExtensionIfNeeded,
  handleWebview,
  installBootcExtensionIfNeeded,
  cleanupRawVideoFiles,
} from './utility/bootc-test-utils';
import { markTestFileComplete } from './utility/extension-lifecycle';

let page: Page;
let webview: Page;
const __filename = fileURLToPath(import.meta.url);

test.use({
  runnerOptions: new RunnerOptions({
    customFolder: 'bootc-tests-pd',
    customOutputFolder: 'tests/output',
    autoUpdate: false,
    autoCheckUpdates: false,
  }),
});

test.beforeAll(async ({ runner, welcomePage, page }) => {
  await removeFolderIfExists('tests/output/images');
  runner.setVideoAndTraceName('my-feature-name');
  await welcomePage.handleWelcomePage(true);
  await waitForPodmanMachineStartup(page);
});

test.afterAll(async ({ runner }) => {
  test.setTimeout(320_000);
  const videoAndTraceName = runner.getVideoAndTraceName();
  try {
    await removeFolderIfExists('tests/output/images');
  } finally {
    await runner.close(200_000);
    cleanupRawVideoFiles('tests/output', videoAndTraceName);
  }
});

test.describe('My Feature', () => {
  test.skip(isLinux); // building bootable images not supported on Linux

  test.beforeAll(async ({ navigationBar }) => {
    test.setTimeout(200_000);
    await installBootcExtensionIfNeeded(navigationBar);
  });

  test.describe.serial('Feature flow', () => {
    test('Navigate to extension', async ({ runner }) => {
      test.setTimeout(60_000);
      [page, webview] = await handleWebview(runner);
      const bootcNav = new BootcNavigationBar(page, webview);
      const dashboard = await bootcNav.openBootcDashboard();
      await playExpect(dashboard.heading).toBeVisible();
    });

    test('Perform action', async ({ runner }) => {
      test.setTimeout(300_000);
      [page, webview] = await handleWebview(runner);
      // ... test body
    });
  });

  test.afterAll(async ({ navigationBar }) => {
    if (markTestFileComplete(__filename)) {
      await removeBootcExtensionIfNeeded(navigationBar);
    }
  });
});
```

### Key Patterns

- **Always call `handleWebview(runner)`** at the start of each test that interacts with the extension
- **Use `test.describe.serial()`** — tests share Electron state and must run in order
- **Use `test.skip(isLinux)`** — building bootable images is not supported on Linux
- **Long timeouts are normal** — image pulls take up to 12 minutes, builds up to 25 minutes
- **Clean up video files** — call `cleanupRawVideoFiles()` in `afterAll` to handle orphaned webview recordings
- **`customFolder: 'bootc-tests-pd'`** — all specs use this folder name for consistent profile isolation

### Platform Skip Patterns

```typescript
import { isLinux, isMac, isWindows } from '@podman-desktop/tests-playwright';

test.skip(isLinux); // no bootable image building on Linux
test.skip(isMac && arch === ArchitectureType.AMD64, 'amd64 not supported on macOS');
test.skip(isWindows && arch === ArchitectureType.ARM64, 'arm64 not supported on Windows');
```

## Extension Installation

The extension is installed from an OCI image. The URL is configurable:

```typescript
// Default: ghcr.io/podman-desktop/extension-bootc:next
// Override: set OCI_IMAGE env var
const extensionURL = process.env.OCI_IMAGE ?? 'ghcr.io/podman-desktop/extension-bootc:next';
```

Set `SKIP_INSTALLATION=true` to skip install/remove (when testing with a pre-installed extension).

## Running Tests

```bash
# From the repo root
pnpm test:e2e

# From tests/playwright directly
pnpm --dir tests/playwright test:e2e

# Run a single spec
pnpm --dir tests/playwright exec playwright test src/bootc-dashboard.spec.ts

# With custom extension image
OCI_IMAGE=ghcr.io/podman-desktop/extension-bootc:v1.15.0 \
  pnpm --dir tests/playwright exec playwright test src/

# Skip extension install/remove (pre-installed)
SKIP_INSTALLATION=true \
  pnpm --dir tests/playwright exec playwright test src/
```

### Environment Variables

| Variable                | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `PODMAN_DESKTOP_BINARY` | Path to Podman Desktop binary                |
| `PODMAN_DESKTOP_ARGS`   | Path to Podman Desktop repo (dev mode)       |
| `OCI_IMAGE`             | Extension OCI image URL (default: next tag)  |
| `SKIP_INSTALLATION`     | Skip extension install/remove lifecycle      |
| `BUILD_ISO_IMAGE`       | Enable ISO build tests (disabled by default) |

## Existing Spec Files

```bash
# List all spec files and their test descriptions
ls tests/playwright/src/*.spec.ts
grep -h "test.describe\|test('" tests/playwright/src/*.spec.ts
```

## Troubleshooting

### Webview Not Appearing

If `handleWebview()` times out waiting for the second window, the extension may
not have loaded. Check that the extension is installed and in ACTIVE state.

### Build Stuck in "creating" State

`BootcPage.refreshPageWhileInCreatingState()` navigates away and back to force
a UI refresh. The `waitUntil` wrapper retries until the state changes.

### Video File Cleanup

Webview windows generate orphaned raw video files (32-char hex names).
`cleanupRawVideoFiles()` handles this — always call it in `afterAll`.

## Discovering POM APIs

Read the actual Page Object Models to see current locators and methods:

```bash
# List all POMs
ls tests/playwright/src/model/

# Read a specific POM for its locators and methods
cat tests/playwright/src/model/bootc-page.ts

# List all test utilities
cat tests/playwright/src/utility/bootc-test-utils.ts
```
