import EmbeddedPostgres from 'embedded-postgres';
import { Pool } from 'pg';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const sqlPath = (name: string) => fileURLToPath(new URL(`../prisma/${name}`, import.meta.url));

export interface ApiTestDb {
  prisma: PrismaClient;
  url: string;
  stop: () => Promise<void>;
}

/**
 * Boot a throwaway real Postgres, apply the Prisma-generated DDL + extras (CHECKs + the
 * customer_catalog view), and return a connected PrismaClient. Real DB ⇒ real constraints,
 * transactions, and concurrency for the integration tests.
 */
export async function startApiTestDb(port: number): Promise<ApiTestDb> {
  const dataDir = mkdtempSync(join(tmpdir(), 'hyper-api-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    // Arabic-first: the cluster MUST be UTF-8 (Windows initdb defaults to WIN1252).
    initdbFlags: ['--encoding=UTF8', '--no-locale'],
    onLog: () => undefined,
  });
  await pg.initialise();
  await pg.start();

  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;

  // Apply schema via a plain pg connection (multi-statement simple query).
  const pool = new Pool({ connectionString: url });
  await pool.query(readFileSync(sqlPath('init.sql'), 'utf8'));
  await pool.query(readFileSync(sqlPath('extras.sql'), 'utf8'));
  await pool.end();

  process.env.DATABASE_URL = url;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.$connect();

  return {
    prisma,
    url,
    stop: async () => {
      await prisma.$disconnect();
      await pg.stop();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
