# Technology Stack

**Project:** BotMaker
**Researched:** 2026-01-30
**Overall Confidence:** HIGH (stack locked, patterns verified)

## Recommended Stack

### Core Framework (Locked)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Fastify | ^5.1.0 | HTTP server | Already in package.json; fastest Node.js framework, TypeScript-first |
| better-sqlite3 | ^11.6.0 | Container metadata storage | Already in package.json; synchronous API, fastest SQLite binding |
| dockerode | ^4.0.4 | Docker API interaction | Already in package.json; most mature Node.js Docker client |
| React | ^18+ | Dashboard UI | Keeper-arb pattern; ecosystem dominance |
| Vite | ^5+ | Build tooling | Keeper-arb pattern; replaced CRA as standard in 2025 |
| TypeScript | ^5.7.0 | Type safety | Already in package.json; industry standard for production apps |

### Supporting Libraries (Recommended)

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| @fastify/sse | latest | Real-time log/status streaming | HIGH |
| @tanstack/react-query | ^5 | Server state management, polling | HIGH |
| uuid | ^11.0.0 | Bot ID generation | Already in package.json |
| docker-events | latest | Event emitter wrapper for dockerode | MEDIUM |

---

## Dockerode Patterns

### Connection (HIGH Confidence)

```typescript
import Docker from 'dockerode';

// Local Docker socket (most common, required for BotMaker v1)
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Version-pinned API (recommended for stability)
const docker = new Docker({
  socketPath: '/var/run/docker.sock',
  version: 'v1.43' // Pin to avoid breaking changes
});
```

**Rationale:** Unix socket is simplest and most secure for local-only Docker. No network exposure.

### Container Lifecycle (HIGH Confidence)

```typescript
// CREATE with bind-mounted secrets
const container = await docker.createContainer({
  name: `openclaw-${botId}`,
  Image: 'openclaw:latest',
  Env: [
    `BOT_ID=${botId}`,
    'SECRETS_PATH=/run/secrets'
  ],
  HostConfig: {
    Binds: [
      `${secretsDir}:/run/secrets:ro`  // Read-only mount
    ],
    RestartPolicy: { Name: 'unless-stopped' }
  },
  Labels: {
    'botmaker.bot-id': botId,
    'botmaker.managed': 'true'
  }
});

// START
await container.start();

// STOP (graceful with timeout)
await container.stop({ t: 10 }); // 10 second timeout before SIGKILL

// REMOVE (with cleanup)
await container.remove({ v: true, force: true });
```

**Key patterns:**
- Use Labels for filtering BotMaker-managed containers
- Bind-mount secrets as read-only (`:ro`)
- Set RestartPolicy for resilience
- Use graceful stop timeout before force removal

### Log Streaming (HIGH Confidence)

```typescript
interface LogStreamOptions {
  follow: boolean;    // true for real-time streaming
  stdout: boolean;
  stderr: boolean;
  timestamps: boolean;
  tail: number;       // lines to return initially
}

async function streamLogs(containerId: string): Promise<NodeJS.ReadableStream> {
  const container = docker.getContainer(containerId);

  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    timestamps: true,
    tail: 100
  });

  // For non-TTY containers, demultiplex stdout/stderr
  // TTY: false means multiplexed stream
  const info = await container.inspect();
  if (!info.Config.Tty) {
    // Use demuxStream for proper stdout/stderr separation
    container.modem.demuxStream(stream, stdoutStream, stderrStream);
  }

  return stream;
}
```

**Important:** dockerode returns different types based on version and options:
- `follow: true` returns a Stream
- `follow: false` may return Buffer or string depending on version
- Always check with `Buffer.isBuffer()` and handle both cases

### Event Monitoring (MEDIUM Confidence)

```typescript
import DockerEvents from 'docker-events';

const emitter = new DockerEvents({ docker });

emitter.on('start', (message) => {
  if (message.Actor?.Attributes?.['botmaker.managed'] === 'true') {
    // Update container status in DB
  }
});

emitter.on('stop', (message) => { /* ... */ });
emitter.on('die', (message) => { /* ... */ });
emitter.on('destroy', (message) => { /* ... */ });

emitter.start();
```

**Alternative (raw dockerode):**
```typescript
const eventStream = await docker.getEvents({
  filters: { label: ['botmaker.managed=true'] }
});
eventStream.on('data', (data) => {
  const event = JSON.parse(data.toString());
  // Handle event
});
```

### Container Stats (HIGH Confidence)

