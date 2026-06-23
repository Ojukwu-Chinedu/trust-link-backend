import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUser } from '../auth-user';

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization)
      ? authorization[0]
      : authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = this.extractUser(token);
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = user;
    return true;
  }

  /**
   * Tries to extract authenticated user context from the token:
   * 1. If the token looks like a JWT (3 base64url segments), decode the payload
   *    and return the sub and optional role claims.
   * 2. Otherwise treat the whole token as a raw address (legacy / test path).
   */
  private extractUser(token: string): AuthUser | null {
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf8'),
        ) as { role?: unknown; sub?: string };
        if (typeof payload.sub === 'string' && payload.sub) {
          return {
            address: payload.sub,
            role: typeof payload.role === 'string' ? payload.role : undefined,
          };
        }
      } catch {
        // not a valid JWT payload — fall through
      }
    }
    return token ? { address: token } : null;
  }
}
