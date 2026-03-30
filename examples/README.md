# Musher SDK Examples

Runnable TypeScript examples for [`@musher-dev/musher-sdk`](../packages/musher/).

Examples are organized into four categories: **basics** (core SDK operations), **claude** (Claude Code integration), **openai** (OpenAI Agents integration), and **ide** (VS Code integration).

## Prerequisites

- **Node.js** >= 20
- **Musher API key** — set `MUSHER_API_KEY` in your environment (or run `musher login`)
- From the repo root: `pnpm install && task build`

**OpenAI examples** additionally require:
- `OPENAI_API_KEY` environment variable
- `@openai/agents` (and `openai` for the skill-reference example)

## Running

```bash
npx tsx examples/basics/pull-bundle.ts
```

## Examples

| File | Bundle | Status | Description |
|------|--------|--------|-------------|
| `basics/pull-bundle.ts` | `code-review-kit` | Working | Pull a bundle and access files, prompts, and skills |
| `basics/resolve-bundle.ts` | `code-review-kit` | Working | Resolve metadata without downloading |
| `basics/verify-and-lock-bundle.ts` | `code-review-kit` | Working | Verify SHA-256 integrity and write a lockfile |
| `basics/explore-all-assets.ts` | `agent-toolkit` | Working | Enumerate skills, prompts, toolsets, and agent specs |
| `basics/select-and-materialize.ts` | `agent-toolkit` | Working | Filter a bundle to a subset and write to disk |
| `basics/cache-management.ts` | `code-review-kit` | Working | Inspect, invalidate, and clean the local cache |
| `basics/configure-client.ts` | `prompt-library` | Working | Configure the default client, binary and stream access |
| `claude/install-project-skills.ts` | `code-review-kit` | Working | Install skills into `.claude/skills/` |
| `claude/export-plugin.ts` | `code-review-kit` | Working | Export a Claude Code plugin directory |
| `openai/local-shell-skill.ts` | `code-review-kit` | Working | Export a skill as local files for OpenAI Agents |
| `openai/hosted-inline-skill.ts` | `code-review-kit` | Working | Export a skill as an inline base64 ZIP |
| `openai/local-shell-agent.ts` | `code-review-kit` | Working | Full agent with local shell skill via `@openai/agents` |
| `openai/container-inline-agent.ts` | `code-review-kit` | Working | Agent with inline skill in `container_auto` |
| `openai/container-skill-ref.ts` | `code-review-kit` | Working | Upload a skill and use as a `skill_reference` |
| `ide/install-vscode-skills.ts` | `code-review-kit` | Working | Install skills into a VS Code skill tree |

## Example bundles

These examples use public bundles from the [`musher-examples`](https://hub.musher.dev/) namespace:

| Bundle | Version | Asset Types |
|--------|---------|-------------|
| `musher-examples/code-review-kit` | 1.2.0 | Skills, Prompts |
| `musher-examples/agent-toolkit` | 2.0.0 | Skills, Prompts, Toolsets, Agent Specs, Configs, Rules |
| `musher-examples/prompt-library` | 1.2.0 | Prompts, Toolsets, Agent Specs |

## Runtime packages for integration examples

| Platform | Package |
|----------|---------|
| Claude | `@anthropic-ai/claude-agent-sdk` |
| OpenAI (agents) | `@openai/agents` |
| OpenAI (API client) | `openai` |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `AuthenticationError` | Set `MUSHER_API_KEY` in your environment or run `musher login` |
| `NotFoundError` | Check the bundle ref — examples use the `musher-examples/` namespace |
| `TimeoutError` or network failures | Check connectivity; override timeout via `new MusherClient({ timeout: 120000 })` |

## See also

- [SDK reference](../packages/musher/README.md) — full API documentation
- [Security policy](../SECURITY.md) — reporting vulnerabilities
