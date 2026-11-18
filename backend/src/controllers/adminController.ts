import { Response } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { pool } from '../config/database.js';
import { config } from '../config/index.js';
import { AuthenticatedRequest } from '../types/index.js';
import { createAuditLog } from '../middleware/auditLogger.js';
import { getClientIp, refreshBlockedIpCache } from '../middleware/manualIpBlock.js';
import { notifyDeliveryCreated, notifySecurityIpBlocked } from '../sockets/index.js';
import { dispatchWebhook } from '../services/webhookService.js';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

function getUserAgent(req: AuthenticatedRequest): string {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua[0] || '' : ua || '';
}

// Schemas
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  full_name: z.string().min(2),
  role: z.enum(['ADMIN', 'DRIVER']),
  is_active: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  full_name: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'DRIVER']).optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

const createDeliverySchema = z.object({
  delivery_number: z.string().min(3),
  tracking_number: z.string().min(3),
  assigned_driver_id: z.string().uuid().nullable().optional(),
  recipient_name: z.string().min(1),
  delivery_address: z.string().min(5),
});

const blockIpSchema = z.object({
  ip_address: z.string().min(1),
  reason: z.string().optional(),
});

// ==================== USER MANAGEMENT ====================

export async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.updated_at,
             c.full_name AS created_by_name
        FROM users u
   LEFT JOIN users c ON u.created_by = c.id
    ORDER BY u.created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (err) {
    console.error('[Admin] Error listing users:', err);
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
}

export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientIp = req.clientIp || getClientIp(req);
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { email, password, full_name, role, is_active } = parseResult.data;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertResult = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [email.toLowerCase(), passwordHash, full_name, role, is_active, req.user!.id]
    );

    const newUser = insertResult.rows[0];

    await createAuditLog({
      userId: req.user!.id,
      action: 'USER_PROVISIONED',
      entityType: 'USER',
      entityId: newUser.id,
      ipAddress: clientIp,
      userAgent: getUserAgent(req),
      metadata: { email: newUser.email, role: newUser.role },
    });

    res.status(201).json({ user: newUser });
  } catch (err) {
    console.error('[Admin] Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);
  const clientIp = req.clientIp || getClientIp(req);

  const parseResult = updateUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updates = parseResult.data;
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [id];
    let idx = 2;

    if (updates.email !== undefined) {
      setClauses.push(`email = $${idx++}`);
      values.push(updates.email.toLowerCase());
    }
    if (updates.full_name !== undefined) {
      setClauses.push(`full_name = $${idx++}`);
      values.push(updates.full_name);
    }
    if (updates.role !== undefined) {
      setClauses.push(`role = $${idx++}`);
      values.push(updates.role);
    }
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${idx++}`);
      values.push(updates.is_active);
    }
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(updates.password, salt);
      setClauses.push(`password_hash = $${idx++}`);
      values.push(hash);
    }

    const queryText = `
      UPDATE users
         SET ${setClauses.join(', ')}
       WHERE id = $1
   RETURNING id, email, full_name, role, is_active, updated_at
    `;

    const updateRes = await pool.query(queryText, values);
    const updatedUser = updateRes.rows[0];

    await createAuditLog({
      userId: req.user!.id,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      ipAddress: clientIp,
      userAgent: getUserAgent(req),
      metadata: updates,
    });

    res.json({ user: updatedUser });
  } catch (err) {
    console.error('[Admin] Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function listDrivers(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, is_active
         FROM users
        WHERE role = 'DRIVER' AND is_active = TRUE
     ORDER BY full_name ASC`
    );
    res.json({ drivers: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve drivers' });
  }
}

// ==================== DELIVERY MANAGEMENT ====================

export async function listDeliveries(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { status, type } = req.query;

  try {
    let queryText = `
      SELECT d.id, d.delivery_number, d.tracking_number, d.assigned_driver_id, d.status,
             d.recipient_name, d.delivery_address, d.created_at, d.updated_at, d.completed_at,
             u.full_name AS assigned_driver_name,
             p.id AS pod_id, p.latitude, p.longitude, p.captured_at
        FROM deliveries d
   LEFT JOIN users u ON d.assigned_driver_id = u.id
   LEFT JOIN proof_of_delivery p ON d.id = p.delivery_id
    `;
    const values: any[] = [];

    if (type === 'active') {
      queryText += ` WHERE d.status IN ('PENDING', 'ASSIGNED')`;
    } else if (type === 'past') {
      queryText += ` WHERE d.status IN ('DELIVERED', 'CANCELLED')`;
    } else if (status && typeof status === 'string') {
      queryText += ` WHERE d.status = $1`;
      values.push(status.toUpperCase());
    }

    queryText += ` ORDER BY d.created_at DESC`;

    const result = await pool.query(queryText, values);
    res.json({ deliveries: result.rows });
  } catch (err) {
    console.error('[Admin] Error listing deliveries:', err);
    res.status(500).json({ error: 'Failed to retrieve deliveries' });
  }
}

export async function getDeliveryById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);

  try {
    const queryText = `
      SELECT d.id, d.delivery_number, d.tracking_number, d.assigned_driver_id, d.status,
             d.recipient_name, d.delivery_address, d.created_at, d.updated_at, d.completed_at,
             u.full_name AS assigned_driver_name,
             u.email AS assigned_driver_email,
             p.id AS pod_id, p.latitude, p.longitude, p.captured_at,
             CASE WHEN p.photo_url IS NOT NULL THEN true ELSE false END AS has_photo,
             CASE WHEN p.signature_url IS NOT NULL THEN true ELSE false END AS has_signature
        FROM deliveries d
   LEFT JOIN users u ON d.assigned_driver_id = u.id
   LEFT JOIN proof_of_delivery p ON d.id = p.delivery_id
       WHERE d.id = $1
    `;

    const result = await pool.query(queryText, [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Delivery not found' });
      return;
    }

    res.json({ delivery: result.rows[0] });
  } catch (err) {
    console.error('[Admin] Error fetching delivery details:', err);
    res.status(500).json({ error: 'Failed to retrieve delivery' });
  }
}

