# Musher TypeScript SDK

Official TypeScript SDK for the [Musher](https://musher.dev) platform.

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

Resolve metadata without downloading:

```typescript
import { resolve } from "@musher-dev/musher-sdk";

const meta = await resolve("acme/code-review-kit:1.2.0");
console.log(meta.version);
```

Use `MusherClient` directly when you need custom configuration:

```typescript
import { MusherClient } from "@musher-dev/musher-sdk";

const client = new MusherClient({
  cacheDir: "/tmp/musher-cache",
  manifestTtlSeconds: 3600,
});

const bundle = await client.pull("acme/code-review-kit:1.2.0");
```

See [`examples/`](./examples/) for more complete runnable examples including Claude, OpenAI, and VS Code integrations.

## Development

```bash
pnpm install
task check   # format + lint + types + test
task build   # produce dist/
```

## License

MIT