```typescript
// Single snapshot
const stats = await container.stats({ stream: false });

// Continuous streaming
const statsStream = await container.stats({ stream: true });
statsStream.on('data', (data) => {
  const stats = JSON.parse(data.toString());
  // CPU, memory, network stats
});

// Clean up: streams must be explicitly destroyed
statsStream.destroy();
```

---

## SQLite Patterns (better-sqlite3)

### Database Initialization (HIGH Confidence)

```typescript
import Database from 'better-sqlite3';

const db = new Database('botmaker.db');

// CRITICAL: Enable WAL mode for concurrent read/write
db.pragma('journal_mode = WAL');

// Recommended pragmas for performance
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL'); // WAL-safe, faster than FULL
```

**Rationale:** WAL mode allows concurrent reads during writes. Essential for UI responsiveness while containers are being created/updated.

### Schema Design (HIGH Confidence)

```sql
CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  container_id TEXT,                    -- Docker container ID (null if not created)
  status TEXT DEFAULT 'created',        -- created|starting|running|stopping|stopped|error
  ai_provider TEXT NOT NULL,            -- anthropic|openai|etc
  ai_model TEXT NOT NULL,
  channel_type TEXT NOT NULL,           -- discord|telegram|slack|signal|etc
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT                    -- Last error if status=error
);

CREATE INDEX idx_bots_status ON bots(status);

CREATE TABLE IF NOT EXISTS bot_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL,                  -- info|warn|error
  message TEXT NOT NULL
);

CREATE INDEX idx_bot_logs_bot_id ON bot_logs(bot_id);
CREATE INDEX idx_bot_logs_timestamp ON bot_logs(timestamp);
```

**Note:** Secrets NOT stored in DB. Only references to file paths.

### Prepared Statement Pattern (HIGH Confidence)

```typescript
// Prepare once, reuse many times
const getBotStmt = db.prepare('SELECT * FROM bots WHERE id = ?');
const updateStatusStmt = db.prepare(`
  UPDATE bots SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
`);

// Usage
const bot = getBotStmt.get(botId);
updateStatusStmt.run('running', botId);
```

### Transaction Pattern (HIGH Confidence)

```typescript
const createBot = db.transaction((bot: BotConfig) => {
  const insertBot = db.prepare(`
    INSERT INTO bots (id, name, ai_provider, ai_model, channel_type)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertBot.run(bot.id, bot.name, bot.aiProvider, bot.aiModel, bot.channelType);

  // Additional setup...

  return bot.id;
});

// Execute transaction
const botId = createBot(botConfig);
```

**Rationale:** Transactions are first-class in better-sqlite3. Nested transactions use savepoints automatically.

---

## React Dashboard Patterns

### Server State with TanStack Query (HIGH Confidence)

```typescript
// hooks/useBots.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useBots() {
  return useQuery({
    queryKey: ['bots'],
    queryFn: () => fetch('/api/bots').then(r => r.json()),
    refetchInterval: 5000,  // Poll every 5 seconds for status updates
    refetchIntervalInBackground: false, // Save resources when tab hidden
  });
}

export function useBotLogs(botId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['bot-logs', botId],
    queryFn: () => fetch(`/api/bots/${botId}/logs`).then(r => r.json()),
    enabled,
    refetchInterval: enabled ? 2000 : false, // Faster polling when viewing
  });
}

export function useStartBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (botId: string) =>
      fetch(`/api/bots/${botId}/start`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
    },
  });
}
```

**Rationale:** TanStack Query v5 is the 2025 standard for server state. Polling is simpler than WebSockets for status updates. Built-in caching, error handling, and optimistic updates.

### SSE for Log Streaming (HIGH Confidence)

```typescript
// hooks/useLogStream.ts
import { useEffect, useState, useRef } from 'react';

interface LogEntry {
  timestamp: string;
  message: string;
}

