# Project Research Summary

**Project:** BotMaker
**Domain:** Container management platform for OpenClaw bot instances
**Researched:** 2026-01-30
**Confidence:** HIGH

## Executive Summary

BotMaker is a Docker container management web UI specifically for launching and monitoring OpenClaw AI bot instances across different channels (Discord, Telegram, Slack). Research confirms the existing stack (Fastify + dockerode + better-sqlite3 + React) is optimal for this use case, following patterns proven in the keeper-arb reference implementation. The core challenge is orchestrating container lifecycle while safely managing secrets (API keys, channel tokens) outside the database using filesystem isolation and bind mounts.

The recommended approach follows a service layer architecture: Fastify API coordinating between SQLite metadata storage, Docker container operations, and filesystem-based secrets. The frontend uses React + TanStack Query for polling container status and SSE (Server-Sent Events) for real-time log streaming. Critical dependencies dictate build order: database and secrets infrastructure first, Docker service layer second, API and UI last.

Key risks center on Docker API race conditions, log streaming memory exhaustion, and secrets permission leakage. Mitigation strategies are well-documented: event-based state tracking with idempotent operations, ring buffers with backpressure for logs, and strict 0600/0700 permissions with read-only bind mounts for secrets.

## Key Findings

### Recommended Stack

The existing package.json already contains optimal choices. Core framework is Fastify 5.x for HTTP serving (fastest Node.js server, TypeScript-first), dockerode 4.x for Docker API interaction (most mature client), and better-sqlite3 11.x for metadata storage (fastest SQLite binding with synchronous API). React 18+ with Vite 5+ follows keeper-arb patterns for dashboard UI.

**Core technologies:**
- **Fastify 5.x**: HTTP API server — industry-leading performance, native TypeScript support, proven in keeper-arb
- **dockerode 4.x**: Docker API client — most mature Node.js wrapper, handles container lifecycle, log streaming
- **better-sqlite3 11.x**: SQLite storage — fastest binding, WAL mode for concurrent reads, transaction-first API
- **React 18+ / Vite 5+**: Dashboard UI — 2025 standard, replaced CRA, proven in keeper-arb reference
- **TanStack Query v5**: Server state management — polling for container status, built-in caching and error handling

**Supporting libraries:**
- @fastify/sse for real-time log streaming
- uuid for bot ID generation (already in package.json)

### Expected Features

Research into container management UIs (Portainer, Docker Desktop, Dozzle) reveals clear table stakes vs differentiators.

**Must have (table stakes):**
- Container list view with status badges (running/stopped/error)
- Start/Stop/Delete controls with confirmation modal for destructive actions
- Create bot form (name, AI provider, channel type, credentials)
- Basic log viewing with real-time tail

**Should have (competitive differentiators):**
- Log streaming via WebSocket/SSE (transforms debugging UX)
- Restart button (convenience over stop+start)
- Loading states during async operations
- Container detail view with configuration review

**Defer (v2+):**
- Log search (regex/fuzzy) — medium complexity
- Resource metrics (CPU/memory per container)
- Bulk actions (multi-select start/stop/delete)
- Template library for pre-configured bots
- Multi-container log split view

**Anti-features (explicitly avoid in v1):**
- Full Docker API exposure (scope creep)
- Image/volume/network management UI
- Container shell/exec access (security risk)
- User authentication/RBAC (v2 consideration)
- Multi-host/Swarm/Kubernetes support

### Architecture Approach

Service layer pattern with clear component boundaries. Fastify API orchestrates between SQLite (source of truth for bot config), Docker Service (container runtime state), and Secrets Manager (filesystem-based credential storage). Frontend polls for status updates and uses SSE for log streaming.

**Major components:**
1. **Fastify API Layer** — Request handling, validation, orchestration between services
2. **Docker Service** — Wraps dockerode with typed methods, handles container lifecycle, label-based filtering
3. **SQLite Database** — Bot metadata (id, name, ai_provider, ai_model, channel, container_id), WAL mode for concurrent reads
4. **Secrets Manager** — Filesystem operations for per-bot credential directories (0700 directories, 0600 files, read-only bind mounts)
5. **React Dashboard** — TanStack Query for polling, SSE hooks for log streaming, card-based UI matching keeper-arb style

**Key patterns:**
- Stateless API handlers (query services, no persistent memory state)
- Secrets as files not env vars (bind-mounted read-only to /run/secrets)
- Event-based container state tracking (docker events API or dockerode streams)
- Prepared statement pattern for SQLite queries (prepare once, reuse)

### Critical Pitfalls

1. **Docker API race conditions** — Container state changes are asynchronous. Calling start() then immediately inspect() returns stale data. Use dockerode event streams for real-time updates, implement idempotent operations (create-if-not-exists patterns), retry with exponential backoff.

2. **Log streaming memory exhaustion** — Streaming container.logs({ follow: true }) without backpressure fills Node.js buffers unboundedly. Implement ring buffers (last 10K lines max), use stream.pipeline() with proper error handling, set tail limits on initial fetch.

3. **Bind-mount secrets permission leakage** — Docker bind mounts expose exact host file permissions. Create directories with 0700 (mkdir -m 0700), files with 0600, mount read-only (:ro flag), never mount parent secrets directory.

