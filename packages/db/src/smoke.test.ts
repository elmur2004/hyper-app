import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pg: EmbeddedPostgres;
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'hyper-pg-smoke-'));
  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: 54329,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
});

afterAll(async () => {
  await pg?.stop();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

describe('embedded-postgres smoke', () => {
  it('boots a real Postgres and runs SELECT 1', async () => {
    const client = pg.getPgClient();
    await client.connect();
    const res = await client.query<{ one: number }>('SELECT 1 AS one');
    expect(res.rows[0]?.one).toBe(1);
    const version = await client.query<{ version: string }>('SELECT version()');
    expect(version.rows[0]?.version).toMatch(/PostgreSQL/);
    await client.end();
  });
});
