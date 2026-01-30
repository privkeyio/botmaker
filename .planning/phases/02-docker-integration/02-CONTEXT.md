# Phase 2: Docker Integration - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Container lifecycle operations work independently of API layer. DockerService wraps Docker SDK for create/start/stop/restart/remove. OpenClaw Docker image builds and runs standalone. Containers are labeled for BotMaker filtering.

API routes and authentication are Phase 3 concerns.

</domain>

<decisions>
## Implementation Decisions

### Container configuration
- No resource limits initially (MVP, single-machine deployment)
- Restart policy: `unless-stopped` (auto-restart on crash, not on manual stop)
- Network mode: bridge (default Docker network)
- Environment variables passed from bot config (AI provider, model, channel type)
- Secrets bind-mounted as read-only to `/run/secrets`

### Service interface
- DockerService as class with methods: `createContainer`, `startContainer`, `stopContainer`, `restartContainer`, `removeContainer`, `getContainerStatus`, `listManagedContainers`
- Return types: container ID on create, void on actions, status object on inspect
- All methods take bot ID as primary identifier
- Container naming convention: `botmaker-{botId}`

### Error handling
- Image pull failures: throw with clear message (manual intervention required)
- Start failures: return error status, don't auto-retry (bot config likely wrong)
- Container not found: return null/undefined status, don't throw
- Orphan detection: `listManagedContainers` shows all containers with label regardless of DB state

### OpenClaw image
- Use existing OpenClaw image from Docker Hub or local build
- Secrets consumed via file reads from `/run/secrets/` (OpenClaw's existing pattern)
- No custom health check initially (Docker's default process monitoring)
- Container logs accessible via Docker SDK

### Labeling
- Label: `botmaker.managed=true` on all created containers
- Label: `botmaker.bot-id={uuid}` for mapping back to database
- List operations filter by `botmaker.managed=true`

### Claude's Discretion
- Exact Docker SDK method choices (dockerode vs docker-api)
- Internal error wrapping and logging
- Container cleanup timing on remove

</decisions>

<specifics>
## Specific Ideas

No specific requirements — standard Docker container management patterns apply.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-docker-integration*
*Context gathered: 2026-01-30*
