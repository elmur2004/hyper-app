import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import { EgyptPhoneSchema } from '@hyper/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../../common/token.service';

const hashCode = (code: string): string => createHash('sha256').update(code).digest('hex');

export interface OtpRequestResult {
  challengeId: string;
  /** Returned ONLY in non-production so tests/dev can complete the flow without an SMS gateway. */
  devCode?: string;
}

/**
 * Phone-OTP auth. The SMS send is stubbed (a provider is wired in hardening — Plan §2.4/§4).
 * Codes are stored hashed with a short TTL; verification is single-use.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async requestOtp(phone: string): Promise<OtpRequestResult> {
    const parsed = EgyptPhoneSchema.safeParse(phone);
    if (!parsed.success) throw new BadRequestException('invalid Egyptian phone');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        phone,
        codeHash: hashCode(code),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    // TODO(hardening): dispatch `code` via the SMS provider instead of returning it.
    const devCode = process.env.NODE_ENV === 'production' ? undefined : code;
    return { challengeId: challenge.id, devCode };
  }

  async verifyOtp(phone: string, code: string): Promise<{ token: string; customerId: string }> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.codeHash !== hashCode(code)) {
      throw new UnauthorizedException('invalid or expired code');
    }
    await this.prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
    const customer = await this.prisma.customer.upsert({
      where: { phone },
      create: { phone, name: '' },
      update: {},
    });
    const token = this.tokens.sign({ userId: customer.id, role: 'customer', branchId: null });
    return { token, customerId: customer.id };
  }

  /** Dev-only staff login (real staff auth is OTP/SSO in hardening). */
  async staffLogin(phone: string): Promise<{ token: string }> {
    const staff = await this.prisma.staffUser.findUnique({ where: { phone } });
    if (!staff) throw new UnauthorizedException('unknown staff');
    return {
      token: this.tokens.sign({ userId: staff.id, role: staff.role, branchId: staff.branchId }),
    };
  }
}
