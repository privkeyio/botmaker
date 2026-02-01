import type Database from 'better-sqlite3';

/**
 * Run database migrations.
 * Tracks schema version in migrations table.
 * Currently at v0 (initial schema) - pattern ready for future migrations.
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  // Get current version
  const row = db.prepare('SELECT MAX(version) as version FROM migrations').get() as { version: number | null };
  const currentVersion = row.version ?? -1;

  // Migration v0: Initial schema (created by createSchema, just track it)
  if (currentVersion < 0) {
    db.transaction(() => {
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(
        0,
        new Date().toISOString()
      );
    })();
  }

  // Migration v1: Add port column for gap-aware port allocation
  if (currentVersion < 1) {
    db.transaction(() => {
      db.exec('ALTER TABLE bots ADD COLUMN port INTEGER');
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(
        1,
        new Date().toISOString()
      );
    })();
  }

  // Migration v2: Add gateway_token column for OpenClaw authentication
  if (currentVersion < 2) {
    db.transaction(() => {
      db.exec('ALTER TABLE bots ADD COLUMN gateway_token TEXT');
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(
        2,
        new Date().toISOString()
      );
    })();
  }

  // Migration v3: Add tags column for API routing
  if (currentVersion < 3) {
    db.transaction(() => {
      db.exec('ALTER TABLE bots ADD COLUMN tags TEXT');
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(
        3,
        new Date().toISOString()
      );
    })();
  }

  // Migration v4: Add tags column (retry - v3 failed silently)
  if (currentVersion < 4) {
    db.transaction(() => {
      const columns = db.prepare('PRAGMA table_info(bots)').all() as { name: string }[];
      if (!columns.some(col => col.name === 'tags')) {
        db.exec('ALTER TABLE bots ADD COLUMN tags TEXT');
      }
      db.prepare('INSERT INTO migrations (version, applied_at) VALUES (?, ?)').run(
        4,
        new Date().toISOString()
      );
    })();
  }
}
