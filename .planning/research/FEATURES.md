# Feature Landscape: Container Management UIs

**Domain:** Docker container management web UIs (for bot instance management)
**Researched:** 2026-01-30
**Confidence:** MEDIUM (based on WebSearch + official docs, cross-verified)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Container List View** | Core navigation; users need to see all containers at a glance | Low | None | Columns: name, status, created, actions. Portainer/Docker Desktop standard. |
| **Status Badges** | Instant visual feedback on container state | Low | Container List | States: running (green), stopped (gray), error/unhealthy (red), restarting (yellow). Universal convention. |
| **Start/Stop Controls** | Primary container lifecycle action | Low | Container List | Single-click buttons. Graceful stop (SIGTERM then SIGKILL after timeout). |
| **Delete with Confirmation** | Destructive action requires protection | Low | Container List | Modal with red CTA, action-specific button text ("Delete Bot" not "Confirm"). |
| **Basic Log Viewing** | Essential for debugging | Medium | Container exists | Stream STDOUT/STDERR. Minimum: real-time tail with scroll. |
| **Create Form** | Users need to spin up new instances | Medium | None | Name, image/config selection, basic settings. Progressive disclosure for advanced. |
| **Container Detail View** | Drill-down for configuration review | Low | Container List | Shows: name, status, config, ports, environment (masked secrets). |
| **Error State Display** | Users must understand failures | Low | Status system | Exit codes, health check failures, clear error messaging. |
| **Loading States** | Prevent user confusion during operations | Low | All actions | Spinners/disabled buttons during start/stop/delete. |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Log Search (Regex)** | Find specific errors/patterns in logs | Medium | Log Viewer | Dozzle offers regex, fuzzy, even SQL search. High value for debugging. |
| **Log Streaming (WebSocket)** | Real-time log tailing without refresh | Medium | Log Viewer | Dozzle pattern: instant updates, lightweight. |
| **Multi-Container Log Split** | Monitor multiple bots simultaneously | High | Log Viewer | Dozzle feature: split-screen log viewing. Power user feature. |
| **Restart Button** | Convenience over stop+start | Low | Start/Stop | Single action, common in Portainer/Docker Desktop. |
| **Bulk Actions** | Start/stop/delete multiple at once | Medium | Container List | Checkbox selection, batch operations. |
| **Resource Metrics** | CPU/memory usage per container | Medium | Container runtime | Dozzle includes live metrics. Useful for bot performance monitoring. |
| **Container Health Checks** | Proactive issue detection | Medium | Container runtime | Beyond status: periodic health probes, display in UI. |
| **Auto-Remove on Exit** | Cleanup convenience | Low | Create Form | Toggle in Portainer. Useful for one-shot tasks. |
| **Webhook for Updates** | Automation integration | Medium | Container system | Portainer pattern: POST endpoint to trigger image pull + redeploy. |
| **Template Library** | Quick-start common configurations | Medium | Create Form | Pre-configured bot templates. Reduces setup friction. |
| **Environment File Import** | Bulk env var configuration | Low | Create Form | Upload .env file instead of manual entry. Portainer has this. |
| **Restart Policies** | Resilience configuration | Low | Create Form | Never/Always/On-failure/Unless-stopped. Standard Docker options. |
| **Dark Mode** | User preference, eye comfort | Low | UI framework | Modern dashboards expected to have this. |
| **Log Download/Export** | Offline analysis, sharing | Low | Log Viewer | Download as file for external analysis. |

## Anti-Features

Features to explicitly NOT build in v1. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full Docker API Exposure** | Massive scope creep; security risk; not needed for bot management | Expose only bot-specific operations: create-bot, start, stop, delete, logs. |
| **Image Management** | Complexity explosion; users don't need to manage images for a bot platform | Pre-define bot image(s); abstract away image selection. |
| **Volume Management UI** | Complex; rarely needed for bot instances | Handle volumes in backend config; don't expose in UI. |
| **Network Management UI** | Advanced Docker feature; overkill for single-bot-per-container | Use default bridge network; configure in backend. |
| **Container Shell/Exec** | Security risk; maintenance burden; encourages bad practices | If debugging needed, use logs. v2 consideration only. |
| **Multi-Host/Swarm/K8s** | Massive complexity; v1 is single-host | Document as future consideration. |
| **Custom Restart Policies UI** | Confusing for non-Docker users | Default to "unless-stopped" in backend. |
| **GPU/Privileged Mode** | Security risk; not needed for chat bots | Don't expose in UI. |
| **Log Persistence/Search Backend** | Infrastructure complexity (ELK, Loki, etc.) | v1: in-memory streaming only. Mention external log aggregation for production. |
| **User Authentication/RBAC** | Scope creep for v1 | Single-user assumption. Document as v2 feature. |
| **GitOps/Auto-Sync** | Advanced DevOps feature; overkill for bot management | Manual deployments only in v1. |
| **Confirmation Dialog for Non-Destructive Actions** | Dialog fatigue reduces effectiveness | Only confirm truly destructive actions (delete). |
| **Undo for Destructive Actions** | Complex to implement for containers; can't truly undo | Use confirmation dialog instead. |

