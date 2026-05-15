---
name: backend-api
description: >-
  Guides backend development with @podman-desktop/api and the bootc extension's
  RPC system. Covers container engine operations, provider management, RPC
  communication, build orchestration, VM management, and configuration. Triggers
  when working on packages/backend/ code, adding RPC methods to BootcAPI,
  implementing container/image operations, or asking about backend patterns.
paths:
  - packages/backend/src/**/*.ts
  - packages/shared/src/**/*.ts
---

# Backend API Development Guide

## Extension API: @podman-desktop/api

The backend runs as a Podman Desktop extension in Node.js. All host interactions
go through `@podman-desktop/api`, which is provided by the Podman Desktop runtime
(not bundled — it's an external dependency).

```typescript
import * as extensionApi from '@podman-desktop/api';
```

### Check API

API signatures change across versions. Read the installed types directly:

1. **Full API types**: Read `node_modules/@podman-desktop/api/index.d.ts`
2. **Current RPC contract**: Read `packages/shared/src/BootcAPI.ts`
3. **Current models**: Read files in `packages/shared/src/models/`
4. **Current messages**: Read `packages/shared/src/messages/Messages.ts`
5. **See existing usage**: `grep -r "extensionApi\." packages/backend/src/`

Always verify method signatures against the actual type definitions before using them.

## RPC Architecture

Frontend ↔ Backend communication uses a typed RPC proxy over webview `postMessage`.

### Adding a New API Method

**Step 1: Define in shared contract** (`packages/shared/src/BootcAPI.ts`):

```typescript
export abstract class BootcApi {
  // ... existing methods
  abstract myNewMethod(param: string): Promise<ResultType>;
}
```

**Step 2: Implement in backend** (`packages/backend/src/api-impl.ts`):

```typescript
export class BootcApiImpl extends BootcApi {
  async myNewMethod(param: string): Promise<ResultType> {
    const result = await extensionApi.containerEngine.listImages();
    return transformResult(result);
  }
}
```

**Step 3: Call from frontend** (automatic — RPC proxy exposes all methods):

```typescript
import { bootcClient } from '/@/api/client';
const result = await bootcClient.myNewMethod('value');
```

### RPC Timeout

Default timeout is 5 seconds per RPC call. For long-running operations, add
the method name to the no-timeout list:

```bash
cat packages/shared/src/messages/NoTimeoutChannels.ts
```

### Sending Notifications (Backend → Frontend)

Push data to the frontend via message IDs. See the current messages:

```bash
cat packages/shared/src/messages/Messages.ts
```

Send from backend:

```typescript
this.panel.webview.postMessage({ id: Messages.MSG_HISTORY_UPDATE, body: data });
```

Frontend subscribes via RPC:

```typescript
import { rpcBrowser } from '/@/api/client';
rpcBrowser.subscribe(Messages.MSG_NAVIGATE_BUILD, (path: string) => {
  router.goto(`/disk-images/build/${path}`);
});
```

## Discovering APIs

APIs change across versions. Always read the source rather than relying on memory.

### @podman-desktop/api

```bash
# Full API surface — the single source of truth
cat node_modules/@podman-desktop/api/index.d.ts

# Find how specific APIs are already used in this codebase
grep -rn "extensionApi\.\(containerEngine\|window\|provider\|navigation\|configuration\|process\|env\)" packages/backend/src/
```

### Internal helpers

```bash
# Key backend modules — read these to find available helpers
ls packages/backend/src/*.ts
ls packages/shared/src/models/
```

## Checklist: Adding a New Backend Feature

1. Add abstract method to `packages/shared/src/BootcAPI.ts`
2. Implement in `packages/backend/src/api-impl.ts`
3. If long-running (>5s), add to `NoTimeoutChannels.ts`
4. If it pushes data to frontend, add a message to `Messages.ts`
5. Add types/models in `packages/shared/src/models/` if needed
6. Add telemetry for usage and errors
7. Write unit tests mocking `@podman-desktop/api`
8. Frontend can call via `bootcClient.myNewMethod()` — no wiring needed