export async function createDelivery(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientIp = req.clientIp || getClientIp(req);
  const parseResult = createDeliverySchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { delivery_number, tracking_number, assigned_driver_id, recipient_name, delivery_address } =
    parseResult.data;

  try {
    const initialStatus = assigned_driver_id ? 'ASSIGNED' : 'PENDING';

    const insertRes = await pool.query(
      `INSERT INTO deliveries (
         delivery_number, tracking_number, assigned_driver_id, status, recipient_name, delivery_address, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        delivery_number.trim(),
        tracking_number.trim(),
        assigned_driver_id || null,
        initialStatus,
        recipient_name.trim(),
        delivery_address.trim(),
        req.user!.id,
      ]
    );

    const delivery = insertRes.rows[0];

    // Audit log
    await createAuditLog({
      userId: req.user!.id,
      action: 'DELIVERY_CREATED',
      entityType: 'DELIVERY',
      entityId: delivery.id,
      ipAddress: clientIp,
      userAgent: getUserAgent(req),
      metadata: { delivery_number, tracking_number, assigned_driver_id },
    });

    // Real-time WebSocket Alert to connected Admins
    notifyDeliveryCreated({
      deliveryId: delivery.id,
      trackingNumber: delivery.tracking_number,
      createdBy: req.user!.email,
    });

    // Webhook dispatch
    dispatchWebhook('delivery:created', delivery);

    res.status(201).json({ delivery });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Delivery number or tracking number already exists' });
      return;
    }
    console.error('[Admin] Error creating delivery:', err);
    res.status(500).json({ error: 'Failed to create delivery' });
  }
}

// Secure file streaming for PoD Photo (Protected behind ADMIN authentication)
export async function getPoDPhoto(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);

  try {
    const podRes = await pool.query(
      `SELECT photo_url FROM proof_of_delivery WHERE delivery_id = $1`,
      [id]
    );

    if (podRes.rowCount === 0 || !podRes.rows[0].photo_url) {
      res.status(404).json({ error: 'Proof of Delivery photo not found' });
      return;
    }

    const filePath = path.resolve(config.storageDir, podRes.rows[0].photo_url);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Photo file not found on disk' });
      return;
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve photo' });
  }
}

// Secure file streaming for PoD Signature (Protected behind ADMIN authentication)
export async function getPoDSignature(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);

  try {
    const podRes = await pool.query(
      `SELECT signature_url FROM proof_of_delivery WHERE delivery_id = $1`,
      [id]
    );

    if (podRes.rowCount === 0 || !podRes.rows[0].signature_url) {
      res.status(404).json({ error: 'Proof of Delivery signature not found' });
      return;
    }

    const filePath = path.resolve(config.storageDir, podRes.rows[0].signature_url);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Signature file not found on disk' });
      return;
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve signature' });
  }
}

// ==================== SECURITY & AUDIT ====================

export async function listAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;
  const action = req.query.action as string;
  const ip = req.query.ip as string;

  try {
    let whereClauses: string[] = [];
    let values: any[] = [];
    let idx = 1;

    if (action) {
      whereClauses.push(`a.action = $${idx++}`);
      values.push(action);
    }
    if (ip) {
      whereClauses.push(`a.ip_address::text LIKE $${idx++}`);
      values.push(`%${ip}%`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const queryText = `
      SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.ip_address::text,
             a.user_agent, a.metadata, a.created_at,
             u.email AS user_email, u.full_name AS user_name
        FROM audit_logs a
   LEFT JOIN users u ON a.user_id = u.id
      ${whereStr}
    ORDER BY a.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}
    `;

    values.push(limit, offset);

    const logsResult = await pool.query(queryText, values);
    const countResult = await pool.query(`SELECT COUNT(*) FROM audit_logs a ${whereStr}`, values.slice(0, values.length - 2));

    res.json({
      logs: logsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit,
      offset,
    });
  } catch (err) {
    console.error('[Admin] Error listing audit logs:', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
}

export async function listBlockedIps(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT b.id, b.ip_address::text, b.reason, b.is_active, b.created_at,
             u.full_name AS blocked_by_name, u.email AS blocked_by_email
        FROM blocked_ips b
   LEFT JOIN users u ON b.blocked_by = u.id
    ORDER BY b.created_at DESC
    `);
    res.json({ blockedIps: result.rows });
  } catch (err) {
    console.error('[Admin] Error listing blocked IPs:', err);
    res.status(500).json({ error: 'Failed to retrieve blocked IPs' });
  }
}

