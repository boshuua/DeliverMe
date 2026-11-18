import { Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';

// In-memory cache of manually blocked IP addresses
let blockedIpSet = new Set<string>();
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute fallback refresh

/**
 * Normalizes an IP string (handles IPv6 mapped IPv4 like ::ffff:192.168.1.1)
 */
export function normalizeIp(rawIp?: string): string {
  if (!rawIp) return '';
  let ip = rawIp.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  return ip;
}

/**
 * Extracts client IP from headers (behind proxy/load-balancer) or socket
 */
export function getClientIp(req: AuthenticatedRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return normalizeIp(firstIp);
  } else if (Array.isArray(forwarded) && forwarded[0]) {
    return normalizeIp(forwarded[0].split(',')[0].trim());
  }

  const socketIp = req.socket?.remoteAddress;
  return normalizeIp(socketIp || req.ip || '');
}

/**
 * Manually refresh the blocked IP cache from PostgreSQL
 */
export async function refreshBlockedIpCache(): Promise<void> {
  try {
    const result = await pool.query<{ ip_address: string }>(
      'SELECT ip_address::text FROM blocked_ips WHERE is_active = TRUE'
    );
    const newSet = new Set<string>();
    for (const row of result.rows) {
      newSet.add(normalizeIp(row.ip_address));
    }
    blockedIpSet = newSet;
    lastCacheRefresh = Date.now();
    console.log(`[Security] Manually blocked IP cache refreshed: ${blockedIpSet.size} active rule(s)`);
  } catch (err) {
    console.error('[Security] Failed to refresh blocked IP cache:', err);
  }
}

/**
 * Express middleware to enforce manual IP blocklist.
 * STRICT RULE: Only manually blocked IPs in blocked_ips are rejected.
 * No automatic banning logic is implemented here.
 */
export function manualIpBlockMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const clientIp = getClientIp(req);
  req.clientIp = clientIp;

  // Refresh cache if stale
  if (Date.now() - lastCacheRefresh > CACHE_TTL_MS) {
    refreshBlockedIpCache().catch(() => {});
  }

  if (clientIp && blockedIpSet.has(clientIp)) {
    console.warn(`[Security] Blocked request from manually blacklisted IP: ${clientIp} on ${req.method} ${req.originalUrl}`);
    res.status(403).json({
      error: 'Forbidden',
      message: 'Access from your IP address has been administratively blocked.',
    });
    return;
  }

  next();
}
