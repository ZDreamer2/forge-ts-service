# @zdreamer/forge-ts-service

Opinionated development-tooling presets for TypeScript services using Node's native TypeScript support. MIT licensed. This is not a server framework and contains no service runtime code.

Source: <https://github.com/ZDreamer2/forge-ts-service>. The initial `0.1.0` release is available on npm; `0.1.1` prepares the first trusted-publishing release without changing presets or toolchain versions. The `0.x` release line makes no promise of compatibility with arbitrary external services.

## Installation

Use Node `>=24.18.1 <25`. The package declares exact tool peers: Biome `2.5.7`, TypeScript `7.0.2`, dependency-cruiser `18.2.0`, SWC `1.16.1`, and Node types `24.13.3`. npm and pnpm install required peers automatically by default and expose their binaries in the consumer. If peer auto-installation is disabled, install these exact versions explicitly. SWC is required: native TypeScript 7 cannot provide dependency-cruiser's classic compiler API.

Install the initial published baseline:

```sh
npm install --save-dev --save-exact @zdreamer/forge-ts-service@0.1.0
```

For an unpublished revision, run `npm pack` here, then install the generated `.tgz` as a development dependency in a separate consumer. Do not use a sibling-source import or `npm link` as proof of packaging.

pnpm users must explicitly allow SWC's lifecycle script in their installation's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  "@swc/core": true
```

## Consumer configuration

`biome.json`:

```json
{
  "extends": ["@zdreamer/forge-ts-service/biome"],
  "files": {
    "includes": ["src/**", "scripts/**", "tools/*.ts", "*.json", "!tools/fixtures"]
  }
}
```

The preset owns formatting, recommended lint rules and the `process.env` restriction. `src/app/**` and `scripts/**` may access the environment; other service code may not. The override cannot distinguish passing the environment into a config loader from parsing individual variables: that distinction still needs review. Each consumer owns coverage and exclusions; do not copy this example's optional paths without checking your layout.

`tsconfig.json`:

```json
{
  "extends": "@zdreamer/forge-ts-service/tsconfig",
  "include": ["src", "scripts", "tools/*.ts"]
}
```

The preset supplies strict ES2024/NodeNext, explicit TypeScript extensions, erasable syntax and no-emit settings. `include`, `exclude`, paths, libraries and application-specific typing remain the consumer's responsibility.

`.dependency-cruiser.mjs`:

```js
import base from "@zdreamer/forge-ts-service/dependency-cruiser";

export default {
  ...base,
  forbidden: [
    ...base.forbidden,
    // Add the service's component dependency map and library-confinement rules here.
  ],
};
```

Run from the **service root**; all graph paths are cwd-relative. The baseline checks the zone arrow `main.ts, scripts/ -> app/ -> components/ -> lib/`, foreign and nested `internal/` boundaries, imported vague names, and cycles (including type imports). `tools/` is outside the service graph. The service owns cruise targets, its component map, external-library boundaries and additional fidelity assertions. The baseline does not default-deny component-to-component edges: the consumer's map must do that. It is not complete enforcement of every design convention (for example, pure surfaces and dependency injection still need review).

Example scripts, for a service that has both source and scripts directories:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "graphcheck": "depcruise --config .dependency-cruiser.mjs \"src/**/*.ts\" \"scripts/**/*.ts\"",
    "test": "node --test",
    "check": "tsc --noEmit && biome check . && depcruise --config .dependency-cruiser.mjs \"src/**/*.ts\" \"scripts/**/*.ts\" && node --test"
  }
}
```

Do not target nonexistent directories. Colocate service tests and keep deliberately invalid checker fixtures out of TypeScript, Biome and Node test discovery. In a workspace, each service must still run architecture checks from its own root; the installation's aggregate gate coordinates packages and UI checks.

## Developing this package

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --config.verify-deps-before-run=error check
```

The checkout is an independent pnpm installation with its own lockfile, exact Node pin and a seven-day release-age floor. Its default cache is `.cache/pnpm`; a hosting checkout can override the store directory. Use the same environment/settings for install and check (in particular, pnpm's CI and interactive installation modes differ).

Tests exercise every shared graph rule against deliberate violations, parser fidelity for type re-exports and legal nested surfaces, and Biome environment boundaries. The package test packs the exact publication artifact, checks its file allowlist, installs it in a temporary clean npm consumer, and verifies all three exports and local extension of the graph rules. **That test requires registry/network access**, installs pinned tool peers, disables dependency lifecycle scripts, and does not publish anything. The normal pnpm development installation allows SWC's postinstall explicitly.

The tarball contains only presets, package metadata, this README and the license. Regression tests and deliberately invalid fixtures stay in the source repository. There are no package lifecycle release hooks or publishing credentials. GitHub Actions runs the checks and uploads an inspectable tarball; the manual `publish.yml` workflow defaults to a dry-run and supports npm trusted publishing with provenance after npm-side configuration. See [release operations](https://github.com/ZDreamer2/forge-ts-service/blob/main/docs/releasing.md) for the owner-operated initial publication, exact trusted-publisher fields and subsequent releases. The `0.1.0` npm bootstrap is complete; trusted-publisher configuration and migration of existing consumers remain separate steps.
