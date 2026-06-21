import EmbeddedPostgres from 'embedded-postgres';
import { Pool } from 'pg';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface TestDb {
  pool: Pool;
  config: DbConfig;
  stop: () => Promise<void>;
}

/**
 * Boot a throwaway real Postgres (via embedded-postgres — no Docker/admin needed) and
 * return a connection Pool. Used by the Phase-0 DB spikes so concurrency/locking is real.
 * Each caller should pass a distinct `port` (tests run files serially, but be safe).
 */
export async function startTestDb(opts: { port: number; maxConnections?: number }): Promise<TestDb> {
  const dataDir = mkdtempSync(join(tmpdir(), 'hyper-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: opts.port,
    persistent: false,
    // Arabic-first: force a UTF-8 cluster (Windows initdb defaults to WIN1252).
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    onLog: () => undefined,
  });
  await pg.initialise();
  await pg.start();

  const config: DbConfig = {
    host: '127.0.0.1',
    port: opts.port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  };

  const pool = new Pool({ ...config, max: opts.maxConnections ?? 30 });

  return {
    pool,
    config,
    stop: async () => {
      await pool.end();
      await pg.stop();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
