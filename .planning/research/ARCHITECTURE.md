# Architecture Patterns

**Domain:** Bot container management system
**Researched:** 2026-01-30
**Confidence:** HIGH (based on keeper-arb reference + dockerode docs + Docker best practices)

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BotMaker System                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Frontend   │───▶│   Fastify    │───▶│   Docker Service     │  │
│  │   (React)    │    │   API        │    │   (dockerode)        │  │
│  └──────────────┘    └──────┬───────┘    └──────────┬───────────┘  │
│                             │                       │               │
│                             ▼                       ▼               │
│                      ┌──────────────┐    ┌──────────────────────┐  │
│                      │   SQLite     │    │   Docker Daemon      │  │
│                      │   (metadata) │    │   (containers)       │  │
│                      └──────────────┘    └──────────────────────┘  │
│                                                    │               │
│                                                    ▼               │
│                                          ┌──────────────────────┐  │
│                                          │   Secrets FS         │  │
│                                          │   ./secrets/{id}/    │  │
│                                          └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Frontend (React)** | UI rendering, user input, state display | API (HTTP REST) |
| **Fastify API** | Request handling, auth, validation, orchestration | Frontend, DB, Docker Service |
| **Docker Service** | Container lifecycle (create/start/stop/delete), log streaming | API, Docker Daemon, Secrets FS |
| **SQLite DB** | Bot metadata persistence, config storage | API only |
| **Secrets FS** | Secret file storage per bot | Docker Service (write), Containers (read-only mount) |
| **Docker Daemon** | Container runtime | Docker Service (via socket) |

### Data Flow

**Bot Creation Flow:**
```
User fills form → Frontend POST /api/bots
→ API validates input
→ API writes secrets to ./secrets/{bot-id}/
→ API creates DB record (bot metadata)
→ Docker Service pulls image (if needed)
→ Docker Service creates container with bind mounts
→ Docker Service starts container
→ API returns bot object with status
```

**Bot Status Query Flow:**
```
Frontend GET /api/bots
→ API queries DB for bot list
→ For each bot: Docker Service inspects container
→ API merges DB metadata + container status
→ Returns unified bot list
```

**Log Streaming Flow:**
```
Frontend opens SSE /api/bots/{id}/logs
→ API calls Docker Service attachLogs()
→ Docker Service streams container stdout/stderr
→ API demuxes and forwards via SSE
→ Frontend displays in terminal component
```

## Backend API Structure (Fastify)

### Route Organization

```
src/
├── index.ts              # Entry point, server bootstrap
├── server.ts             # Fastify setup, middleware, route registration
├── config.ts             # Environment/config loading
├── db.ts                 # SQLite schema + operations
├── docker/
│   ├── service.ts        # Docker abstraction layer
│   ├── container.ts      # Container lifecycle methods
│   └── types.ts          # Docker-related types
├── routes/
│   ├── bots.ts           # /api/bots/* handlers
│   ├── health.ts         # /api/health handler
│   └── auth.ts           # Auth middleware (if separated)
└── secrets/
    └── manager.ts        # Secrets filesystem operations
```

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Health check (no auth) |
| `GET` | `/api/bots` | List all bots with status |
| `POST` | `/api/bots` | Create new bot |
| `GET` | `/api/bots/:id` | Get bot details |
| `DELETE` | `/api/bots/:id` | Delete bot (stop container, remove secrets) |
| `POST` | `/api/bots/:id/start` | Start bot container |
| `POST` | `/api/bots/:id/stop` | Stop bot container |
| `GET` | `/api/bots/:id/logs` | SSE stream of container logs |

### Request/Response Patterns

Following keeper-arb patterns:
- JSON request/response bodies
- Basic auth via `@fastify/basic-auth`
- Static dashboard served via `@fastify/static`
- Health endpoint excluded from auth

```typescript
// Route handler pattern (from keeper-arb)
fastify.get('/api/bots', async () => {
  const bots = getAllBots();            // DB query
  const statuses = await getContainerStatuses(bots); // Docker queries
  return bots.map((b, i) => ({ ...b, ...statuses[i] }));
});
```

## Docker Abstraction Layer

### Service Pattern

Wrap dockerode in a service class that:
1. Manages single Docker client instance
2. Provides typed methods for container operations
3. Handles error mapping (Docker errors → application errors)
4. Manages container naming conventions

```typescript
// src/docker/service.ts
import Docker from 'dockerode';

export class DockerService {
  private client: Docker;

  constructor() {
    this.client = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async createBotContainer(config: BotContainerConfig): Promise<string> {
    const container = await this.client.createContainer({
      Image: 'openclaw:latest',
      name: `botmaker-${config.botId}`,
      HostConfig: {
        Binds: [`${config.secretsPath}:/run/secrets:ro`],
        RestartPolicy: { Name: 'unless-stopped' },
      },
      Env: [
        `BOT_ID=${config.botId}`,
        // Non-secret env vars only
      ],
    });
    return container.id;
  }

  async startContainer(containerId: string): Promise<void> { ... }
  async stopContainer(containerId: string): Promise<void> { ... }
  async removeContainer(containerId: string): Promise<void> { ... }
  async getContainerStatus(containerId: string): Promise<ContainerStatus> { ... }
  async streamLogs(containerId: string): Promise<NodeJS.ReadableStream> { ... }
}
```

