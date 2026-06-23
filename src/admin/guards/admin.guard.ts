import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../../auth/auth-user';
import { ConfigService } from '../../config/config.service';

interface RequestWithUser {
  user?: AuthUser;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const adminAddress = this.configService.get('ADMIN_ADDRESS');

    if (!request.user || request.user.role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }

    if (adminAddress && request.user.address !== adminAddress) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
