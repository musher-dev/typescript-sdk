# Musher SDK Examples

Runnable TypeScript examples for `@musher-dev/musher-sdk`.

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

| File | Status | Description |
|------|--------|-------------|
| `basics/pull-bundle.ts` | Working | Pull a bundle and access files, prompts, and skills |
| `basics/resolve-bundle.ts` | Working | Resolve metadata without downloading |
| `basics/verify-and-lock-bundle.ts` | Working | Verify SHA-256 integrity and write a lockfile |
| `claude/install-project-skills.ts` | Working | Install skills into `.claude/skills/` |
| `claude/export-plugin.ts` | Working | Export a Claude Code plugin directory |
| `openai/local-shell-skill.ts` | Working | Export a skill as local files for OpenAI Agents |
| `openai/hosted-inline-skill.ts` | Working | Export a skill as an inline base64 ZIP |
| `openai/local-shell-agent.ts` | Working | Full agent with local shell skill via `@openai/agents` |
| `openai/container-inline-agent.ts` | Working | Agent with inline skill in `container_auto` |
| `openai/container-skill-ref.ts` | Working | Upload a skill and use as a `skill_reference` |
| `ide/install-vscode-skills.ts` | Working | Install skills into a VS Code skill tree |

## Runtime packages for integration examples

| Platform | Package |
|----------|---------|
| Claude | `@anthropic-ai/claude-agent-sdk` |
| OpenAI (agents) | `@openai/agents` |
| OpenAI (API client) | `openai` |