## Feature Dependencies

```
Container List View
    |
    +-- Status Badges
    |
    +-- Start/Stop Controls
    |       |
    |       +-- Restart Button (convenience layer)
    |
    +-- Delete with Confirmation
    |
    +-- Container Detail View
            |
            +-- Log Viewer (basic)
                    |
                    +-- Log Search
                    |
                    +-- Log Streaming (WebSocket)
                    |
                    +-- Log Download

Create Form (independent)
    |
    +-- Environment Variables Section
    |       |
    |       +-- .env File Import
    |
    +-- Template Selection (optional)
```

## MVP Recommendation

For MVP, prioritize in order:

### Must Ship (Table Stakes)
1. **Container List View** with status badges - Core navigation
2. **Start/Stop/Delete Controls** - Basic lifecycle management
3. **Delete Confirmation Modal** - Protect against accidents
4. **Create Bot Form** - Name, AI provider dropdown, channel credentials (masked input)
5. **Basic Log Viewing** - Tail last N lines, auto-scroll

### Should Ship (High-Value, Low Complexity)
6. **Log Streaming** (WebSocket) - Real-time updates transform UX
7. **Loading States** - Spinners during operations
8. **Restart Button** - Convenience, low effort

### Defer to v2
- Log search (regex/fuzzy)
- Resource metrics (CPU/memory)
- Bulk actions
- Template library
- Multi-container log split
- Auto-remove option
- Webhook integrations

## UX Patterns to Follow

### Status Display Convention
- **Running:** Green badge, solid circle icon
- **Stopped:** Gray badge, hollow circle or stop icon
- **Error/Unhealthy:** Red badge, exclamation icon
- **Starting/Stopping:** Yellow/amber badge, spinner icon

### Delete Confirmation Pattern
```
+------------------------------------------+
|  Delete Bot "my-trading-bot"?            |
|                                          |
|  This will permanently delete the bot    |
|  and all its data. This cannot be undone.|
|                                          |
|  [Cancel]              [Delete Bot]      |
|                              ^           |
|                         Red button       |
+------------------------------------------+
```

Key principles:
- Restate what will be deleted (bot name)
- Explain consequences
- Action-specific button label ("Delete Bot" not "Confirm")
- Red color for destructive CTA
- Cancel as secondary, non-destructive option

### List View Column Convention
| Name | Status | AI Provider | Channel | Created | Actions |
|------|--------|-------------|---------|---------|---------|
| my-bot | Running | OpenAI | Discord | 2h ago | [...] |

Actions column: icon buttons for Start/Stop (toggle), Logs, Delete

### Log Viewer Pattern
- Default: last 100-500 lines
- Auto-scroll to bottom (with pause-on-scroll-up)
- Monospace font, dark background
- Timestamp prefix per line
- Clear visual distinction for STDERR (red/warning color)

## Complexity Estimates

| Feature | Frontend | Backend | Total | Notes |
|---------|----------|---------|-------|-------|
| Container List | Low | Low | Low | API call + table render |
| Status Badges | Low | - | Low | CSS styling only |
| Start/Stop | Low | Low | Low | Single API endpoint each |
| Delete + Confirm | Low | Low | Low | Modal + API call |
| Create Form | Medium | Medium | Medium | Form validation, multi-field |
| Basic Log View | Medium | Medium | Medium | Log retrieval, scroll handling |
| Log Streaming | Medium | Medium | Medium | WebSocket setup |
| Log Search | Medium | Low | Medium | Frontend filtering |
| Resource Metrics | Medium | Medium | Medium | Docker stats API integration |

## Sources

### Container Management UIs
- [Portainer Documentation - Add Container](https://docs.portainer.io/user/docker/containers/add)
- [Portainer Features](https://www.portainer.io/features)
- [Docker Desktop Docs](https://docs.docker.com/desktop/)
- [Dozzle - Docker Log Viewer](https://dozzle.dev/)
- [GitHub - Dozzle](https://github.com/amir20/dozzle)

### Log Management
- [Docker Container Logs](https://docs.docker.com/reference/cli/docker/container/logs/)
- [Docker Logs Best Practices - BetterStack](https://betterstack.com/community/guides/logging/docker-logs/)

### UX Patterns
- [Destructive Actions UX - Smashing Magazine](https://www.smashingmagazine.com/2024/09/how-manage-dangerous-actions-user-interfaces/)
- [Delete with Confirmation - Cloudscape Design](https://cloudscape.design/patterns/resource-management/delete/delete-with-additional-confirmation/)
- [Modal UX Patterns - LogRocket](https://blog.logrocket.com/ux-design/modal-ux-design-patterns-examples-best-practices/)

### Container States
- [Docker Container States - Baeldung](https://www.baeldung.com/ops/docker-container-states)
- [Docker Container ls](https://docs.docker.com/reference/cli/docker/container/ls/)

### Secrets Management
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)
- [Environment Variables Security 2026](https://securityboulevard.com/2025/12/are-environment-variables-still-safe-for-secrets-in-2026/)
