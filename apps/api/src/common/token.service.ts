import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role } from '@prisma/client';
import type { AuthContext } from './authz';

const SECRET = process.env.AUTH_TOKEN_SECRET ?? 'dev-only-insecure-secret-change-me';

const b64url = (buf: Buffer | string): string =>
  Buffer.from(buf).toString('base64url');

interface Claims {
  userId: string;
  role: Role;
  branchId: string | null;
  exp: number;
}

/**
 * Minimal signed token (HMAC-SHA256 over a base64url JSON payload). Self-contained — no
 * external JWT dep for the spike. Swap for a vetted JWT/OTP-session lib in hardening.
 */
@Injectable()
export class TokenService {
  sign(ctx: AuthContext, ttlSeconds = 60 * 60 * 24 * 30): string {
    const claims: Claims = { ...ctx, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
    const payload = b64url(JSON.stringify(claims));
    const sig = b64url(createHmac('sha256', SECRET).update(payload).digest());
    return `${payload}.${sig}`;
  }

  verify(token: string): AuthContext {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) throw new UnauthorizedException('malformed token');
    const expected = b64url(createHmac('sha256', SECRET).update(payload).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('bad signature');
    }
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Claims;
    if (claims.exp * 1000 < Date.now()) throw new UnauthorizedException('token expired');
    return { userId: claims.userId, role: claims.role, branchId: claims.branchId };
  }
}
