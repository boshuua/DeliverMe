import { Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getClientIp } from './manualIpBlock.js';
import { notifySecurityUnauthenticatedAttempt } from '../sockets/index.js';

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  ipAddress: string;
  userAgent?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Persists an immutable record to the audit_logs table
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const text = `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
      VALUES ($1, $2, $3, $4, $5::inet, $6, $7)
    `;
    const values = [
      params.userId || null,
      params.action,
      params.entityType || null,
      params.entityId || null,
      params.ipAddress || '127.0.0.1',
      params.userAgent || null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ];
    await pool.query(text, values);
  } catch (err) {
    console.error('[AuditLog] Failed to record audit log:', err);
  }
}

/**
 * Middleware that intercepts response status codes to log unauthenticated (401)
 * or forbidden (403) attempts with requester's IP address and notify Admins in real-time.
 */
export function auditMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const originalEnd = res.end;
  const clientIp = req.clientIp || getClientIp(req);
  const rawUa = req.headers['user-agent'];
  const userAgent = Array.isArray(rawUa) ? rawUa[0] || '' : rawUa || '';

  // Intercept completion
  res.end = function (...args: any[]): any {
    const statusCode = res.statusCode;

    // Log 401 Unauthorized or 403 Forbidden unauthenticated access attempts
    if (statusCode === 401 || statusCode === 403) {
      const endpoint = `${req.method} ${req.originalUrl}`;
      const action = statusCode === 401 ? 'UNAUTHORIZED_ACCESS_ATTEMPT' : 'FORBIDDEN_ACCESS_ATTEMPT';

      createAuditLog({
        userId: req.user?.id || null,
        action,
        entityType: 'ENDPOINT',
        entityId: endpoint,
        ipAddress: clientIp,
        userAgent,
        metadata: {
          statusCode,
          method: req.method,
          url: req.originalUrl,
          headers: {
            host: req.headers.host,
            origin: req.headers.origin,
          },
        },
      });

      // Dispatch real-time WebSocket alert to Admin clients
      notifySecurityUnauthenticatedAttempt({
        ipAddress: clientIp,
        endpoint,
        timestamp: new Date().toISOString(),
      });
    }

    return (originalEnd as any).apply(res, args);
  };

  next();
}
