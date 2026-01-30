# Domain Pitfalls

**Domain:** Container management platform for OpenClaw bot instances
**Researched:** 2026-01-30

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Docker API Container State Race Conditions

**What goes wrong:** Container operations (start, stop, inspect) assume state consistency but Docker's API is asynchronous. Calling `container.start()` and immediately `container.inspect()` can return stale state. Similarly, checking if a container exists and then acting on it creates TOCTOU (time-of-check to time-of-use) vulnerabilities.

**Why it happens:** Docker's event-driven architecture means state changes propagate asynchronously. Multiple processes (BotMaker UI, external Docker commands, system restarts) can modify container state concurrently.

**Consequences:**
- Ghost containers: UI shows "running" but container is dead
- Failed operations: "No such container" errors on recently-created containers
- Duplicate containers: race during concurrent create calls

**Prevention:**
- Always verify state after mutations with retry loops and exponential backoff
- Use dockerode's event stream for real-time state updates instead of polling
- Implement idempotent operations: create-if-not-exists, stop-if-running patterns
- Wrap state transitions in try/catch with specific error handling for "container already exists" / "no such container"

**Detection (warning signs):**
- Intermittent "container not found" errors in logs
- UI state desync after rapid start/stop operations
- Container list showing different counts than `docker ps`

**Phase:** Core (container lifecycle management implementation)

---

### Pitfall 2: Log Streaming Memory Exhaustion and Backpressure

**What goes wrong:** Streaming container logs via `container.logs({ follow: true })` without backpressure handling fills Node.js memory buffers. If the frontend consumer disconnects or falls behind, logs accumulate unboundedly in memory.

**Why it happens:** dockerode passes streams directly without built-in flow control. A chatty bot can produce megabytes of logs per minute. The default blocking mode causes the entire pipeline to freeze when buffers fill.

**Consequences:**
- OOM kills on BotMaker server
- UI freezes when viewing logs of high-volume bots
- Lost log lines when memory limits are reached

**Prevention:**
- Implement ring buffers with fixed capacity (e.g., last 10K lines)
- Use Node.js `stream.pipeline()` with proper error handling
- Add explicit backpressure: pause log stream when WebSocket send buffer grows
- Set `tail` limit on initial log fetch; stream only new logs
- Consider non-blocking mode with acceptance of some log loss for stability

**Detection (warning signs):**
- Memory growth correlated with log viewing
- WebSocket connections timing out during log streaming
- "heap out of memory" crashes

**Phase:** Monitoring (log viewing feature)

---

### Pitfall 3: Bind-Mount Secrets Permission Leakage

**What goes wrong:** Secrets stored in bind-mounted files inherit host filesystem permissions. If the host directory has wrong permissions (readable by others), or if the container runs as root, secrets become accessible beyond the intended scope.

**Why it happens:** Docker bind mounts do NOT apply container isolation to file permissions. The mount exposes the exact host file with its existing permissions. Without explicit chmod, files may be world-readable.

**Consequences:**
- API keys exposed to other processes on host
- Cross-bot credential access if containers share mount parent
- Secrets persisted in container filesystem if copied from mount

**Prevention:**
- Create secret directories with `0700` permissions: `mkdir -p -m 0700 ./secrets/{bot-id}`
- Create secret files with `0600` permissions before writing content
- Mount secrets read-only (`:ro` flag) into containers
- Never mount the parent secrets directory; mount only per-bot subdirectory
- Verify permissions programmatically before container start
- Use tmpfs for secrets that should never touch disk (but note: lost on restart)

**Detection (warning signs):**
- `ls -la` shows permissions other than `drwx------` / `-rw-------`
- Multiple bot containers can read each other's secret files
- Secrets visible in `docker inspect` output

**Phase:** Core (secrets management implementation)

---

### Pitfall 4: OpenClaw Gateway Bind Address Misconfiguration

**What goes wrong:** OpenClaw gateway defaults vary by context. In Docker, it defaults to `--bind lan`, but the containerized bot needs to be reachable from outside the container. Incorrect bind settings cause the gateway to be inaccessible or insecure.

