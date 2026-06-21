import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { startApiTestDb, type ApiTestDb } from './harness';
import { seed, type SeedResult } from './seed';
import { AppModule } from '../src/app.module';

let db: ApiTestDb;
let app: INestApplication;
let s: SeedResult;

beforeAll(async () => {
  db = await startApiTestDb(54345); // also sets process.env.DATABASE_URL for the Nest PrismaService
  s = await seed(db.prisma);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});
afterAll(async () => {
  await app?.close();
  await db?.stop();
});

describe('E2E — the real Nest app (DI + controllers + guard + Prisma)', () => {
  it('serves the public catalog', async () => {
    const res = await request(app.getHttpServer()).get(`/catalog?branchId=${s.branchA}`);
    expect(res.status).toBe(200);
    expect((res.body as { productId: string }[]).map((r) => r.productId)).toContain(s.milk);
  });

  it('OTP login → add address → COD checkout, end to end over HTTP', async () => {
    const phone = '+201000000001';
    const requested = await request(app.getHttpServer()).post('/auth/otp/request').send({ phone });
    expect(requested.status).toBe(201);
    const code = requested.body.devCode as string;

    const verified = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ phone, code });
    const token = verified.body.token as string;
    expect(token).toBeTruthy();

    const addr = await request(app.getHttpServer())
      .post('/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'المنزل', lat: 30.02, lng: 31.02, text: 'المعادي' });
    expect(addr.status).toBe(201);

    const checkout = await request(app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        addressId: addr.body.id,
        items: [{ productId: s.milk, qty: 1 }],
        paymentMethod: 'cod',
        idempotencyKey: 'e2e-key-1',
      });
    expect(checkout.status).toBe(201);
    expect(checkout.body.status).toBe('placed');
    expect(checkout.body.total).toBe(6500);
  });

  it('rejects an unauthenticated protected route (401)', async () => {
    const res = await request(app.getHttpServer()).get('/orders');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed routing request via the Zod pipe (400)', async () => {
    const res = await request(app.getHttpServer())
      .post('/routing/resolve')
      .send({ lat: 999, lng: 31 });
    expect(res.status).toBe(400);
  });
});
