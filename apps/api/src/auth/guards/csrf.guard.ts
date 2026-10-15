import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: string[];

  constructor(configService: ConfigService) {
    this.allowedOrigins = configService
      .get<string>('CORS_ORIGINS', 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim().toLowerCase());
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();

    // Safe idempotent methods do not need CSRF validation
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Requests carrying an explicit Bearer token in the Authorization header are immune to browser CSRF
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return true;
    }

    // For cookie-authenticated mutating requests, enforce double-submit cookie or origin check
    const cookies = req.cookies as Record<string, string> | undefined;
    const xsrfCookie = cookies?.['XSRF-TOKEN'];
    const xsrfHeader = (req.headers['x-csrf-token'] || req.headers['x-xsrf-token']) as string;

    if (xsrfCookie && xsrfHeader && xsrfCookie === xsrfHeader) {
      return true;
    }

    // Origin/Referer header verification fallback
    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      const parsedOrigin = new URL(origin).origin.toLowerCase();
      if (this.allowedOrigins.includes(parsedOrigin)) {
        return true;
      }
    }

    throw new ForbiddenException('Invalid or missing CSRF token');
  }
}
