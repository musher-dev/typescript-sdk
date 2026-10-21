# Configuration Guide

**Philosophy: One need, one place.** Every configuration concern maps to exactly one canonical location. If you're unsure where something goes, use the decision tree below.

## Decision Tree

```
Where does my configuration go?

Language runtime or system package?
  → devcontainer.json → features block

CLI tool installed via curl/npm?
  → scripts/lib/base-setup.sh (add a function, call from post-create.sh)

Infrastructure service (DB, cache, queue, storage)?
  → compose/*.yaml (new file, add to compose.yaml includes)

VS Code editor behavior or extension?
  → devcontainer.json → customizations.vscode block

Credential or per-developer toggle?
  → .devcontainer/.env (copy from .env.example)

Service-internal configuration (tuning, pipelines)?
  → config/<service>/ directory

Shell aliases, oh-my-zsh plugins, or shell functions?
  → config/shell/ directory

One-time setup step?
  → scripts/post-create.sh

Runs on every container start?
  → scripts/startup.sh

Runs every time an editor attaches?
  → scripts/post-attach.sh
```

## Quick Reference

| Category | Need | Canonical Location |
|---|---|---|
| **Runtimes & Tools** | Language runtimes (Node, Python, Go, Java, Deno) | `devcontainer.json` → `features` |
| | Package managers (bun, uv) | `devcontainer.json` → `features` |
| | CLI tools (Task, Codex) | `scripts/lib/base-setup.sh` |
| **Editor** | VS Code settings (formatters, rulers, whitespace) | `devcontainer.json` → `customizations.vscode.settings` |
| | VS Code extensions | `devcontainer.json` → `customizations.vscode.extensions` |
| | Debug launch configs | `.vscode/launch.json` (in consuming project) |
| **Shell & User** | Default shell, prompt, oh-my-zsh config | `devcontainer.json` → `common-utils` feature |
| | Shell aliases, functions, plugins | `.devcontainer/config/shell/` |
| | Shell and REPL history | `shell-history` volume; `HISTFILE` lines from `lib/base-setup.sh` |
| | Git config | Host `.gitconfig`, copied in by VS Code after post-create |
| | GitHub credential for gh and git | `lib/github-auth.sh` (post-create seeds, post-attach wires) |
| | Git hooks | Project repo (`.husky/` or `.githooks/`) |
| **Environment** | Runtime behavior vars (`PYTHONUNBUFFERED`, etc.) | `devcontainer.json` → `containerEnv` |
| | PATH extensions | `devcontainer.json` → `remoteEnv` |
| | Service credentials (dev-only) | `.devcontainer/.env` |
| | Service profiles/toggles | `.devcontainer/.env` → `COMPOSE_PROFILES` |
| | Secrets (API keys, tokens) | Host env forwarded via `remoteEnv` — never committed |
| **Services** | Infrastructure services | `.devcontainer/compose/*.yaml` |
| | Service enable/disable | `.devcontainer/.env` → `COMPOSE_PROFILES` |
| | Service tuning/config | `.devcontainer/config/<service>/` |
| **Networking** | Port allocation (container-side) | `.devcontainer/compose/*.yaml` → `ports:` |
| | Port forwarding (to host IDE) | `devcontainer.json` → `forwardPorts` + `portsAttributes` |
| | Service discovery | Automatic via Docker Compose `musher-dev` network |
| **Observability** | Telemetry pipeline config | `.devcontainer/config/observability/otel-collector-config.yaml` |
| | Grafana dashboards | `.devcontainer/config/observability/grafana/provisioning/dashboards/json/` |
| | Grafana datasources | `.devcontainer/config/observability/grafana/provisioning/datasources/` |
| **Data** | DB schema init (base) | `.devcontainer/config/postgres/00-init.sql` |
| | DB schema init (project) | `.devcontainer/config/postgres/01-project.sql` |
| | DB migrations | Project tooling (Atlas, Flyway — not in template) |
| | Data persistence | Compose files → named volumes |
| | What a rebuild keeps | `devcontainer.json` → `mounts` (see "What a Rebuild Keeps") |
| **Lifecycle** | One-time container setup | `scripts/post-create.sh` → `lib/base-setup.sh` |
| | Every-start tasks | `scripts/startup.sh` |
| | Every-attach tasks | `scripts/post-attach.sh` |
| | Task automation | `Taskfile.yml` (in consuming project) |
| **AI Tools** | AI CLI installation | `lib/base-setup.sh` (Claude Code's native installer, Codex) |
| | AI CLI config persistence | `devcontainer.json` → `mounts` (named volumes), `CLAUDE_CONFIG_DIR` |
| | Claude Code's default effort | `devcontainer.json` → `containerEnv` → `CLAUDE_CODE_EFFORT_LEVEL` |
| **Security** | Container capabilities | `devcontainer.json` → `capAdd` / `securityOpt` |
| | Network binding | Compose files → all ports bound to `127.0.0.1` |

---

## Runtimes & Tools

### Language Runtimes

Add or remove runtimes in `devcontainer.json` → `features`:

```jsonc
"features": {
  "ghcr.io/devcontainers/features/node:1": { "version": "lts" },
  "ghcr.io/devcontainers/features/python:1": { "version": "3.13" },
  "ghcr.io/devcontainers/features/go:1": {},
  "ghcr.io/devcontainers/features/java:1": { "version": "17" },
  "ghcr.io/devcontainers-extra/features/deno:1": {}
}
```

Comment out any runtime you don't need. Also comment out the corresponding VS Code extension.

### CLI Tools

Tools installed via curl or npm go in `scripts/lib/base-setup.sh`. Each tool gets its own function:

```bash
base_install_mytool() {
  if has_cmd mytool; then
    log "mytool already installed, skipping"
    return 0
  fi
  log "Installing mytool..."
  retry 3 5 bash -c 'curl -fsSL https://mytool.dev/install.sh | bash'
}
```

Add the call to `base_setup()` and to `base_verify_tools`.

---

## Editor

### VS Code Settings

All editor settings live in `devcontainer.json` → `customizations.vscode.settings`. Do not create a `.vscode/settings.json` in the template — that's for consuming projects.

### VS Code Extensions

All extensions live in `devcontainer.json` → `customizations.vscode.extensions`. Comment out extensions for runtimes you don't use.

---

## Shell & User

### Shell Customization

Shell customization uses a shared/local pattern:

| Pattern | Tracked | Purpose |
|---|---|---|
| `*.shared.sh` | Yes | Team defaults — aliases, functions, plugin config |
| `*.local.sh` | No (gitignored) | Personal overrides — machine-specific settings |

Shared files are sourced first, then local files, so local settings override team defaults. Edit `aliases.shared.sh` for team-wide aliases, or create a `*.local.sh` file for personal customizations.

### Git Config

VS Code's Dev Containers extension copies the host's `~/.gitconfig` into the container after post-create, and only when the container has none yet, together with a credential helper that answers from the host's own store. So nothing in post-create may write `~/.gitconfig`: a file there by then keeps your name and email out, and `git commit` fails with "Author identity unknown".

### GitHub Credentials

[`lib/github-auth.sh`](.devcontainer/scripts/lib/github-auth.sh) gives the container's own `gh` a token and points git's `github.com` credential at it, so `gh` and `git push` work without a login:

- **post-create** calls `github_auth_seed`, which stores a token when one has reached the container already: the host's exported `GH_TOKEN`, passed in as `MUSHER_HOST_GH_TOKEN`. It writes no git config.
- **post-attach** calls `ensure_github_auth`. If gh still has no token it asks VS Code's forwarded helper; then it clears the helper lines the host's `.gitconfig` brought for the host's own `gh`, which name a path that does not exist here, and runs `gh auth setup-git`.

`gh` accepts a token only with the `repo` and `read:org` scopes, which some credential managers' tokens lack; then run `gh auth login` once, and the `gh-config` volume keeps it. The file is a verbatim copy of the canonical one in [`musher-dev/development-container`](https://github.com/musher-dev/development-container): change it there first.

### Shell History

zsh and bash keep their history on the `shell-history` volume, so it survives a rebuild. `base_setup_shell_history` appends one `HISTFILE` line to the end of `~/.zshrc` and of `~/.bashrc`, where bash also writes after every command. The end matters: VS Code's shell integration sets `HISTFILE` before it sources `~/.zshrc`, and oh-my-zsh keeps a value already set. Node's, Python's and psql's REPL histories go to the same volume through `containerEnv`.

---

## Environment Variables

There are four distinct scopes for environment variables. Use the right one:

| Scope | Location | When to Use |
|---|---|---|
| **Container-wide** | `devcontainer.json` → `containerEnv` | Runtime behavior (`PYTHONUNBUFFERED`, `UV_LINK_MODE`) |
| **Remote/IDE** | `devcontainer.json` → `remoteEnv` | PATH extensions, forwarded host secrets |
| **Compose services** | `.devcontainer/.env` | Service credentials, `COMPOSE_PROFILES` |
| **Service-specific** | `compose/*.yaml` → `environment:` | Internal service config (uses `${VAR:-default}` interpolation) |

### Secrets

Never commit secrets. Forward them from your host environment:

```jsonc
"remoteEnv": {
  "MY_API_KEY": "${localEnv:MY_API_KEY}"
}
```

### Service Credentials

Dev-only credentials live in `.devcontainer/.env` (gitignored). Copy from `.env.example` on first use — `post-create.sh` does this automatically.

---

## Services

### Enabling/Disabling Services

All services are included in `compose.yaml`. Optional services are gated by Compose profiles:

| Service | Profile | Always On? |
|---|---|---|
| PostgreSQL | — | Yes |
| Redis | `redis` | No |
| MinIO | `minio` | No |
| OCI Registry | `registry` | No |
| Azimutt | `azimutt` | No |
| Observability stack | `observability` | No |

Enable services by setting `COMPOSE_PROFILES` in `.devcontainer/.env`:

```env
COMPOSE_PROFILES=redis,minio,observability
```

### Adding a New Service

1. Create `compose/myservice.yaml`
2. Add `- compose/myservice.yaml` to `compose.yaml` `include:`
3. Optionally add `profiles: [myservice]` if it should be opt-in
4. Add port forwarding in `devcontainer.json` → `forwardPorts` and `portsAttributes`
5. Use `${VAR:-default}` for any credentials, and add them to `.env.example`

### Service Configuration

Service-specific config files go under `.devcontainer/config/<service>/`:

```
config/
  postgres/           SQL init scripts
  observability/      OTel, Grafana, Tempo, Loki configs
  shell/              Shell aliases and functions
```

---

## Networking

### Port Allocation

All ports are bound to `127.0.0.1` (localhost only) for security. The template uses the `154xx` range:

| Port | Service | Protocol |
|---|---|---|
| 15432 | PostgreSQL | TCP |
| 15433 | Redis | TCP |
| 15434 | MinIO API | HTTP |
| 15435 | MinIO Console | HTTP |
| 15436 | OCI Registry | HTTP |
| 15440 | MinIO API (Observability) | HTTP |
| 15441 | MinIO Console (Observability) | HTTP |
| 15442 | Tempo | HTTP |
| 15443 | Loki | HTTP |
| 15444 | VictoriaMetrics | HTTP |
| 15445 | OTel Collector HTTP | HTTP |
| 15446 | OTel Collector gRPC | gRPC |
| 15447 | Grafana | HTTP |
| 15448 | Pyroscope | HTTP |
| 15460 | Azimutt | HTTP |

### Service Discovery

Services communicate via the `musher-dev` Docker network. Use the service name as the hostname (e.g., `postgres`, `redis`, `minio-observability`) with the container-internal port.

---

## Observability

The observability stack is profile-gated (`COMPOSE_PROFILES=observability`). It includes:

- **Grafana** — Dashboards and visualization (port 15447)
- **Tempo** — Distributed tracing backend
- **Loki** — Log aggregation
- **VictoriaMetrics** — Metrics storage
- **OTel Collector** — Telemetry pipeline (receives OTLP on ports 15445/15446)
- **Pyroscope** — Continuous profiling
- **MinIO (Observability)** — Object storage for Tempo and Loki

### Configuration Files

| File | Purpose |
|---|---|
| `config/observability/otel-collector-config.yaml` | OTel Collector pipeline configuration |
| `config/observability/tempo-config.yaml` | Tempo storage and ingestion config |
| `config/observability/loki-config.yaml` | Loki storage and ingestion config |
| `config/observability/grafana/provisioning/datasources/` | Auto-provisioned Grafana datasources |
| `config/observability/grafana/provisioning/dashboards/json/` | Auto-provisioned Grafana dashboards |

> **Note:** `tempo-config.yaml` and `loki-config.yaml` contain hardcoded MinIO credentials because they are native YAML configs that don't support environment variable interpolation. If you change `MINIO_OBS_ROOT_USER` or `MINIO_OBS_ROOT_PASSWORD` in `.env`, you must also update these files to match.

---

## Data

### Database Initialization

SQL files in `.devcontainer/config/postgres/` are mounted into PostgreSQL's `docker-entrypoint-initdb.d/` and run in alphabetical order on first container creation:

- `00-init.sql` — Base schema (extensions, shared types)
- `01-project.sql.example` — Project-specific schema (copy to `01-project.sql`)

### Persistence

All services use named Docker volumes (e.g., `musher-postgres-data`). They live in Docker-in-Docker's data root, `/var/lib/docker`, which the docker-in-docker Feature keeps on a volume of its own (`dind-var-lib-docker-${devcontainerId}`), so stack data survives a rebuild as well as a restart. For migrations, use project-level tooling (Atlas, Flyway, etc.).

### What a Rebuild Keeps

Each volume `devcontainer.json` mounts is named `musher-${devcontainerId}-<purpose>`. `${devcontainerId}` is stable across rebuilds and unique to the container, so **Rebuild Container** keeps the volume and no other repository's container shares it:

| Volume | Mounted at | Keeps |
|---|---|---|
| `gh-config` | `~/.config/gh` | The `gh` login |
| `claude-config` | `~/.claude` | Claude Code's login, settings and sessions (`/resume`), with `CLAUDE_CONFIG_DIR` |
| `codex-config` | `~/.codex` | Codex's login and settings |
| `shell-history` | `~/.shell-history` | zsh, bash, Node, Python and psql history |
| `cache` | `~/.cache` | The caches `containerEnv` points there: uv, pip, npm, bun, Go, Deno, ruff and mypy |

`node_modules/` stays on the bind mount, in your checkout.

To start a volume over, work on the host, because inside the container `docker` talks to Docker-in-Docker's own daemon. List the container's volumes with `docker inspect -f '{{range .Mounts}}{{.Name}} {{end}}' <container>` (`docker ps -a` finds it), remove the container (`docker rm -f <container>`; a stopped one still holds its volumes), run `docker volume rm <name>`, then reopen the folder in the container.

### Adding Volumes

Follow the naming convention `musher-${devcontainerId}-<purpose>`:

```jsonc
"source=musher-${devcontainerId}-my-tool,target=/home/vscode/.my-tool,type=volume"
```

A new volume works only if two things hold. Its target's parent already exists in the image, because Docker creates any missing directory on the way as root, and a root-owned `~/.local` stops Claude Code from installing. And it is in `base_setup_config_dirs`, because a fresh volume arrives root-owned.

---

## Lifecycle

| Hook | Runs | Use For |
|---|---|---|
| `postCreateCommand` | Once, on container creation | Tool installation, permissions, `.env` setup |
| `postStartCommand` | Every container start | `docker compose up`, health checks |
| `postAttachCommand` | Every time an editor attaches | Finishing the GitHub credential, once VS Code has copied `.gitconfig` |

### Skipping Base Steps

Call individual functions instead of `base_setup`:

```bash
main() {
  log "Starting post-create setup..."
  base_setup_config_dirs
  base_setup_cache_dirs
  base_setup_github_seed
  base_setup_shell_history
  base_fix_nvm_permissions
  # Skip codex: base_install_codex
  base_verify_tools
  log "Post-create setup completed"
}
```

### Script Layers

```
post-create.sh              ← Entry point (repo-specific customization)
  └── lib/base-setup.sh     ← Reusable orchestrator (AI CLIs, Task, NVM, config dirs, history)
        ├── lib/common.sh   ← Shared utilities (log, retry, has_cmd, ensure_writable_dir)
        └── lib/github-auth.sh ← github_auth_seed: a token for gh, no git config
post-attach.sh              ← Every attach: ensure_github_auth (lib/github-auth.sh)
```

---

## AI Tools

### Installed CLIs

- **Claude CLI** — Installed by the native installer in `base-setup.sh`, config persisted in `~/.claude` volume, and its VS Code extension (`anthropic.claude-code`)
- **Codex CLI** — Installed via npm in `base-setup.sh`, config persisted in `~/.codex` volume

### Effort

Every Claude Code session starts at max effort: `containerEnv` sets `CLAUDE_CODE_EFFORT_LEVEL=max`. It is an environment variable because the settings file's `effortLevel` accepts only `low` to `xhigh`, and quietly drops `max`. The variable outranks `/effort` and the model picker for the whole session, subagents included, so start a lighter one as `CLAUDE_CODE_EFFORT_LEVEL=auto claude` (the model's default) or `=high`. An organization's `maxEffortLevel` still caps it.

