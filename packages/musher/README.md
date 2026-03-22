# @musher-dev/musher-sdk

Official TypeScript SDK for the [Musher](https://musher.dev) platform. Pull, cache, and load bundled AI agent assets — skills, prompts, toolsets, and agent specs — from the Musher registry.

## Install

```bash
npm install @musher-dev/musher-sdk
```

## Usage

### Pull and access a bundle

```typescript
import { pull } from "@musher-dev/musher-sdk";

const bundle = await pull("acme/code-review-kit:1.2.0");

// Typed handle access
bundle.prompt("system").content();       // prompt text
bundle.skill("lint-rules").files();      // skill files
bundle.toolset("review-tools").content(); // toolset definition
bundle.agentSpec("reviewer").content();  // agent spec

// Raw file access
bundle.file("prompts/system.md")?.text();
bundle.files();  // all FileHandle[]
```

### Resolve metadata only

```typescript
import { resolve } from "@musher-dev/musher-sdk";

const meta = await resolve("acme/code-review-kit:1.2.0");
console.log(meta.version, meta.ref);
```

### Verify integrity and lock

```typescript
const result = bundle.verify();  // SHA-256 check on every file
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
  exportOpenAIInlineSkill,
  installVSCodeSkills,
} from "@musher-dev/musher-sdk";

// Claude Code — install skills into .claude/skills/<skill-name>/
await installClaudeSkills(bundle, process.cwd());

// OpenAI — export a skill for local shell agents
const local = await exportOpenAILocalSkill(bundle.skill("lint-rules"), "./skills");

// VS Code — install into .agents/skills/
await installVSCodeSkills(bundle, process.cwd());
```

## Key exports

| Export | Kind | Description |
|--------|------|-------------|
| `pull` | function | Pull a bundle (resolve + download + verify + cache) |
| `resolve` | function | Resolve bundle metadata without downloading |
| `configure` | function | Set default client config for convenience functions |
| `MusherClient` | class | Client with custom config, cache management |
| `Bundle` | class | Typed bundle with handle access and verification |
| `BundleRef` | class | Parse and represent `namespace/slug:version` refs |
| `Selection` | class | Lazy filtered view over a bundle |
| `FileHandle` | class | File content access (text, bytes, stream) |
| `SkillHandle` | class | Skill file grouping with definition access |
| `PromptHandle` | class | Single-file prompt with `.content()` |
| `ToolsetHandle` | class | Single-file toolset with `.content()` |
| `AgentSpecHandle` | class | Single-file agent spec with `.content()` |

See [`examples/`](../../examples/) for runnable integration examples.

## License

MIT
