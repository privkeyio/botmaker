# Phase 3: API Layer - Research

**Researched:** 2026-01-30
**Domain:** Fastify REST API with HTTP Basic Auth and SSE streaming
**Confidence:** HIGH

## Summary

This phase implements the HTTP API layer using Fastify 5, which is already installed in the project. The API exposes bot CRUD operations with HTTP Basic Auth protection and real-time log streaming via Server-Sent Events.

Key findings:
- Fastify 5.7.2 is already installed with `@fastify/basic-auth` 6.0.0 and `@fastify/static` 8.0.0
- Official `@fastify/sse` 0.4.0 plugin provides clean SSE support with async generators
- Dockerode provides built-in log streaming with `follow: true` option
- JSON Schema validation provides both runtime validation and TypeScript type inference

**Primary recommendation:** Use `@fastify/sse` for log streaming with dockerode's stream demultiplexing, route-level auth hooks for selective protection, and JSON Schema for request validation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | ^5.7.2 | HTTP framework | Already installed, high performance |
| @fastify/basic-auth | ^6.0.0 | HTTP Basic Auth | Already installed, official plugin |
| @fastify/sse | ^0.4.0 | Server-Sent Events | Official plugin, async generator support |
| @fastify/sensible | ^6.0.4 | HTTP error utilities | httpErrors helper, standardized responses |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dockerode | ^4.0.4 | Container logs | Already installed, stream support |
| stream (node:stream) | built-in | Demultiplexing | Process Docker log streams |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fastify/sse | fastify-sse-v2 | Official plugin preferred, better maintained |
| JSON Schema | TypeBox/Zod | JSON Schema is simpler, no extra deps |
| Manual SSE | @fastify/sse | Plugin handles headers, heartbeat, cleanup |

**Installation:**
```bash
npm install @fastify/sse @fastify/sensible
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── api/
│   ├── index.ts           # Fastify app setup, plugin registration
│   ├── routes/
│   │   ├── bots.ts        # Bot CRUD routes
│   │   ├── health.ts      # Health check route
│   │   └── logs.ts        # SSE log streaming route
│   ├── schemas/
│   │   └── bot.ts         # JSON Schema definitions for validation
│   └── hooks/
│       └── auth.ts        # Basic auth hook
├── services/
│   └── DockerService.ts   # Existing (add getLogs method)
├── db/
│   └── index.ts           # Existing
└── types/
    └── api.ts             # API-specific types
```

### Pattern 1: Plugin-based Route Organization
**What:** Each route file is a Fastify plugin
**When to use:** All routes should follow this pattern
**Example:**
```typescript
// Source: https://fastify.dev/docs/latest/Reference/Plugins/
import { FastifyPluginAsync } from 'fastify';

const botsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { schema: listBotsSchema }, async (request, reply) => {
    // Handler
  });

  fastify.post('/', {
    onRequest: [fastify.basicAuth],
    schema: createBotSchema
  }, async (request, reply) => {
    // Handler
  });
};

export default botsRoutes;
```

