import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { config } from '../config/index.js';
import { AuthenticatedRequest, AuthUserPayload } from '../types/index.js';
import { createAuditLog } from '../middleware/auditLogger.js';
import { getClientIp } from '../middleware/manualIpBlock.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function getUserAgent(req: AuthenticatedRequest): string {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua[0] || '' : ua || '';
}

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientIp = req.clientIp || getClientIp(req);
  const userAgent = getUserAgent(req);

  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { email, password } = parseResult.data;

  try {
    const userRes = await pool.query(
      'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (userRes.rowCount === 0) {
      await createAuditLog({
        userId: null,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: email,
        ipAddress: clientIp,
        userAgent,
        metadata: { reason: 'User not found', attemptedEmail: email },
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = userRes.rows[0];

    if (!user.is_active) {
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_BLOCKED',
        entityType: 'AUTH',
        entityId: user.id,
        ipAddress: clientIp,
        userAgent,
        metadata: { reason: 'Account deactivated' },
      });
      res.status(403).json({ error: 'Account is deactivated. Contact an administrator.' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: user.id,
        ipAddress: clientIp,
        userAgent,
        metadata: { reason: 'Incorrect password', attemptedEmail: email },
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const payload: AuthUserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });

    await createAuditLog({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'AUTH',
      entityId: user.id,
      ipAddress: clientIp,
      userAgent,
      metadata: { role: user.role },
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientIp = req.clientIp || getClientIp(req);
  if (req.user) {
    await createAuditLog({
      userId: req.user.id,
      action: 'USER_LOGOUT',
      entityType: 'AUTH',
      entityId: req.user.id,
      ipAddress: clientIp,
      userAgent: getUserAgent(req),
    });
  }
  res.json({ message: 'Logged out successfully' });
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const userRes = await pool.query(
      'SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRes.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: userRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
}