### Container Naming Convention

```
botmaker-{bot-uuid}
```

This allows:
- Easy identification of BotMaker-managed containers
- Simple cleanup (list containers matching prefix)
- Uniqueness via UUID

### Container Configuration

```typescript
interface BotContainerConfig {
  botId: string;                    // UUID
  imageName: string;                // e.g., 'openclaw:latest'
  secretsPath: string;              // Host path: ./secrets/{botId}
  labels: Record<string, string>;   // Metadata for filtering
}
```

## Database Schema

### Core Tables

```sql
-- Bot metadata (source of truth for bot config)
CREATE TABLE bots (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT NOT NULL UNIQUE,        -- User-friendly name
  aiProvider TEXT NOT NULL,         -- 'openai', 'anthropic', etc.
  aiModel TEXT NOT NULL,            -- 'gpt-4', 'claude-3-opus', etc.
  channel TEXT NOT NULL,            -- 'discord', 'telegram', 'slack', etc.
  containerId TEXT,                 -- Docker container ID (set after creation)
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for listing
CREATE INDEX idx_bots_name ON bots(name);
```

### Schema Design Rationale

1. **Bot ID as UUID** - Avoids sequential IDs (security), enables pre-generation for secrets dir
2. **Container ID nullable** - Bot record created before container; ID set after Docker create
3. **No secrets in DB** - All secrets on filesystem only
4. **Channel as string** - Supports any OpenClaw channel without schema changes
5. **Timestamps as TEXT** - SQLite datetime strings, matches keeper-arb pattern

### Prepared Statements Pattern

Following better-sqlite3 best practices from keeper-arb:

```typescript
// Prepared statements for performance
const insertBot = db.prepare(`
  INSERT INTO bots (id, name, aiProvider, aiModel, channel)
  VALUES (?, ?, ?, ?, ?)
`);

const getBotById = db.prepare('SELECT * FROM bots WHERE id = ?');
const getAllBots = db.prepare('SELECT * FROM bots ORDER BY createdAt DESC');
const updateContainerId = db.prepare('UPDATE bots SET containerId = ? WHERE id = ?');
const deleteBot = db.prepare('DELETE FROM bots WHERE id = ?');
```

## Secrets Storage Layout

### Filesystem Structure

```
./secrets/
└── {bot-uuid}/
    ├── api_key              # AI provider API key
    ├── channel_token        # Discord/Telegram/etc bot token
    └── channel_config       # Additional channel-specific secrets (optional)
```

### Security Properties

| Property | Implementation |
|----------|---------------|
| **Isolation** | Each bot has own directory, no sharing |
| **Permissions** | Directory: 700, Files: 600, owned by app user |
| **Mount type** | Bind mount with `:ro` (read-only) |
| **Container path** | `/run/secrets/` (Docker convention) |
| **Never in DB** | Secrets stored only on filesystem |
| **Never in env** | Container reads from mounted files, not environment |

### Secrets Manager Implementation

```typescript
// src/secrets/manager.ts
import { mkdir, writeFile, rm, chmod } from 'fs/promises';
import { join } from 'path';

const SECRETS_BASE = './secrets';

export async function createSecrets(botId: string, secrets: BotSecrets): Promise<string> {
  const dir = join(SECRETS_BASE, botId);
  await mkdir(dir, { mode: 0o700, recursive: true });

  await writeFile(join(dir, 'api_key'), secrets.apiKey, { mode: 0o600 });
  await writeFile(join(dir, 'channel_token'), secrets.channelToken, { mode: 0o600 });

  if (secrets.channelConfig) {
    await writeFile(join(dir, 'channel_config'), secrets.channelConfig, { mode: 0o600 });
  }

  return dir; // Return absolute path for Docker bind mount
}

export async function deleteSecrets(botId: string): Promise<void> {
  const dir = join(SECRETS_BASE, botId);
  await rm(dir, { recursive: true, force: true });
}
```

## Frontend Component Structure

### Directory Layout

```
dashboard/
├── src/
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root component, routing
│   ├── api/
│   │   └── client.ts           # API client with auth handling
│   ├── components/
│   │   ├── Layout.tsx          # App shell (sidebar, header)
│   │   ├── BotCard.tsx         # Bot status card
│   │   ├── BotForm.tsx         # Create bot form
│   │   ├── BotList.tsx         # Bot list view
│   │   ├── LogViewer.tsx       # Container log terminal
│   │   └── StatusBadge.tsx     # Running/stopped/error badge
│   ├── hooks/
│   │   ├── useBots.ts          # Bot data fetching
│   │   ├── useLogs.ts          # Log SSE subscription
│   │   └── useAuth.ts          # Auth state
│   └── types/
│       └── index.ts            # Shared types
└── index.html
```

