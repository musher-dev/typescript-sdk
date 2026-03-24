# Musher TypeScript SDK

Lightweight bundle loader/cache library for the Musher platform.

## Verification

`task check` runs format + lint + types + tests. `task build` produces ESM+CJS dual output.

## Toolchain

| Tool | Purpose |
|------|---------|
| [Task](https://taskfile.dev) | Task runner |
| pnpm | Package manager |
| Biome | Format + lint |
| TypeScript | Type checking |
| tsup | Bundler (ESM+CJS) |
| Vitest | Test runner |
| Zod | Runtime schema validation |

## Code Standards

- **MUST** validate API responses with Zod schemas at runtime
- **MUST** use camelCase for all wire-format fields (matches API)
- **MUST** keep `zod` as the only runtime dependency (use `node:*` built-ins)
- **SHOULD** prefer explicit error types over generic throws
