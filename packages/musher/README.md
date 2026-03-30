# @musher-dev/musher-sdk

[![npm](https://img.shields.io/npm/v/@musher-dev/musher-sdk)](https://www.npmjs.com/package/@musher-dev/musher-sdk)
[![CI](https://github.com/musher-dev/typescript-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/musher-dev/typescript-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)

Official TypeScript SDK for the [Musher](https://musher.dev) platform. Pull, cache, and load bundled AI agent assets — skills, prompts, toolsets, and agent specs — from the Musher registry.

- **One function to get started** — `pull()` resolves, downloads, verifies, and caches a bundle
- **Content-addressable disk cache** — SHA-256 integrity checks, deduplication, and TTL-based freshness
- **Typed asset handles** — first-class accessors for skills, prompts, toolsets, and agent specs
- **Platform adapters** — drop bundles into Claude Code, OpenAI Agents, or VS Code with one call
- **Lightweight** — single runtime dependency (`zod`); ESM + CJS dual output

## Install

```bash
npm install @musher-dev/musher-sdk
```

## Authentication

Set your API key as an environment variable (recommended for CI/CD):

```bash
export MUSHER_API_KEY="msk_..."
```

The SDK resolves credentials in this order:

1. Explicit `apiKey` in `ClientConfig`
2. `MUSHER_API_KEY` environment variable
3. OS keyring (macOS Keychain, Linux `secret-tool`)
4. Credential file at `{data}/credentials/{host}/api-key` (must be `chmod 600`)

## Usage

### Pull and access a bundle

```typescript
import { pull } from "@musher-dev/musher-sdk";

const bundle = await pull("acme/code-review-kit:1.2.0");

// Typed handle access
bundle.prompt("system").content();        // prompt text
bundle.skill("lint-rules").files();       // skill files
bundle.toolset("review-tools").content(); // toolset JSON
bundle.agentSpec("reviewer").content();   // agent spec

// Raw file access
bundle.file("prompts/system.md")?.text();
bundle.files(); // all FileHandle[]
```

### Resolve metadata only

```typescript
import { resolve } from "@musher-dev/musher-sdk";

const meta = await resolve("acme/code-review-kit:1.2.0");
console.log(meta.version, meta.ref);
```

### Select and materialize

Filter a bundle to a subset and write it to disk:

```typescript
const selection = bundle.select({
  skills: ["lint-rules"],
  prompts: ["system"],
});

selection.files();   // only matching FileHandle[]
await selection.materialize("./output"); // write to disk
```

### Cache management

```typescript
import { MusherClient } from "@musher-dev/musher-sdk";

const client = new MusherClient();

const stats = await client.cache.stats();
console.log(stats.entryCount, stats.blobSizeBytes);

const entries = await client.cache.list();
await client.cache.invalidate("acme", "code-review-kit");
await client.cache.clean(); // remove expired entries
```

### Verify integrity and lock

```typescript
const result = bundle.verify(); // SHA-256 check on every file
console.log(result.ok, result.errors);

await bundle.writeLockfile("./musher-lock.json");
```

### Custom client configuration

```typescript
import { MusherClient } from "@musher-dev/musher-sdk";

const client = new MusherClient({
  cacheDir: "/tmp/musher-cache",
  manifestTtlSeconds: 3600,
});

const bundle = await client.pull("acme/code-review-kit:1.2.0");
```

### Platform adapters

```typescript
import {
  installClaudeSkills,
  exportClaudePlugin,
  exportOpenAILocalSkill,
  installVSCodeSkills,
} from "@musher-dev/musher-sdk";

// Claude Code — install skills into .claude/skills/
await installClaudeSkills(bundle, process.cwd());

// Claude Code — export as a plugin directory
await exportClaudePlugin(bundle, { targetDir: "./my-plugin" });

// OpenAI Agents — export a skill for local shell agents
await exportOpenAILocalSkill(bundle.skill("lint-rules"), "./skills");

// VS Code — install into .agents/skills/
await installVSCodeSkills(bundle, process.cwd());
```

## Error handling

All errors extend `MusherError` for unified catching:

```
MusherError
├── ApiError (.status, .problem)
│   ├── NotFoundError
│   ├── AuthenticationError
│   ├── ForbiddenError
│   ├── ValidationError (.errors)
│   └── RateLimitError (.retryAfter)
├── NetworkError
│   └── TimeoutError
├── CacheError
│   └── IntegrityError (.expected, .actual)
├── SchemaError
└── BundleAssetNotFoundError (.assetType, .assetName)
```

```typescript
import { pull, MusherError, NotFoundError } from "@musher-dev/musher-sdk";

try {
  const bundle = await pull("acme/missing-bundle:1.0.0");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.error("Bundle not found:", err.problem.detail);
  } else if (err instanceof MusherError) {
    console.error("Musher error:", err.message);
  }
}
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `MUSHER_API_KEY` | API key for authentication |
| `MUSHER_API_URL` | Override API base URL (default: `https://api.musher.dev`) |
| `MUSHER_HOME` | Override all directories: `{MUSHER_HOME}/{cache,config,data,state}` |
| `MUSHER_CACHE_HOME` | Override cache directory (takes precedence over `MUSHER_HOME`) |
| `MUSHER_CONFIG_HOME` | Override config directory |
| `MUSHER_DATA_HOME` | Override data directory |
| `MUSHER_STATE_HOME` | Override state directory |

Default directories follow platform conventions: XDG on Linux, `~/Library` on macOS, `%LOCALAPPDATA%` on Windows.

## Key exports

| Export | Kind | Description |
|--------|------|-------------|
| `pull` | function | Pull a bundle (resolve + download + verify + cache) |
| `resolve` | function | Resolve bundle metadata without downloading |
| `configure` | function | Set default client config for convenience functions |
| `getClient` | function | Get the global `MusherClient` singleton |
| `MusherClient` | class | Client with custom config, cache, and bundle operations |
| `Bundle` | class | Typed bundle with handle access and verification |
| `BundleRef` | class | Parse and represent `namespace/slug:version` refs |
| `Selection` | class | Lazy filtered view over a bundle |
| `FileHandle` | class | File content access (`.text()`, `.bytes()`, `.stream()`) |
| `SkillHandle` | class | Skill file grouping with definition access |
| `PromptHandle` | class | Single-file prompt with `.content()` |
| `ToolsetHandle` | class | Single-file toolset with `.content()` |
| `AgentSpecHandle` | class | Single-file agent spec with `.content()` |
| `MusherError` | class | Base error class for all SDK errors |
| `installClaudeSkills` | function | Install skills into `.claude/skills/` |
| `exportClaudePlugin` | function | Export a Claude Code plugin directory |
| `exportOpenAILocalSkill` | function | Export a skill for OpenAI local shell agents |
| `exportOpenAIInlineSkill` | function | Export a skill as inline base64 ZIP |
| `installVSCodeSkills` | function | Install skills into VS Code skill tree |
| `resolveMusherDirs` | function | Resolve platform-specific Musher directories |

Types: `ClientConfig`, `CacheManager`, `CacheEntry`, `CacheStats`, `SelectionFilter`, `VerifyResult`, `BundleResolveOutput`, and [more](./src/types.ts).

See [`examples/`](../../examples/) for runnable integration examples.

## License

MIT