**Why it happens:** OpenClaw has multiple bind modes (`loopback`, `lan`, custom IP) with different implications. The docs say "Gateway bind defaults to `lan` for container use" but this requires proper port mapping and network configuration.

**Consequences:**
- Gateway unreachable: health checks fail, bot appears dead
- Security exposure: gateway accessible from unexpected networks
- Channel connections fail due to inability to reach gateway WebSocket

**Prevention:**
- Always explicitly set `--bind loopback --port 18789` for containerized bots
- Map only necessary ports in Docker (18789 for gateway, 18790 for bridge if needed)
- Use Docker's internal networking; don't expose gateway to host network
- Set `gateway.mode=local` in OpenClaw config for containerized deployments
- Test gateway reachability from BotMaker before marking bot as "running"

**Detection (warning signs):**
- `openclaw channels status --probe` fails inside container
- Health check endpoint returns connection refused
- Logs show "binding to 0.0.0.0" unexpectedly

**Phase:** Core (container creation and health checking)

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt.

### Pitfall 5: Orphaned Container Accumulation

**What goes wrong:** Stopped containers, unused images, and dangling volumes accumulate when bot deletion doesn't fully clean up. Over time, disk space exhaustion or hitting Docker's resource limits occurs.

**Prevention:**
- On bot delete: `container.stop()` then `container.remove({ force: true })`
- Implement scheduled cleanup: `docker container prune`, `docker volume prune`
- Track container IDs in database; reconcile periodically with Docker state
- Use `--rm` flag only for ephemeral containers; managed bots need explicit lifecycle
- Add `labels` to containers for easier bulk cleanup: `{ "botmaker.bot-id": "uuid" }`

**Detection (warning signs):**
- `docker ps -a` shows many stopped containers with botmaker labels
- Disk usage on Docker root directory growing steadily
- "no space left on device" errors

**Phase:** MVP Polish (cleanup routines)

---

### Pitfall 6: OpenClaw Config Path Confusion

**What goes wrong:** OpenClaw reads config from `~/.openclaw/openclaw.json` relative to the container's HOME. When bind-mounting config, path mismatches cause OpenClaw to use defaults or fail validation entirely.

