# Musher TypeScript SDK

Official TypeScript SDK for the [Musher](https://musher.dev) platform.

## Packages

| Package | Description |
|---------|-------------|
| [`@musher-dev/musher`](./packages/musher/) | Bundle loader and cache client |

## Quick Start

```bash
npm install @musher-dev/musher
```

```typescript
import { MusherClient } from "@musher-dev/musher";

const client = new MusherClient({ apiKey: process.env.MUSHER_API_KEY });

// Pull and cache a bundle
const bundle = await client.pull("acme/my-agent-skills");

// Load assets into memory
const loaded = await client.load("acme/my-agent-skills", "1.0.0");
const prompt = loaded.getAsset("prompts/system.md");
```

## Development

```bash
pnpm install
task check   # format + lint + types + test
task build   # produce dist/
```

## License

MIT
