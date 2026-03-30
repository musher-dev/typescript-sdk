# Musher TypeScript SDK

[![npm](https://img.shields.io/npm/v/@musher-dev/musher-sdk)](https://www.npmjs.com/package/@musher-dev/musher-sdk)
[![CI](https://github.com/musher-dev/typescript-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/musher-dev/typescript-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)

Official TypeScript SDK for the [Musher](https://musher.dev) platform. Pull, cache, and load bundled AI agent assets — skills, prompts, toolsets, and agent specs — with typed handles, content-addressable caching, and platform adapters for Claude Code, OpenAI Agents, and VS Code.

## Packages

| Package | Description |
|---------|-------------|
| [`@musher-dev/musher-sdk`](./packages/musher/) | Bundle loader and cache client |

## Quick Start

```bash
npm install @musher-dev/musher-sdk
```

```typescript
import { pull } from "@musher-dev/musher-sdk";

// Pull a bundle — resolves, downloads, verifies integrity, and caches locally
const bundle = await pull("acme/code-review-kit:1.2.0");

// Read a prompt by name
console.log(bundle.prompt("system").content());

// Access a skill
const skill = bundle.skill("lint-rules");
console.log(skill.definition()?.text());

// Raw file access
const file = bundle.file("prompts/system.md");
console.log(file?.text());
```

## More Capabilities

Resolve metadata without downloading:

```typescript
import { resolve } from "@musher-dev/musher-sdk";

const meta = await resolve("acme/code-review-kit:1.2.0");
console.log(meta.version);
```

Custom client configuration:

```typescript
import { MusherClient } from "@musher-dev/musher-sdk";

const client = new MusherClient({
  cacheDir: "/tmp/musher-cache",
  manifestTtlSeconds: 3600,
});

const bundle = await client.pull("acme/code-review-kit:1.2.0");
```

Cache management:

```typescript
const stats = await client.cache.stats();
console.log(stats.entryCount, stats.blobSizeBytes);
await client.cache.clean();
```

Filter and materialize a subset:

```typescript
const selection = bundle.select({ skills: ["lint-rules"], prompts: ["system"] });
await selection.materialize("./output");
```

Error handling:

```typescript
import { pull, NotFoundError, MusherError } from "@musher-dev/musher-sdk";

try {
  await pull("acme/missing:1.0.0");
} catch (err) {
  if (err instanceof NotFoundError) console.error(err.problem.detail);
}
```

## Authentication

Set `MUSHER_API_KEY` in your environment, or see the [package docs](./packages/musher/README.md#authentication) for all credential resolution options.

## Platform Adapters

Install bundles directly into your AI toolchain:

- **Claude Code** — `installClaudeSkills()`, `exportClaudePlugin()` ([examples](./examples/claude/))
- **OpenAI Agents** — `exportOpenAILocalSkill()`, `exportOpenAIInlineSkill()` ([examples](./examples/openai/))
- **VS Code** — `installVSCodeSkills()` ([examples](./examples/ide/))

See [`examples/`](./examples/) for 15 runnable examples covering basic operations and platform integrations.

## Development

```bash
pnpm install
task check   # format + lint + types + test
task build   # produce dist/
```

## License

MIT
