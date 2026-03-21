# @musher-dev/musher-sdk

Official TypeScript SDK for the [Musher](https://musher.dev) platform. Pull, cache, and load bundled AI agent assets (skills, prompts, tool configs) from the Musher Hub.

## Install

```bash
npm install @musher-dev/musher-sdk
```

## Usage

```typescript
import { MusherClient } from "@musher-dev/musher-sdk";

const client = new MusherClient({
  apiKey: process.env.MUSHER_API_KEY,
});

// Resolve bundle metadata (cache-aware, checks TTL before API call)
const meta = await client.resolve("acme/code-review-kit");

// Pull a bundle (downloads + verifies integrity + caches locally)
const bundle = await client.pull("acme/code-review-kit", "1.2.0");
const systemPrompt = bundle.getAsset("prompts/system.md");
```

## API

See the [main README](../../README.md) for full documentation.

## License

MIT