### Pattern 2: Selective Route Authentication
**What:** Apply auth only to protected routes via onRequest hook
**When to use:** Health check should be public, all /api/* routes protected
**Example:**
```typescript
// Source: https://github.com/fastify/fastify-basic-auth
// Register auth plugin
await fastify.register(basicAuth, {
  validate: async (username, password, req, reply) => {
    const validUser = process.env.ADMIN_USER || 'admin';
    const validPass = process.env.ADMIN_PASS || 'admin';
    if (username !== validUser || password !== validPass) {
      return new Error('Unauthorized');
    }
  },
  authenticate: { realm: 'BotMaker' }
});

// Apply to all /api routes as prefix hook
fastify.register(async (instance) => {
  instance.addHook('onRequest', instance.basicAuth);
  instance.register(botsRoutes, { prefix: '/bots' });
  instance.register(logsRoutes);
}, { prefix: '/api' });

// Health route outside protected scope
fastify.get('/health', async () => ({ status: 'ok' }));
```

### Pattern 3: SSE Log Streaming with Dockerode
**What:** Bridge Docker container logs to SSE stream
**When to use:** GET /api/bots/:id/logs endpoint
**Example:**
```typescript
// Source: https://github.com/fastify/sse, https://github.com/apocas/dockerode
import { PassThrough } from 'node:stream';

fastify.get<{ Params: { id: string } }>('/:id/logs', { sse: true }, async (request, reply) => {
  const { id } = request.params;
  const container = docker.getContainer(`botmaker-${id}`);

  // Create a PassThrough stream for demultiplexing
  const logStream = new PassThrough();

  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 100
  });

  // Demultiplex Docker stream (separates stdout/stderr headers)
  container.modem.demuxStream(stream, logStream, logStream);

  // Convert to async generator for SSE
  async function* logGenerator() {
    for await (const chunk of logStream) {
      yield { data: chunk.toString('utf8').trimEnd() };
    }
  }

  // Handle client disconnect
  reply.sse.onClose(() => {
    stream.destroy();
    logStream.destroy();
  });

  await reply.sse.send(logGenerator());
});
```

### Pattern 4: JSON Schema Validation
**What:** Define schemas for request validation and response serialization
**When to use:** All routes with request bodies or query params
**Example:**
```typescript
// Source: https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
const createBotSchema = {
  body: {
    type: 'object',
    required: ['name', 'ai_provider', 'model', 'channel_type'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      ai_provider: { type: 'string', enum: ['openai', 'anthropic', 'google'] },
      model: { type: 'string', minLength: 1 },
      channel_type: { type: 'string', enum: ['discord', 'telegram', 'slack', 'signal'] },
      channel_credentials: { type: 'object' },
      api_key: { type: 'string', minLength: 1 }
    }
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        status: { type: 'string' }
      }
    }
  }
};
```

### Anti-Patterns to Avoid
- **Global auth hook for all routes:** Health check needs to be public for container orchestration
- **Blocking log reads:** Always use streaming with `follow: true`, never buffer entire logs
- **Missing stream cleanup:** Always register `onClose` handler to destroy Docker streams
- **Throwing plain strings:** Always throw Error instances for proper error handler chain

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE protocol | Manual headers, keep-alive, formatting | @fastify/sse | Handles headers, heartbeat, cleanup, fallback |
| HTTP errors | Custom error responses | @fastify/sensible | Standardized format, httpErrors helper |
| Request validation | Manual checks in handlers | JSON Schema | Automatic 400 responses, TypeScript inference |
| Docker log demux | Manual buffer parsing | modem.demuxStream() | Docker protocol is complex (8-byte headers) |
| Auth header parsing | Manual Base64 decode | @fastify/basic-auth | Handles edge cases, charset, WWW-Authenticate |

**Key insight:** SSE and Docker logs both involve stream management with proper cleanup - the official plugins handle connection tracking and resource cleanup that's easy to get wrong.

## Common Pitfalls

### Pitfall 1: SSE Connection Not Closing When Container Stops
**What goes wrong:** Log stream ends but SSE connection hangs open
**Why it happens:** Docker stream 'end' event not propagated to SSE
**How to avoid:** Listen for 'end' on demuxed stream, call `reply.sse.close()`
**Warning signs:** Clients stay connected after container stops

### Pitfall 2: Memory Leak from Unclosed Docker Streams
**What goes wrong:** Stream objects accumulate when clients disconnect
**Why it happens:** Missing cleanup on client disconnect (close/abort)
**How to avoid:** Always register `reply.sse.onClose()` to destroy streams
**Warning signs:** Memory growth over time, zombie connections

### Pitfall 3: Auth Bypass on /health Endpoint
**What goes wrong:** Health check accidentally protected, Kubernetes marks pod unhealthy
**Why it happens:** Global auth hook instead of scoped to /api prefix
**How to avoid:** Register health route outside protected plugin scope
**Warning signs:** Container restarts, health check failures in orchestration

### Pitfall 4: Docker 404 Not Handled Gracefully
**What goes wrong:** 500 error when requesting logs for non-existent container
**Why it happens:** Raw Docker error bubbles up without mapping
**How to avoid:** Catch 404 from Docker, return 404 HTTP response
**Warning signs:** 500 errors in logs for missing containers

### Pitfall 5: Validation Error Exposes Schema Details
**What goes wrong:** Default Ajv error messages expose internal schema structure
**Why it happens:** Not customizing error formatter
**How to avoid:** Use `setSchemaErrorFormatter` for user-friendly messages
**Warning signs:** Response contains "should match pattern", "should have required property"

## Code Examples

Verified patterns from official sources:

### Fastify App Setup with Plugins
```typescript
// Source: https://fastify.dev/docs/latest/Reference/TypeScript/
import Fastify from 'fastify';
import basicAuth from '@fastify/basic-auth';
import sse from '@fastify/sse';
import sensible from '@fastify/sensible';

const app = Fastify({ logger: true });

// Register plugins
await app.register(sensible);
await app.register(sse);
await app.register(basicAuth, {
  validate: async (username, password) => {
    if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
      return new Error('Unauthorized');
    }
  },
  authenticate: { realm: 'BotMaker' }
});

export default app;
```

### Error Handler Setup
```typescript
// Source: https://fastify.dev/docs/latest/Reference/Errors/
app.setErrorHandler((error, request, reply) => {
  // Log all errors
  request.log.error(error);

  // Handle validation errors
  if (error.validation) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed'
    });
  }

  // Handle auth errors
  if (error.statusCode === 401) {
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  // Handle not found (from Docker)
  if (error.message?.includes('not found') || error.statusCode === 404) {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: error.message || 'Resource not found'
    });
  }

  // Default 500
  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});
```

### Docker Log Streaming
```typescript
// Source: https://github.com/apocas/dockerode/blob/master/examples/logs.js
import { PassThrough } from 'node:stream';
import Docker from 'dockerode';

const docker = new Docker();

async function streamLogs(containerId: string): Promise<{
  logStream: PassThrough;
  cleanup: () => void;
}> {
  const container = docker.getContainer(containerId);
  const logStream = new PassThrough();

  const stream = await container.logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail: 100,
    timestamps: true
  });

  // Demultiplex Docker stream
  container.modem.demuxStream(stream, logStream, logStream);

  // Handle stream end
  stream.on('end', () => {
    logStream.end();
  });

  return {
    logStream,
    cleanup: () => {
      stream.destroy();
      logStream.destroy();
    }
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fastify-sse (community) | @fastify/sse (official) | 2024 | Official support, better TypeScript |
| Manual validation | JSON Schema + Type Providers | Fastify 4+ | Type inference from schemas |
| fastify v4 | fastify v5 | 2024 | ESM default, new type APIs |

**Deprecated/outdated:**
- `fastify-sse` (community): Use `@fastify/sse` official plugin
- `fastify-basic-auth` (old name): Use `@fastify/basic-auth`

## Open Questions

Things that couldn't be fully resolved:

1. **Container log timestamps format**
   - What we know: Docker provides `timestamps: true` option
   - What's unclear: Exact format OpenClaw containers output
   - Recommendation: Enable timestamps, parse in frontend if needed

2. **Rate limiting for API**
   - What we know: `@fastify/rate-limit` exists
   - What's unclear: Whether needed for v1 (single user, self-hosted)
   - Recommendation: Defer to future phase, not in requirements

## Sources

### Primary (HIGH confidence)
- [@fastify/basic-auth GitHub README](https://github.com/fastify/fastify-basic-auth/blob/main/README.md) - Full API documentation
- [@fastify/sse GitHub](https://github.com/fastify/sse) - SSE plugin usage
- [Fastify TypeScript Docs](https://fastify.dev/docs/latest/Reference/TypeScript/) - Type setup
- [Fastify Validation Docs](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) - Schema validation
- [Fastify Errors Docs](https://fastify.dev/docs/latest/Reference/Errors/) - Error handling
- [dockerode logs example](https://github.com/apocas/dockerode/blob/master/examples/logs.js) - Log streaming

### Secondary (MEDIUM confidence)
- [Fastify Plugin Guide](https://fastify.dev/docs/latest/Guides/Plugins-Guide/) - Route organization
- [fastify-healthcheck npm](https://www.npmjs.com/package/fastify-healthcheck) - Health check patterns

### Tertiary (LOW confidence)
- N/A - All critical patterns verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages verified in npm registry, peer deps confirmed
- Architecture: HIGH - Patterns from official Fastify documentation
- Pitfalls: HIGH - Common issues documented in GitHub issues and official docs

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (60 days - stable ecosystem)
