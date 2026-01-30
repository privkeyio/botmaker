# BotMaker

## What This Is

A web UI for creating and managing OpenClaw bot instances. Each bot runs in its own Docker container with complete isolation. Users configure a bot (name, AI provider/model, messaging channel), and BotMaker handles container lifecycle, secrets management, and monitoring.

## Core Value

Simple, secure bot provisioning — spin up isolated OpenClaw instances without manual Docker or config file management.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Create bot with name, AI provider config, and channel credentials
- [ ] Multi-vendor, multi-model AI support (user provides API key + model)
- [ ] Support all OpenClaw messaging channels (Discord, Telegram, Slack, Signal, etc.)
- [ ] List all bots with current status (running/stopped/error)
- [ ] Start and stop individual bots
- [ ] View bot container logs
- [ ] Delete bots (stops container, removes secrets)
- [ ] Secure secrets via bind-mounted files (per-bot, no sharing)
- [ ] HTTP Basic Auth for UI access
- [ ] Minimal OpenClaw bot Docker image

### Out of Scope

- Live config editing after bot creation — complexity, v1 ships without
- Docker Swarm / remote Docker hosts — local only for v1
- Credential sharing between bots — violates isolation principle
- Mobile-specific UI — web-first, responsive is fine

## Context

**Sister project:** keeper-arb provides the reference implementation for:
- Directory structure: `src/` backend, `dashboard/` React frontend
- Tech stack: Fastify + better-sqlite3 + dockerode, React + Vite
- UI patterns: dark theme, monospace font, clean card-based layout
- Docker: multi-stage build, node:20-slim, health checks

**OpenClaw:** The bot runtime. Each container runs an OpenClaw instance configured for a specific AI provider and messaging channel. Research needed on exact gateway/bot command and configuration patterns.

**Secrets approach:**
- Host stores secrets in `./secrets/{bot-id}/` with restricted permissions (600)
- Files mounted read-only into container at `/run/secrets/`
- Example: `/run/secrets/api_key`, `/run/secrets/channel_token`
- Container reads secrets from mounted files, never from env vars or DB

## Constraints

- **Tech stack**: Node.js/TypeScript, Fastify, better-sqlite3, dockerode, React/Vite — match keeper-arb patterns
- **Docker**: Local Docker daemon only (no Swarm mode)
- **Design**: Strong, clean UI — dark theme, monospace aesthetic from keeper-arb
- **Complexity**: Don't over-engineer — ship simple, iterate later

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bind-mount secrets vs Docker secrets | Docker secrets require Swarm; bind-mounts work with local Docker | — Pending |
| Per-bot isolation | Security boundary at container level, no shared state | — Pending |
| Basic auth | Simple, matches keeper-arb pattern, sufficient for self-hosted | — Pending |
| All OpenClaw channels | User flexibility, channels are config not code | — Pending |

---
*Last updated: 2025-01-30 after initialization*
