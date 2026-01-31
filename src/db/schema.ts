import type Database from 'better-sqlite3';

/**
 * Create database schema - bots table and indexes.
 * Uses CREATE TABLE IF NOT EXISTS for idempotent initialization.
 */
export function createSchema(db: Database.Database): void {
  // Create bots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hostname TEXT NOT NULL UNIQUE,
      ai_provider TEXT NOT NULL,
      model TEXT NOT NULL,
      channel_type TEXT NOT NULL,
      container_id TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Migration: Add hostname column if missing (for existing databases)
  migrateAddHostnameColumn(db);

  // Create indexes for common queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bots_hostname ON bots(hostname)`);
}

/**
 * Migration: Add hostname column to existing bots table.
 * Populates hostname from name for existing rows.
 */
function migrateAddHostnameColumn(db: Database.Database): void {
  // Check if hostname column exists using PRAGMA table_info
  const columns = db.prepare('PRAGMA table_info(bots)').all() as { name: string }[];
  const hasHostname = columns.some(col => col.name === 'hostname');

  if (!hasHostname) {
    // Add column (SQLite doesn't support NOT NULL for ALTER TABLE ADD COLUMN without default)
    db.exec('ALTER TABLE bots ADD COLUMN hostname TEXT');
    // Populate hostname from name for existing rows
    db.exec('UPDATE bots SET hostname = name WHERE hostname IS NULL');
  }
}
