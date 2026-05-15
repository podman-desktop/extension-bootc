# AGENTS.md

## Project Overview

Bootable Container (bootc) extension for Podman Desktop. Converts container images
with bootc labels (`ostree.bootable`, `containers.bootc`) into bootable disk images
(qcow2, ami, raw, vmdk, vhd, gce, anaconda-iso) using bootc-image-builder. Also
manages Macadam-based virtual machines from built disk images.

- **Tech stack**: TypeScript, Svelte 5, Tailwind CSS, Vite, pnpm
- **Monorepo**: pnpm workspaces with three packages — `backend`, `frontend`, `shared`
- **Extension API**: `@podman-desktop/api`
- **VM management**: `@crc-org/macadam.js` (Apple HV, WSL, Hyper-V)
- **Test frameworks**: Vitest (unit), Playwright with `@podman-desktop/tests-playwright` (E2E)
- **License**: Apache-2.0

## Quick Start

```sh
pnpm install
pnpm build
```

## Essential Commands

```sh
# Build
pnpm build                    # build all packages (frontend → backend/media/)

# Test
pnpm test                     # all unit tests (backend + frontend + shared)
pnpm test:backend             # backend unit tests with coverage
pnpm test:frontend            # frontend unit tests with coverage
pnpm test:shared              # shared unit tests with coverage
pnpm test:e2e                 # playwright E2E tests

# Lint & Format
pnpm lint:check               # ESLint check
pnpm lint:fix                 # ESLint fix
pnpm format:check             # Biome + Prettier check
pnpm format:fix               # Biome + Prettier fix
pnpm typecheck                # TypeScript type checking across all packages
pnpm svelte:check             # Svelte component validation

# Pre-PR checklist (run all of these)
pnpm format:fix && pnpm lint:fix && pnpm typecheck && pnpm test
```

## Skills

Task-specific guidance lives in `.agents/skills/`:

- `extension-development` — end-to-end feature work across backend/frontend
- `backend-api` — backend and RPC changes
- `svelte-ui-design` — Svelte 5 and Podman Desktop UI patterns
- `unit-testing` — Vitest patterns for backend/frontend/shared
- `playwright-testing` — E2E structure, lifecycle, and commands

## Architecture

Frontend (Svelte webview) ←→ RPC (postMessage via MessageProxy) ←→ Backend (Node.js)

- **Frontend**: `App.svelte`, stores — see **svelte-ui-design** skill
- **Backend**: `extension.ts`, `BootcApiImpl`, `@podman-desktop/api` — see **backend-api** skill
- **Shared**: `BootcAPI` contract, models, messages

Three packages under `packages/`:

- **`backend/`** — Extension entry point (Node.js). Entry: `src/extension.ts`, RPC handler: `src/api-impl.ts`. Built output: `dist/extension.js`
- **`frontend/`** — Svelte 5 webview UI. Root router: `src/App.svelte`. Builds to `../backend/media/`
- **`shared/`** — Shared types and RPC. API contract: `src/BootcAPI.ts`, models: `src/models/`, messages: `src/messages/`
- **`tests/playwright/`** — E2E tests with Page Object Models in `src/model/`

### Communication

Frontend ↔ Backend via RPC MessageProxy over webview postMessage:

- `RpcExtension` (backend) registers `BootcApiImpl`
- `RpcBrowser` (frontend) calls methods via `api/client.ts`
- Notification messages defined in `packages/shared/src/messages/Messages.ts`

### Extension Registration

Extension points (commands, menus, configuration, icons, views) are defined in
`packages/backend/package.json` under `contributes`.

## Coding Guidelines

### Svelte Patterns

This project uses **Svelte 5 runes** (`$state`, `$derived`, `$effect`). Do NOT use legacy reactive syntax (`$:`, `let x = writable()`). For concrete layout, store, and component patterns, use `.agents/skills/svelte-ui-design/SKILL.md`.

### Testing Patterns

Use `.agents/skills/unit-testing/SKILL.md` for unit-test patterns and `.agents/skills/playwright-testing/SKILL.md` for E2E patterns. Backend tests mock `@podman-desktop/api`, frontend tests use `@testing-library/svelte`, and path aliases remain `/@/` → `src/`, `/@shared/` → `../../shared/`.

### Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add VHD build type support
fix: handle missing SSH key gracefully
chore: bump eslint-plugin-unicorn
docs: update RELEASE.md with E2E instructions
```

Enforced by commitlint + husky pre-commit hooks.

### Import Path Aliases

Use aliases for import paths.

```typescript
// Backend
import { foo } from '/@/bar'; // → packages/backend/src/bar
import { Baz } from '/@shared/src/x'; // → packages/shared/src/x

// Frontend
import { foo } from '/@/bar'; // → packages/frontend/src/bar
import { Baz } from '/@shared/src/x'; // → packages/shared/src/x
```