4. **OpenClaw gateway bind misconfiguration** — OpenClaw defaults vary by context. Always explicitly set --bind loopback --port 18789, map only necessary ports, test gateway reachability before marking bot as "running".

5. **Orphaned container accumulation** — Stopped containers accumulate without cleanup. On delete: container.stop() then container.remove({ force: true }), use labels for filtering (botmaker.bot-id), implement scheduled pruning.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Database + Secrets)
**Rationale:** Core dependencies for all other components. SQLite schema and secrets filesystem must exist before Docker service can bind-mount or store metadata.

**Delivers:**
- SQLite database with WAL mode enabled (bots table, prepared statements)
- Secrets manager (create/delete per-bot directories with 0700/0600 permissions)
- Configuration loading and validation

**Addresses:**
- Table stakes: data persistence requirement
- Critical pitfall #3: secrets permission leakage (solve upfront)

**Avoids:** Building Docker service before having secrets infrastructure in place (would require refactoring mount paths)

### Phase 2: Docker Integration
**Rationale:** Depends on secrets manager for bind mount paths. Establishes container lifecycle operations before exposing via API.

**Delivers:**
- DockerService class wrapping dockerode
- Container create/start/stop/remove methods
- Container status inspection and mapping
- Label-based filtering (botmaker.managed=true)

**Uses:**
- dockerode for Docker API
- Secrets Manager for mount path resolution

**Implements:**
- Architecture component: Docker Service
- Anti-pattern avoidance: service layer abstraction prevents direct dockerode exposure in routes

**Addresses:**
- Critical pitfall #1: race conditions (event-based state tracking)
- Critical pitfall #4: gateway bind configuration (explicit --bind loopback)

### Phase 3: API Layer
**Rationale:** Needs Docker Service and Database to exist. Orchestrates between services to expose bot lifecycle operations.

**Delivers:**
- Fastify server setup with basic auth
- Bot CRUD endpoints (GET /api/bots, POST /api/bots, DELETE /api/bots/:id)
- Container control endpoints (POST /api/bots/:id/start, POST /api/bots/:id/stop)
- SSE log streaming endpoint (GET /api/bots/:id/logs)

**Uses:**
- Fastify + @fastify/sse
- Docker Service for container operations
- SQLite for metadata queries

**Implements:**
- Architecture component: API Layer
- Pattern: stateless handlers (query services, no memory state)

**Addresses:**
- Critical pitfall #2: log streaming backpressure (ring buffers in SSE implementation)
- Moderate pitfall #6: OpenClaw config path validation

### Phase 4: Frontend Dashboard
**Rationale:** Requires working API endpoints to consume. UI is last layer to avoid rework from API changes.

**Delivers:**
- React app with Vite build tooling
- Bot list view with status badges
- Create bot form (AI provider, channel, credentials)
- Log viewer with SSE streaming
- Start/stop/delete controls

**Uses:**
- React 18 + TanStack Query v5
- Fastify API endpoints
- keeper-arb styling patterns (dark theme, monospace, card layout)

**Implements:**
- Architecture components: Frontend (all)
- Table stakes features: list view, status badges, controls, log viewing

**Addresses:**
- Table stakes: all must-have features from FEATURES.md
- UX patterns: status color conventions, delete confirmation modal

### Phase 5: MVP Polish
**Rationale:** Refine after core flow works end-to-end. Catches edge cases and improves UX without blocking MVP.

**Delivers:**
- Unified error handling and responses
- Loading states and UI transitions
- Container cleanup reconciliation (DB vs Docker state sync)
- OpenClaw config generation and validation
- Health check implementation

**Addresses:**
- Moderate pitfall #5: orphaned container accumulation (scheduled cleanup)
- Moderate pitfall #7: channel token format validation
- Minor pitfalls: TTY demuxing, workspace path validation

### Phase Ordering Rationale

- **Database/Secrets first:** No other component can function without metadata storage and secrets infrastructure
- **Docker service before API:** Testing container operations directly is easier than debugging through HTTP layer
- **API before frontend:** Backend stability prevents frontend rework from API contract changes
- **Polish last:** Core flow must work before optimizing edge cases

Architecture dictates this order: shared dependencies (DB, secrets) → service layer (Docker) → orchestration (API) → presentation (UI) → refinement (polish). This mirrors successful patterns from keeper-arb and avoids critical pitfall #3 (secrets) and #1 (race conditions) by solving infrastructure concerns early.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (API Layer):** SSE backpressure implementation needs validation — ring buffer sizing, stream.pipeline error handling. While pattern is documented, tuning parameters for chatty bots (megabytes/minute) may need experimentation.
- **Phase 5 (Polish):** OpenClaw config generation complexity — multiple channel types with different token formats, workspace path mounting, DM policy defaults. Docs are complete but combinatorial complexity (AI providers × channel types) suggests potential gaps.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** SQLite WAL mode and filesystem permissions are well-documented with concrete examples in STACK.md
- **Phase 2 (Docker Integration):** dockerode lifecycle patterns verified against GitHub docs, all code examples tested
- **Phase 4 (Frontend):** TanStack Query polling and SSE hooks follow established React patterns with high confidence

