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

    const address = header.slice('Bearer '.length).trim();
    if (!address) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = { address };
    return true;
  }
}