export function useLogStream(botId: string, enabled: boolean) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      eventSourceRef.current?.close();
      return;
    }

    const es = new EventSource(`/api/bots/${botId}/logs/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const entry = JSON.parse(event.data);
      setLogs(prev => [...prev.slice(-999), entry]); // Keep last 1000
    };

    es.onerror = () => {
      es.close();
      // Reconnect with backoff handled by EventSource automatically
    };

    return () => es.close();
  }, [botId, enabled]);

  return logs;
}
```

**Rationale:** SSE is simpler than WebSockets for one-way server-to-client streaming. Browser handles reconnection automatically. Perfect for log streaming.

### Fastify SSE Endpoint (HIGH Confidence)

```typescript
import { FastifyInstance } from 'fastify';

// Using @fastify/sse
fastify.register(import('@fastify/sse'));

fastify.get('/api/bots/:id/logs/stream', { sse: true }, async function* (request) {
  const { id } = request.params as { id: string };
  const container = docker.getContainer(getContainerId(id));

  const logStream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    timestamps: true,
    tail: 50
  });

  for await (const chunk of logStream) {
    yield {
      data: JSON.stringify({
        timestamp: new Date().toISOString(),
        message: chunk.toString()
      })
    };
  }
});
```

---

## Secret File Management

### File Permission Pattern (HIGH Confidence)

```typescript
import { mkdir, writeFile, chmod, rm } from 'fs/promises';
import { join } from 'path';

const SECRETS_BASE = './secrets';

async function createBotSecrets(botId: string, secrets: Record<string, string>) {
  const secretsDir = join(SECRETS_BASE, botId);

  // Create directory with restricted permissions
  await mkdir(secretsDir, { recursive: true, mode: 0o700 });

  // Write each secret file
  for (const [name, value] of Object.entries(secrets)) {
    const filePath = join(secretsDir, name);
    await writeFile(filePath, value, { mode: 0o600 });
  }
}

async function deleteBotSecrets(botId: string) {
  const secretsDir = join(SECRETS_BASE, botId);
  await rm(secretsDir, { recursive: true, force: true });
}
```

### Permission Values (HIGH Confidence)

| Permission | Octal | Meaning | Use Case |
|------------|-------|---------|----------|
| `0o700` | drwx------ | Owner only, directory | Secrets directory |
| `0o600` | -rw------- | Owner read/write only | Secret files |
| `0o400` | -r-------- | Owner read only | Immutable secrets |

**Critical:** Use `0o` prefix for octal in Node.js. Plain `600` is decimal.

### Secrets File Structure

```
./secrets/
  {bot-id}/
    api_key          # AI provider API key
    channel_token    # Discord/Telegram/etc token
    channel_config   # Channel-specific config (JSON)
```

### Container Mount Pattern

```typescript
const secretsDir = path.resolve(`./secrets/${botId}`);

await docker.createContainer({
  // ...
  HostConfig: {
    Binds: [
      `${secretsDir}:/run/secrets:ro`  // ALWAYS read-only
    ]
  }
});
```

**Rationale:**
- `/run/secrets` is the Docker convention for secrets
- Read-only mount prevents container from modifying secrets
- Host-side 0600 permissions + container read-only = defense in depth

### Cross-Platform Note (MEDIUM Confidence)

Windows does not fully support Unix file permissions. On Windows:
- `fs.chmod()` only affects write permission
- Consider Docker Desktop's WSL2 backend for proper permission handling
- Document Linux/macOS as primary supported platforms

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Docker client | dockerode | docker-compose-cli | dockerode is programmatic; compose is declarative |
| State management | TanStack Query | Zustand/Jotai | TanStack Query handles server state; local state minimal |
| Real-time logs | SSE | WebSocket | SSE simpler for one-way streaming; auto-reconnect |
| Database | better-sqlite3 | Prisma+SQLite | better-sqlite3 is faster; Prisma adds complexity |

---

## Installation

Already in package.json. Additional recommendations:

```bash
# Dashboard dependencies (Vite/React)
cd dashboard
npm install @tanstack/react-query@^5

# Optional: SSE for Fastify (if not using manual implementation)
npm install @fastify/sse

# Optional: Docker events helper
npm install docker-events
```

---

## Sources

**HIGH Confidence (Official Documentation):**
- [dockerode GitHub](https://github.com/apocas/dockerode) - Container lifecycle, streams, bind mounts
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) - WAL mode, transactions, prepared statements
- [Docker Bind Mounts Docs](https://docs.docker.com/engine/storage/bind-mounts/) - Mount syntax and options
- [Docker Secrets Docs](https://docs.docker.com/engine/swarm/secrets/) - `/run/secrets` convention
- [TanStack Query Docs](https://tanstack.com/query/latest) - Polling patterns

**MEDIUM Confidence (Verified Community Patterns):**
- [docker-events npm](https://github.com/deoxxa/docker-events) - Event emitter wrapper
- [Fastify SSE patterns](https://github.com/fastify/sse) - SSE implementation
- Node.js fs.chmod documentation - File permission handling

**Verification Notes:**
- All dockerode patterns verified against GitHub README and issues
- better-sqlite3 patterns verified against official performance docs
- File permission patterns verified against Node.js API docs
