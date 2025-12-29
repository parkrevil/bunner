# @bunner/cli

**[한국어](./README.ko.md)** | English

The official CLI toolkit for [Bunner](https://github.com/parkrevil/bunner) — A blazing-fast, Bun-native server framework with Ahead-of-Time (AOT) compilation.

[![Bun](https://img.shields.io/badge/Bun-v1.0%2B-000?logo=bun)](https://bun.sh)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [`bunner dev`](#bunner-dev)
  - [`bunner build`](#bunner-build)
- [Architecture](#architecture)
  - [Analyzer Module](#analyzer-module)
  - [Generator Module](#generator-module)
  - [Watcher Module](#watcher-module)
- [Configuration](#configuration)
- [Generated Artifacts](#generated-artifacts)
- [Public API](#public-api)
- [Limitations](#limitations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

`@bunner/cli` is the command-line interface for the Bunner framework. It provides essential developer tooling for AOT (Ahead-of-Time) compilation, enabling:

- **Static analysis** of TypeScript source files
- **Dependency graph construction** across modules
- **Code generation** for optimized runtime bootstrap
- **Hot-reload development** with file watching

The CLI ensures your application is analyzed and optimized at build time, eliminating runtime reflection overhead and enabling faster startup times.

## Features

- 🚀 **AOT Compilation** — Analyzes decorators, dependencies, and module structure at build time
- 🔍 **TypeScript AST Parsing** — Powered by [oxc-parser](https://github.com/nicodemus-ouma/oxc-parser) for blazing-fast parsing
- 📦 **Module Graph Resolution** — Automatic discovery and validation of module boundaries
- 🔄 **Hot Reload** — Watch mode with incremental rebuilds for rapid development
- ✅ **Visibility & Scope Validation** — Compile-time checks for dependency injection constraints
- 🔁 **Circular Dependency Detection** — Detects and reports module-level cycles

## Requirements

| Requirement    | Version       | Notes                                                  |
| -------------- | ------------- | ------------------------------------------------------ |
| **Bun**        | `≥ 1.0.0`     | Required runtime                                       |
| **TypeScript** | `≥ 5.0`       | Source files must be TypeScript                        |
| **Node.js**    | Not supported | This CLI is Bun-only; Node.js runtime is not supported |

> **Note**: This package uses Bun-specific APIs (`Bun.build()`, `Bun.file()`, `Bun.spawn()`) and cannot run on Node.js.

## Installation

```bash
bun add -d @bunner/cli
```

Or install globally:

```bash
bun add -g @bunner/cli
```

## Quick Start

1. **Create your project structure:**

```text
my-app/
├── src/
│   ├── main.ts          # Application entry point
│   └── __module__.ts    # Root module definition
├── bunner.config.ts     # CLI configuration (optional)
└── package.json
```

1. **Run the development server:**

```bash
bunner dev
```

1. **Build for production:**

```bash
bunner build
```

## Commands

### `bunner dev`

Starts the development environment with AOT artifact generation and file watching.

```bash
bunner dev
```

**What it does:**

1. Scans all `.ts` files in `src/` directory
2. Parses and extracts class metadata, decorators, and module definitions
3. Builds a module dependency graph
4. Generates AOT artifacts in `.bunner/` directory:
   - `injector.ts` — Dependency injection container setup
   - `manifest.ts` — Runtime metadata registry
   - `index.ts` — Application entry point
5. Watches for file changes and incrementally rebuilds

**Output:**

```text
🚀 Starting Bunner Dev...
🛠️  AOT artifacts generated.
   Entry: .bunner/index.ts
```

### `bunner build`

Creates a production-ready bundle with all optimizations applied.

```bash
bunner build
```

**What it does:**

1. Performs full source analysis (same as `dev`)
2. Builds the module graph with validation
3. Generates intermediate manifests in `.bunner/`
4. Bundles application, manifest, and workers using `Bun.build()`
5. Outputs to `dist/` directory

**Output:**

```text
🚀 Starting Bunner Production Build...
📂 Project Root: /path/to/my-app
📂 Source Dir: /path/to/my-app/src
📂 Output Dir: /path/to/my-app/dist
🔍 Scanning source files...
🕸️  Building Module Graph...
🛠️  Generating intermediate manifests...
📦 Bundling application, manifest, and workers...
✅ Build Complete!
   Entry: dist/entry.js
   Manifest: dist/manifest.js
```

## Architecture

The CLI is structured into three main modules:

### Analyzer Module

Located in `src/analyzer/`, responsible for static analysis of TypeScript source code.

| Component         | Description                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `AstParser`       | Parses TypeScript files using oxc-parser; extracts classes, decorators, imports, and module definitions |
| `AstTypeResolver` | Resolves type annotations to their string representations                                               |
| `ModuleDiscovery` | Discovers `__module__.ts` files and assigns ownership of source files                                   |
| `ModuleGraph`     | Builds dependency graph, validates visibility/scope rules, detects cycles                               |
| `ModuleNode`      | Represents a single module with its providers, controllers, and exports                                 |

### Generator Module

Located in `src/generator/`, responsible for code generation.

| Component           | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `InjectorGenerator` | Generates DI container setup code with factory functions |
| `ManifestGenerator` | Generates runtime metadata registry for reflection       |
| `EntryGenerator`    | Generates application bootstrap entry point              |
| `ImportRegistry`    | Manages import deduplication and aliasing                |
| `MetadataGenerator` | Generates type metadata for OpenAPI/validation           |

### Watcher Module

Located in `src/watcher/`, provides file system watching for development mode.

| Component        | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `ProjectWatcher` | Watches source directories for changes and triggers rebuilds |

## Configuration

Create a `bunner.config.ts` in your project root:

```typescript
import type { BunnerConfig } from '@bunner/cli';

export default {
  // Number of worker processes (0 = auto, 'full' = all cores, 'half' = half cores)
  workers: 1,

  // Additional paths to scan for modules
  scanPaths: ['../packages/shared/src'],
} satisfies BunnerConfig;
```

### Configuration Options

| Option      | Type                                   | Default  | Description                                |
| ----------- | -------------------------------------- | -------- | ------------------------------------------ |
| `workers`   | `number \| 'full' \| 'half' \| string` | `'half'` | Worker count configuration                 |
| `scanPaths` | `string[]`                             | `[]`     | Additional directories to scan for modules |

## Generated Artifacts

The CLI generates the following files in `.bunner/` (dev) or `dist/` (build):

### `injector.ts`

Contains the `createContainer()` function that sets up the DI container:

```typescript
import { Container } from '@bunner/core';

export function createContainer() {
  const container = new Container();

  container.set('AppModule::UserService', c => new UserService(c.get('AppModule::UserRepository')));
  // ... more providers

  return container;
}

export const adapterConfig = deepFreeze({
  // Adapter configurations from __module__.ts
});
```

### `manifest.ts`

Contains runtime metadata for the application:

```typescript
export function createScopedKeysMap() {
  return new Map([
    ['UserService', 'AppModule::UserService'],
    // ... scoped token mappings
  ]);
}
```

### `index.ts` (Entry)

The bootstrap entry point that initializes the container and loads your application:

```typescript
const isWorker = !!process.env.BUNNER_WORKER_ID;

if (!isWorker) {
  // Master process - start workers or run directly
  await bootstrap();
} else {
  await bootstrap();
}

async function bootstrap() {
  const manifest = await import('./manifest.ts');
  const container = manifest.createContainer();

  globalThis.__BUNNER_CONTAINER__ = container;

  await import('./src/main.ts');
}
```

## Public API

The CLI exposes a minimal public API for tooling integration:

```typescript
import { BunnerCliError } from '@bunner/cli';
import { TypeMetadata } from '@bunner/cli';
```

| Export           | Description                                   |
| ---------------- | --------------------------------------------- |
| `BunnerCliError` | Base error class for CLI-related errors       |
| `TypeMetadata`   | Type metadata interface for generator outputs |

## Limitations

The following features are **not yet supported**:

| Feature                         | Status     | Notes                                      |
| ------------------------------- | ---------- | ------------------------------------------ |
| JavaScript source files         | ❌         | Only `.ts` files are analyzed              |
| Dynamic `import()` in providers | ❌         | Static imports only                        |
| Decorator metadata preservation | ⚠️ Partial | Only specific decorators are recognized    |
| Monorepo workspace resolution   | ⚠️ Partial | Use `scanPaths` for cross-package scanning |
| Incremental type checking       | ❌         | Full re-analysis on each change            |
| Source maps in dev mode         | ❌         | Planned for future release                 |

### Not Planned

- **Node.js compatibility** — This is a Bun-native framework
- **CommonJS modules** — ESM only
- **Class-based module decorators** — Uses `__module__.ts` file convention instead

## Troubleshooting

### Common Errors

#### `Error: Cannot find __module__.ts`

**Cause**: The CLI expects a `__module__.ts` file in each module directory.

**Solution**: Create a `__module__.ts` file:

```typescript
import type { BunnerModule } from '@bunner/common';

export const module: BunnerModule = {
  name: 'MyModule',
  providers: [],
};
```

#### `Visibility Violation: '...' is NOT exported`

**Cause**: A provider in Module A is trying to inject a provider from Module B that isn't marked as exported.

**Solution**: Add `visibility: 'exported'` to the provider's `@Injectable` decorator:

```typescript
@Injectable({ visibility: 'exported' })
export class SharedService {}
```

#### `Circular dependency detected`

**Cause**: Module A depends on Module B, which depends on Module A.

**Solution**:

- Refactor to break the cycle
- Extract shared dependencies to a third module
- Use `forwardRef()` for constructor injection (not recommended)

#### Build fails with `oxc-parser` errors

**Cause**: Syntax not supported by oxc-parser or malformed TypeScript.

**Solution**:

- Ensure your TypeScript is valid (`bun tsc --noEmit`)
- Check for experimental syntax that may not be supported

### FAQ

**Q: Can I use this with an existing NestJS project?**

A: No. Bunner uses a different module system (`__module__.ts` files) and is not compatible with NestJS decorators.

**Q: Do I need to run `bunner dev` and `bun run` separately?**

A: `bunner dev` only generates AOT artifacts. You need to run your application separately with `bun .bunner/index.ts` or configure your `package.json` scripts.

**Q: Why are my changes not reflected?**

A: Ensure the watcher is running. Check for parse errors in the console output.

## Contributing

We welcome contributions! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © [ParkRevil](https://github.com/parkrevil)

---

<p align="center">
  Built with ❤️ for the Bun ecosystem
</p>