/**
 * STRICT CONSTRAINT: Manual IP blocking only.
 * Triggered explicitly by an Admin.
 */
export async function blockIp(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientIp = req.clientIp || getClientIp(req);
  const parseResult = blockIpSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
    return;
  }

  const { ip_address, reason } = parseResult.data;

  try {
    const insertRes = await pool.query(
      `INSERT INTO blocked_ips (ip_address, reason, blocked_by, is_active)
       VALUES ($1::inet, $2, $3, TRUE)
       ON CONFLICT (ip_address)
       DO UPDATE SET reason = EXCLUDED.reason, is_active = TRUE, blocked_by = EXCLUDED.blocked_by, created_at = NOW()
       RETURNING id, ip_address::text, reason, is_active, created_at`,
      [ip_address.trim(), reason || 'Manually blocked by Admin', req.user!.id]
    );

    const blockedEntry = insertRes.rows[0];

    // Refresh memory cache immediately
    await refreshBlockedIpCache();

    // Audit log
    await createAuditLog({
      userId: req.user!.id,
      action: 'IP_MANUALLY_BLOCKED',
      entityType: 'BLOCKED_IP',
      entityId: blockedEntry.id,
      ipAddress: clientIp,
      userAgent: getUserAgent(req),
      metadata: { blockedIp: ip_address, reason },
    });

    // Notify connected Admins via WebSocket
    notifySecurityIpBlocked({
      ipAddress: ip_address,
      blockedBy: req.user!.email,
      reason: reason || 'Manually blocked by Admin',
    });

    res.status(201).json({ blockedIp: blockedEntry });
  } catch (err: any) {
    console.error('[Admin] Error blocking IP:', err);
    res.status(500).json({ error: 'Failed to block IP address' });
  }
}

export async function unblockIp(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);
  const clientIp = req.clientIp || getClientIp(req);

  try {
    const updateRes = await pool.query(
      `UPDATE blocked_ips
          SET is_active = FALSE
        WHERE id = $1
    RETURNING id, ip_address::text`,
      [id]
    );

    if (updateRes.rowCount === 0) {
      res.status(404).json({ error: 'Blocked IP entry not found' });
      return;
    }

    const unblocked = updateRes.rows[0];

    // Refresh memory cache immediately
    await refreshBlockedIpCache();

    await createAuditLog({
      userId: req.user!.id,
      action: 'IP_UNBLOCKED',
      entityType: 'BLOCKED_IP',
      entityId: id,
      ipAddress: clientIp,
      userAgent: getUserAgent(req),
      metadata: { unblockedIp: unblocked.ip_address },
    });

    res.json({ message: 'IP address successfully unblocked', id });
  } catch (err) {
    console.error('[Admin] Error unblocking IP:', err);
    res.status(500).json({ error: 'Failed to unblock IP' });
  }
}