## Open Questions Across Research

### From STACK.md
- **Cross-platform support:** Windows does not fully support Unix file permissions (0600/0700). Should BotMaker document Linux/macOS as primary platforms, or implement Windows-specific permission handling?
- **Docker API version pinning:** Recommend pinning to v1.43 for stability, but need to verify OpenClaw container compatibility with older API versions.

### From FEATURES.md
- **Log persistence strategy:** v1 uses in-memory streaming only. Should we document integration points for external log aggregation (ELK, Loki) even if not implemented?
- **Authentication scope:** Single-user assumption for v1. Does this require network restrictions (localhost-only binding), or rely on deployment environment security?

### From ARCHITECTURE.md
- **Container restart policy:** Recommend "unless-stopped" but OpenClaw long-running stability unknown. Should initial containers use "on-failure" with restart limit until proven stable?
- **Event monitoring approach:** docker-events library vs raw dockerode.getEvents(). Raw approach has more control but docker-events simplifies. Need performance comparison for status polling.

### From PITFALLS.md
- **Health check implementation:** How to verify OpenClaw gateway is reachable before marking bot as "running"? HTTP probe to 18789? Or rely on channel connection success?
- **Config validation timing:** Should BotMaker validate OpenClaw config with `openclaw doctor` before container start, or allow container to fail and surface errors via logs?

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies already in package.json, patterns verified in keeper-arb, dockerode examples tested against GitHub docs |
| Features | MEDIUM | Table stakes clearly defined from Portainer/Dozzle research, but some differentiators (log search complexity, bulk actions) need UX validation |
| Architecture | HIGH | Service layer pattern proven in keeper-arb, component boundaries clear, data flows documented with concrete examples |
| Pitfalls | HIGH | All critical pitfalls sourced from official docs (Docker, OpenClaw) or verified community patterns, prevention strategies concrete |

**Overall confidence:** HIGH

Research is comprehensive with verified sources. Stack is locked and proven. Architecture follows established patterns from keeper-arb. Critical pitfalls have documented solutions. Medium confidence areas (feature prioritization, some UX patterns) won't block implementation and can be validated during MVP development.

### Gaps to Address

- **OpenClaw runtime behavior:** Research covers configuration and Docker patterns, but OpenClaw's actual behavior in long-running container scenarios needs validation during Phase 2-3. Specifically: restart stability, memory usage patterns, log volume characteristics.
  - **Handle by:** Initial testing with single bot instance in Phase 3, document observations for Phase 5 polish

- **Log streaming performance tuning:** Ring buffer sizing (recommended 10K lines) and backpressure thresholds need empirical testing with high-volume bots.
  - **Handle by:** Start with conservative 5K line buffer, instrument memory usage, tune in Phase 5 based on real-world log patterns

- **Channel-specific token validation:** Research documented formats (Discord raw, Telegram numeric:alpha, Slack dual tokens) but edge cases (token rotation, revocation errors) need UI error messaging design.
  - **Handle by:** Phase 4 implements basic regex validation, Phase 5 adds channel-specific error messages based on OpenClaw logs

- **Container cleanup timing:** Recommended approach is manual cleanup on delete + scheduled pruning, but pruning interval and filter criteria (age? label?) need operational tuning.
  - **Handle by:** Phase 5 implements weekly prune of stopped containers older than 7 days, tune based on usage patterns

## Sources

### Primary (HIGH confidence)
- dockerode GitHub (https://github.com/apocas/dockerode) — Container lifecycle, log streaming, bind mounts
- better-sqlite3 GitHub (https://github.com/WiseLibs/better-sqlite3) — WAL mode, transactions, prepared statements
- Docker Official Docs (https://docs.docker.com) — Bind mounts, secrets, container states, logging
- TanStack Query Docs (https://tanstack.com/query/latest) — Polling patterns, SSE integration
- Fastify Docs (https://fastify.dev) — Route patterns, SSE plugin
- OpenClaw Documentation (/home/jgarzik/tmp/repo/openclaw/docs/) — Configuration, Docker deployment, channel setup
- keeper-arb reference implementation (verified patterns in /home/jgarzik/repo/keeper-arb/)

### Secondary (MEDIUM confidence)
- Portainer Documentation (https://docs.portainer.io) — Container management UI patterns
- Dozzle (https://dozzle.dev, https://github.com/amir20/dozzle) — Log viewer features and performance
- AWS Container Logging (https://aws.amazon.com/blogs/containers/) — Backpressure handling strategies
- Smashing Magazine UX Patterns (https://www.smashingmagazine.com) — Destructive action confirmations
- BetterStack Docker Logs Guide (https://betterstack.com/community/guides/logging/docker-logs/) — Best practices

### Tertiary (LOW confidence)
- docker-events npm (https://github.com/deoxxa/docker-events) — Event wrapper, needs performance validation vs raw dockerode
- Node.js fs.chmod documentation — File permission handling, Windows compatibility noted as limitation

---
*Research completed: 2026-01-30*
*Ready for roadmap: yes*
