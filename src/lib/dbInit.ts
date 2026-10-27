import { sql } from "drizzle-orm";
import { db } from "@/db";

const globalInit = globalThis as typeof globalThis & {
  __polhubSchemaReady?: Promise<void>;
};

/**
 * Tworzy tabele, jeśli ich nie ma (np. świeża baza po restarcie środowiska).
 * Uruchamiane leniwie i tylko raz na proces.
 */
export function ensureSchema(): Promise<void> {
  if (!globalInit.__polhubSchemaReady) {
    globalInit.__polhubSchemaReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS videos (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'Amatorskie',
          uploader TEXT NOT NULL DEFAULT 'Gnam',
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL DEFAULT 'video/mp4',
          file_size INTEGER NOT NULL DEFAULT 0,
          duration_seconds INTEGER NOT NULL DEFAULT 0,
          thumbnail TEXT,
          data BYTEA NOT NULL,
          views INTEGER NOT NULL DEFAULT 0,
          likes INTEGER NOT NULL DEFAULT 0,
          dislikes INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`);
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP`
      );
      await db.execute(
        sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT`
      );
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
          parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
          username TEXT NOT NULL,
          body TEXT NOT NULL,
          likes INTEGER NOT NULL DEFAULT 0,
          dislikes INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id INTEGER
          REFERENCES comments(id) ON DELETE CASCADE
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS comments_video_id_idx ON comments (video_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON comments (parent_id)
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS comment_votes (
          id SERIAL PRIMARY KEY,
          comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
          username TEXT NOT NULL,
          value INTEGER NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS comment_votes_comment_user_idx
          ON comment_votes (comment_id, username)
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS verifications (
          username TEXT PRIMARY KEY,
          granted_by TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS verification_revocations (
          username TEXT PRIMARY KEY,
          revoked_by TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          subscriber TEXT NOT NULL,
          channel TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_pair_idx
          ON subscriptions (subscriber, channel)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS subscriptions_channel_idx
          ON subscriptions (channel)
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS admins (
          username TEXT PRIMARY KEY,
          granted_by TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((err) => {
      globalInit.__polhubSchemaReady = undefined;
      throw err;
    });
  }
  return globalInit.__polhubSchemaReady;
}