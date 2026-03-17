# @musher-dev/musher

Official TypeScript SDK for the [Musher](https://musher.dev) platform. Pull, cache, and load bundled AI agent assets (skills, prompts, tool configs) from the Musher Hub.

## Install

```bash
npm install @musher-dev/musher
```

## Usage

```typescript
import { MusherClient } from "@musher-dev/musher";

const client = new MusherClient({
  apiKey: process.env.MUSHER_API_KEY,
});

// Browse the public hub
const results = await client.hub.search({ query: "code-review" });

// Pull a bundle (downloads + caches locally)
const cached = await client.pull("acme/code-review-kit");

// Load into memory (cache-first, pulls if stale)
const bundle = await client.load("acme/code-review-kit", "1.2.0");
const systemPrompt = bundle.getAsset("prompts/system.md");
```

## API

See the [main README](../../README.md) for full documentation.

## License

MIT