### Configuration Persistence

AI CLI configs are stored in named volumes mounted via `devcontainer.json` → `mounts`. This preserves authentication and settings across container rebuilds. `CLAUDE_CONFIG_DIR` points Claude Code at its volume, so `.claude.json`, which holds the account and onboarding state, survives a rebuild too, beside the session transcripts `/resume` reads.

---

## Directory Map

```
.devcontainer/
  devcontainer.json           Runtimes, extensions, settings, mounts, ports
  compose.yaml          Service orchestrator (includes compose/*.yaml)
  .env.example                Environment template (copy to .env)
  .env                        Local overrides (gitignored)
  compose/
    postgres.yaml              PostgreSQL with pgvector (always on)
    redis.yaml                 Redis (profile: redis)
    minio.yaml                 MinIO S3 storage (profile: minio)
    registry.yaml              OCI Registry (profile: registry)
    azimutt.yaml               DB explorer UI (profile: azimutt)
    observability.yaml         Full observability stack (profile: observability)
  config/
    postgres/
      00-init.sql             Base DB schema
      01-project.sql.example  Project schema template
    observability/
      otel-collector-config.yaml
      tempo-config.yaml
      loki-config.yaml
      grafana/provisioning/
        datasources/          Auto-provisioned datasources
        dashboards/json/      Auto-provisioned dashboards
    shell/
      aliases.shared.sh       Team-default shell aliases
      README.md               Shell customization docs
  scripts/
    post-create.sh            One-time setup entry point
    startup.sh                Every-start service launcher
    post-attach.sh            Every-attach GitHub credential
    lib/
      base-setup.sh           Reusable tool installer
      common.sh               Shared utilities
      github-auth.sh          gh token and git wiring (canonical; copied verbatim)
```