### Key Components

**BotCard** - Displays single bot with:
- Name, AI provider/model
- Status badge (running/stopped/error)
- Start/Stop/Delete actions
- Link to logs view

**BotForm** - Create bot form with:
- Name input
- AI provider dropdown (OpenAI, Anthropic, etc.)
- Model dropdown (dynamic based on provider)
- Channel dropdown (Discord, Telegram, Slack, etc.)
- API key input (password field)
- Channel token input (password field)

**LogViewer** - Terminal-style log display:
- SSE connection to `/api/bots/:id/logs`
- Auto-scroll with pause-on-scroll
- ANSI color support (optional)
- Clear/download actions

### UI Patterns (keeper-arb reference)

From keeper-arb `index.css`:
- Dark theme: `#1a1a1a` background, `#0f0` text accents
- Monospace font throughout
- Card-based layout with clean borders
- Status indicators with color coding

## Patterns to Follow

### Pattern 1: Service Layer Abstraction

**What:** Wrap external dependencies (Docker, filesystem) in service classes
**When:** Any external I/O that needs mocking/testing or error handling
**Example:** DockerService wraps dockerode, SecretsManager wraps fs

### Pattern 2: Stateless API Handlers

**What:** Route handlers query services, no persistent state in memory
**When:** All API routes
**Why:** Simplifies reasoning, enables future horizontal scaling
**Example:**
```typescript
// Good: Query Docker for current state
fastify.get('/api/bots/:id', async (req) => {
  const bot = getBotFromDb(req.params.id);
  const status = await dockerService.getContainerStatus(bot.containerId);
  return { ...bot, status };
});
```

### Pattern 3: Secrets as Files, Not Env Vars

**What:** All secrets stored in files, mounted read-only into containers
**When:** Any sensitive configuration
**Why:** Avoids secrets in process list, container inspect, logs

## Anti-Patterns to Avoid

### Anti-Pattern 1: Secrets in Database

**What:** Storing API keys, tokens in SQLite
**Why bad:** Database files can be copied, backed up, exposed
**Instead:** Filesystem with restricted permissions, separate backup policy

### Anti-Pattern 2: Container State as Source of Truth

**What:** Relying solely on Docker for bot metadata
**Why bad:** Container deletion loses all config; no way to recreate
**Instead:** DB is source of truth for config; Docker is source of truth for runtime state

### Anti-Pattern 3: Blocking Log Streams

**What:** Buffering entire container log output before sending
**Why bad:** Memory exhaustion, latency, stale data
**Instead:** SSE streaming with backpressure handling

### Anti-Pattern 4: Shared Secrets Directory

**What:** All bots reading from same secrets location
**Why bad:** Compromised container accesses all secrets
**Instead:** Per-bot directories with isolated mounts

## Suggested Build Order

Based on component dependencies:

### Phase 1: Foundation
1. **Database** - Schema, init, basic CRUD
2. **Secrets Manager** - Create/delete secrets directories
3. **Config** - Environment loading, validation

*Rationale: DB and secrets are dependencies for everything else*

### Phase 2: Docker Integration
4. **Docker Service** - Container create/start/stop/remove
5. **Container Status** - Inspect, status mapping

*Rationale: Needs secrets manager for bind mount paths*

### Phase 3: API Layer
6. **Fastify Server** - Setup, auth, static serving
7. **Bot Routes** - CRUD endpoints
8. **Log Streaming** - SSE endpoint

*Rationale: Needs Docker service and DB*

### Phase 4: Frontend
9. **API Client** - Fetch wrapper with auth
10. **Bot List** - Main dashboard view
11. **Bot Form** - Create bot UI
12. **Log Viewer** - SSE log display

*Rationale: Needs working API*

### Phase 5: Polish
13. **Error Handling** - Unified error responses
14. **UI Polish** - Loading states, transitions
15. **Docker Image** - Multi-stage build

*Rationale: Refine after core flow works*

## Sources

- [Fastify Routes Documentation](https://fastify.dev/docs/latest/Reference/Routes/)
- [dockerode GitHub](https://github.com/apocas/dockerode) - Docker API wrapper for Node.js
- [@types/dockerode npm](https://www.npmjs.com/package/@types/dockerode) - TypeScript definitions
- [Docker Secrets Documentation](https://docs.docker.com/engine/swarm/secrets/) - Secrets management patterns
- [Docker Compose Secrets](https://docs.docker.com/compose/how-tos/use-secrets/) - File-based secrets
- keeper-arb reference implementation (`/home/jgarzik/repo/keeper-arb/src/server.ts`, `/home/jgarzik/repo/keeper-arb/src/db.ts`)