**Prevention:**
- Set `HOME=/home/node` explicitly in container environment (as seen in OpenClaw's docker-compose)
- Mount config directory to match expected path: `${CONFIG_DIR}:/home/node/.openclaw`
- Verify config file exists and is valid JSON5 before container start
- Use OpenClaw's `config.apply` RPC for runtime config changes if needed
- Test with `openclaw doctor` in container after creation

**Detection (warning signs):**
- Logs show "using safe-ish defaults" when config should be customized
- Channel tokens not recognized despite being in config file
- `openclaw doctor` reports schema validation errors

**Phase:** Core (config generation and mounting)

---

### Pitfall 7: Channel Token Format Errors

**What goes wrong:** Each OpenClaw channel expects tokens in specific formats. Discord tokens are raw (no prefix), Telegram expects `123456:ABCDEF` format, Slack needs both `botToken` and `appToken`. Misformatted tokens cause silent failures or cryptic errors.

**Prevention:**
- Validate token format client-side before submitting to backend
- Discord: no `DISCORD_BOT_TOKEN=` prefix, just the raw token
- Telegram: must include both parts (numeric ID and alphanumeric suffix)
- Slack: two tokens required (bot token starts with `xoxb-`, app token with `xapp-`)
- Store tokens in named secret files matching OpenClaw's expected env vars
- Document expected format in UI with examples (masked)

**Detection (warning signs):**
- Channel shows "enabled" but never connects
- Logs show authentication failures
- `openclaw channels status --probe` reports credential issues

**Phase:** MVP (channel configuration forms)

---

### Pitfall 8: Container Network Isolation vs Channel Connectivity

**What goes wrong:** For security, sandbox containers run with `network: none`. But OpenClaw bots need network access to reach AI providers and messaging platforms. Blindly copying sandbox patterns breaks bot functionality.

**Prevention:**
- Bot containers MUST have network access (default bridge or custom network)
- Sandbox containers for tools may use `network: none`
- Separate concerns: bot process needs egress, sandbox exec may not
- Don't confuse OpenClaw's sandbox (tool isolation) with bot container (full application)
- Test AI provider and channel connectivity from container before going live

**Detection (warning signs):**
- Bot starts but all AI requests fail
- Channel connections timeout
- Logs show DNS resolution failures

**Phase:** Core (network configuration)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

### Pitfall 9: TTY and Interactive Mode for Log Streams

**What goes wrong:** dockerode's `container.logs()` returns multiplexed stdout/stderr when `Tty: false`. Without demultiplexing, logs appear garbled with binary header bytes.

**Prevention:**
- Use `container.modem.demuxStream(stream, stdout, stderr)` when Tty is false
- Or set `Tty: true` on container creation for simpler single-stream output
- Handle both cases based on container configuration

**Phase:** Monitoring (log viewer implementation)

---

### Pitfall 10: OpenClaw Workspace Path Escapes

**What goes wrong:** OpenClaw workspace defaults to `~/.openclaw/workspace`. If bot config specifies a workspace outside the mounted volume, the container can't access it, causing skill loading failures.

**Prevention:**
- Always mount workspace at the expected path
- Override `agents.defaults.workspace` in generated config to match mount
- Validate workspace paths resolve within mounted volumes
- Use relative paths in config where possible

**Phase:** Core (config generation)

---

### Pitfall 11: DM Policy Defaults Exposing Bots to Public

**What goes wrong:** OpenClaw's default `dmPolicy` is `"pairing"` which requires approval but still responds with pairing codes. For managed bots, this may not be desired behavior.

**Prevention:**
- Explicitly set `dmPolicy: "allowlist"` in generated configs
- Populate `allowFrom` based on user configuration
- Consider `dmPolicy: "disabled"` for bots that should only work in specific channels
- Document this behavior clearly in BotMaker UI

**Phase:** MVP (configuration templates)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Container Lifecycle | Race conditions (#1) | Event-based state tracking, idempotent operations |
| Secret Management | Permission leakage (#3) | 0600 files, per-bot directories, read-only mounts |
| Config Generation | Path confusion (#6) | Explicit HOME, validated mounts, doctor checks |
| Log Streaming | Memory exhaustion (#2) | Ring buffers, backpressure, tail limits |
| Cleanup | Orphaned resources (#5) | Labels, scheduled prune, DB reconciliation |
| Channel Setup | Token formats (#7) | Client-side validation, clear documentation |
| Network Config | Isolation vs connectivity (#8) | Distinct treatment for bot vs sandbox containers |
| Health Checks | Bind address (#4) | Explicit loopback bind, connectivity tests |

## OpenClaw-Specific Configuration Reference

Key config patterns from OpenClaw docs that BotMaker must generate correctly:

```json5
{
  // AI provider - user provides API key
  agent: {
    model: "anthropic/claude-opus-4-5"  // or openai/gpt-4, etc.
  },

  // Gateway binding for containerized deployment
  gateway: {
    mode: "local",
    // port set via CLI: --port 18789
  },

  // Channel configuration (example: Discord)
  channels: {
    discord: {
      enabled: true,
      token: "BOT_TOKEN_HERE",  // or via DISCORD_BOT_TOKEN env
      dm: {
        policy: "allowlist",
        allowFrom: ["USER_ID"]
      }
    }
  },

  // Workspace must match mounted path
  agents: {
    defaults: {
      workspace: "/home/node/.openclaw/workspace"
    }
  }
}
```

## Sources

- OpenClaw Documentation: `/home/jgarzik/tmp/repo/openclaw/docs/` (configuration, docker, sandboxing)
- OpenClaw AGENTS.md: Repository guidelines and configuration patterns
- [Docker Prune Documentation](https://docs.docker.com/engine/manage-resources/pruning/)
- [Docker Secrets Management](https://docs.docker.com/engine/swarm/secrets/)
- [AWS Container Logging Backpressure](https://aws.amazon.com/blogs/containers/choosing-container-logging-options-to-avoid-backpressure/)
- [Docker Race Conditions](https://medium.com/hackernoon/preventing-race-conditions-in-docker-781854121ed3)
- [dockerode GitHub](https://github.com/apocas/dockerode)
- [Docker Compose Orphan Handling](https://dockerpros.com/wiki/docker-compose-down-remove-orphans/)
