import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createSchema } from './schema.js';
import { runMigrations } from './migrations.js';

let db: Database.Database | null = null;

/**
 * Initialize the database.
 * Creates data directory if needed, opens SQLite with WAL mode,
 * creates schema and runs migrations.
 */
export function initDb(dataDir: string): Database.Database {
  if (db) {
    return db;
  }

  // Create data directory if it doesn't exist
  mkdirSync(dataDir, { recursive: true });

  // Open database
  const dbPath = join(dataDir, 'botmaker.db');
  db = new Database(dbPath);

  // Enable WAL mode for concurrent access
  db.pragma('journal_mode = WAL');

  // Create schema and run migrations
  createSchema(db);
  runMigrations(db);

  return db;
}

/**
 * Get the database instance.
 * Throws if database has not been initialized.
 */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/**
 * Close the database connection.
 * Resets singleton for potential re-initialization.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
