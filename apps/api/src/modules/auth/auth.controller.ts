import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() body: { phone: string }) {
    return this.auth.requestOtp(body.phone);
  }

  @Post('otp/verify')
  verifyOtp(@Body() body: { phone: string; code: string }) {
    return this.auth.verifyOtp(body.phone, body.code);
  }

  /** Dev-only staff login (hardening: real staff auth). */
  @Post('staff/login')
  staffLogin(@Body() body: { phone: string }) {
    return this.auth.staffLogin(body.phone);
  }
}
