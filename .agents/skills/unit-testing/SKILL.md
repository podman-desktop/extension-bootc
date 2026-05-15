---
name: unit-testing
description: >-
  Guides writing and maintaining Vitest unit tests for the bootc extension's
  backend, frontend, and shared packages. Covers mocking @podman-desktop/api,
  RPC clients, Svelte stores, and Node.js modules. Triggers when creating or
  modifying .spec.ts files, fixing Vitest failures, or adding test coverage.
paths:
  - packages/backend/src/**/*.spec.ts
  - packages/frontend/src/**/*.spec.ts
  - packages/shared/src/**/*.spec.ts
argument-hint: '[test-file-or-pattern]'
---

# Unit Testing for Bootc Extension

## Framework

- **Vitest 4** with v8 coverage provider
- **Backend**: Node.js environment, mocked `@podman-desktop/api`
- **Frontend**: JSDOM environment, `@testing-library/svelte` for components
- **Shared**: Node.js environment for message proxy and model tests

## Running Tests

```bash
pnpm test              # all packages
pnpm test:backend      # packages/backend with coverage
pnpm test:frontend     # packages/frontend with coverage
pnpm test:shared       # packages/shared with coverage

# Single file
npx vitest run packages/backend/src/build-disk-image.spec.ts

# Watch mode
npx vitest watch packages/backend/src/
```

## Backend Test Patterns

### Mocking @podman-desktop/api

The backend's `vite.config.js` aliases `@podman-desktop/api` to a mock file.
Mock only the namespaces your test actually uses:

```typescript
import { vi, test, expect, beforeEach, describe } from 'vitest';
import * as extensionApi from '@podman-desktop/api';

vi.mock('@podman-desktop/api', async () => ({
  // Mock only what your test needs — check existing tests for patterns:
  // grep -l "vi.mock('@podman-desktop/api'" packages/backend/src/*.spec.ts
}));
```

To see the full mock shape used in existing tests:

```bash
grep -A 30 "vi.mock('@podman-desktop/api'" packages/backend/src/*.spec.ts | head -60
```

### Testing Backend Functions

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { buildDiskImage } from './build-disk-image';

vi.mock('@podman-desktop/api');
vi.mock('./container-utils');
vi.mock('./history');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('buildDiskImage', () => {
  test('should create build container with correct volumes', async () => {
    // Arrange
    const buildInfo = {
      id: 'test-id',
      image: 'quay.io/test/image',
      tag: 'latest',
      type: ['qcow2'] as BuildType[],
      folder: '/output',
      // ...
    };

    // Act
    await buildDiskImage(buildInfo);

    // Assert
    expect(containerEngine.createContainer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        Image: expect.stringContaining('bootc-image-builder'),
      }),
    );
  });
});
```

### Mocking Node.js Modules

```typescript
import { vi } from 'vitest';

vi.mock('node:fs', async () => ({
  promises: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  existsSync: vi.fn(),
}));

vi.mock('node:child_process', async () => ({
  exec: vi.fn(),
}));
```

## Frontend Test Patterns

### Component Testing with @testing-library/svelte

```typescript
import { vi, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import MyComponent from './MyComponent.svelte';

// Mock the RPC client
vi.mock('/@/api/client', async () => ({
  bootcClient: {
    listBootcImages: vi.fn().mockResolvedValue([]),
    buildImage: vi.fn(),
  },
  rpcBrowser: {
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  },
}));

test('renders heading', async () => {
  render(MyComponent, { props: { imageName: 'test' } });
  expect(screen.getByText('Build Disk Image')).toBeInTheDocument();
});

test('clicking build button triggers build', async () => {
  render(MyComponent);
  const buildButton = screen.getByRole('button', { name: 'Build' });
  await fireEvent.click(buildButton);
  expect(bootcClient.buildImage).toHaveBeenCalled();
});
```

### Mocking Svelte Stores

```typescript
import { vi } from 'vitest';
import { readable } from 'svelte/store';

vi.mock('/@/stores/imageInfo', async () => ({
  imageInfos: readable([{ Id: 'abc123', RepoTags: ['quay.io/test:latest'], Labels: { 'containers.bootc': '' } }]),
}));
```

### Path Aliases in Tests

Frontend tests resolve `/@/` to `packages/frontend/src/` and `/@shared/` to
`packages/shared/` via Vite config. Use these aliases in mocks:

```typescript
vi.mock('/@/api/client'); // → packages/frontend/src/api/client
vi.mock('/@shared/src/models/bootc'); // → packages/shared/src/models/bootc
```

## Shared Package Tests

### MessageProxy Tests

```typescript
import { test, expect, vi } from 'vitest';
import { RpcBrowser, RpcExtension } from './MessageProxy';

test('RPC call resolves with result', async () => {
  // Test the RPC proxy mechanism
});
```

## Test File Naming

- Test files: `*.spec.ts` colocated with source files
- Example: `build-disk-image.ts` → `build-disk-image.spec.ts`

## Coverage

Coverage reports are generated in `lcov` and `text` format:

```bash
pnpm test:backend   # generates packages/backend/coverage/
pnpm test:frontend  # generates packages/frontend/coverage/
```

## Common Issues

### "Cannot find module @podman-desktop/api"

The mock alias is configured in `packages/backend/vite.config.js`. If you see
this error, ensure the test file is being run from the correct package.

### "Not a Svelte component"

The test environment needs the Svelte vite plugin. Frontend tests use the
config from `packages/frontend/vite.config.js` which includes `@sveltejs/vite-plugin-svelte`.

### Test Retries

Frontend tests retry failed tests 2x (configured in `packages/frontend/vite.config.js`).
Backend tests do not retry.
