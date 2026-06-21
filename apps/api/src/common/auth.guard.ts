import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { TokenService } from './token.service';
import type { AuthContext } from './authz';

interface ActorRequest {
  headers: Record<string, string | string[] | undefined>;
  actor?: AuthContext;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<ActorRequest>();
    const header = req.headers['authorization'];
    const value = Array.isArray(header) ? header[0] : header;
    if (!value || !value.startsWith('Bearer ')) {
      throw new UnauthorizedException('missing bearer token');
    }
    req.actor = this.tokens.verify(value.slice(7)); // throws Unauthorized on bad/expired token
    return true;
  }
}

/** Inject the authenticated actor resolved by AuthGuard. */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    return ctx.switchToHttp().getRequest<ActorRequest>().actor!;
  },
);
