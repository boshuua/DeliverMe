import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { pool } from '../config/database.js';
import { config } from '../config/index.js';
import { AuthenticatedRequest } from '../types/index.js';
import { createAuditLog } from '../middleware/auditLogger.js';
import { getClientIp } from '../middleware/manualIpBlock.js';
import { notifyDeliveryCompleted } from '../sockets/index.js';
import { dispatchWebhook } from '../services/webhookService.js';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

function getUserAgent(req: AuthenticatedRequest): string {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua[0] || '' : ua || '';
}

export async function scanDelivery(req: AuthenticatedRequest, res: Response): Promise<void> {
  const code = getParam(req.params.code);

  if (!code || code.trim().length === 0) {
    res.status(400).json({ error: 'Delivery or tracking code is required' });
    return;
  }

  const cleanCode = code.trim();

  try {
    const result = await pool.query(
      `SELECT d.id, d.delivery_number, d.tracking_number, d.status,
              d.recipient_name, d.delivery_address, d.assigned_driver_id,
              d.created_at, u.full_name AS assigned_driver_name
         FROM deliveries d
    LEFT JOIN users u ON d.assigned_driver_id = u.id
        WHERE (LOWER(d.delivery_number) = LOWER($1) OR LOWER(d.tracking_number) = LOWER($1))`,
      [cleanCode]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'No delivery found matching the scanned code' });
      return;
    }

    const delivery = result.rows[0];

    // If already delivered, inform the driver
    if (delivery.status === 'DELIVERED') {
      res.status(400).json({
        error: 'Delivery has already been completed',
        delivery,
      });
      return;
    }

    if (delivery.status === 'CANCELLED') {
      res.status(400).json({
        error: 'This delivery has been cancelled',
        delivery,
      });
      return;
    }

    res.json({ delivery });
  } catch (err) {
    console.error('[Driver] Error scanning delivery:', err);
    res.status(500).json({ error: 'Failed to look up delivery' });
  }
}

export async function completeDelivery(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = getParam(req.params.id);
  const clientIp = req.clientIp || getClientIp(req);
  const driverId = req.user!.id;

  try {
    // 1. Verify delivery exists and is eligible for completion
    const deliveryRes = await pool.query(
      'SELECT id, delivery_number, tracking_number, status FROM deliveries WHERE id = $1',
      [id]
    );

    if (deliveryRes.rowCount === 0) {
      res.status(404).json({ error: 'Delivery not found' });
      return;
    }

    const delivery = deliveryRes.rows[0];
    if (delivery.status === 'DELIVERED') {
      res.status(400).json({ error: 'Delivery is already completed' });
      return;
    }

    // 2. Extract Photo
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const photoFile = files?.['photo']?.[0] || (req.file?.fieldname === 'photo' ? req.file : undefined);

    if (!photoFile) {
      res.status(400).json({ error: 'Proof of Delivery photo is required' });
      return;
    }

    const photoUrl = path.join('pod', photoFile.filename);

    // 3. Extract Signature (either file upload or base64 string from canvas)
    let signatureUrl = '';
    const sigFile = files?.['signature']?.[0];

    if (sigFile) {
      signatureUrl = path.join('pod', sigFile.filename);
    } else if (req.body.signature && typeof req.body.signature === 'string') {
      const base64Data = req.body.signature.replace(/^data:image\/\w+;base64,/, '');
      const sigFilename = `${Date.now()}-${randomUUID()}.png`;
      const sigDiskPath = path.join(config.storageDir, 'pod', sigFilename);
      fs.writeFileSync(sigDiskPath, Buffer.from(base64Data, 'base64'));
      signatureUrl = path.join('pod', sigFilename);
    } else {
      res.status(400).json({ error: 'Customer signature is required' });
      return;
    }

    // 4. Coordinates validation
    const latitude = parseFloat(req.body.latitude);
    const longitude = parseFloat(req.body.longitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      res.status(400).json({ error: 'Valid GPS latitude and longitude coordinates are required' });
      return;
    }

    // 5. Database transaction to update delivery and insert PoD
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const completedAt = new Date();

      await client.query(
        `UPDATE deliveries
            SET status = 'DELIVERED',
                assigned_driver_id = COALESCE(assigned_driver_id, $1),
                completed_at = $2,
                updated_at = $2
          WHERE id = $3`,
        [driverId, completedAt, id]
      );

      const podInsertRes = await client.query(
        `INSERT INTO proof_of_delivery (
           delivery_id, driver_id, photo_url, signature_url, latitude, longitude, captured_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, delivery_id, photo_url, signature_url, latitude, longitude, captured_at`,
        [id, driverId, photoUrl, signatureUrl, latitude, longitude, completedAt]
      );

      await client.query('COMMIT');

      const podRecord = podInsertRes.rows[0];

      // Audit Log
      await createAuditLog({
        userId: driverId,
        action: 'DELIVERY_COMPLETED',
        entityType: 'DELIVERY',
        entityId: id,
        ipAddress: clientIp,
        userAgent: getUserAgent(req),
        metadata: {
          deliveryNumber: delivery.delivery_number,
          trackingNumber: delivery.tracking_number,
          coordinates: { latitude, longitude },
        },
      });

      // WebSocket alert to Admin Portal
      notifyDeliveryCompleted({
        deliveryId: id,
        trackingNumber: delivery.tracking_number,
        driverId,
        completedAt: completedAt.toISOString(),
        location: { latitude, longitude },
      });

      // Webhook dispatch
      dispatchWebhook('delivery:completed', {
        deliveryId: id,
        trackingNumber: delivery.tracking_number,
        driverId,
        completedAt: completedAt.toISOString(),
        location: { latitude, longitude },
      });

      res.json({
        message: 'Delivery completed successfully',
        deliveryId: id,
        proofOfDelivery: podRecord,
      });
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Driver] Error completing delivery:', err);
    res.status(500).json({ error: 'Failed to complete delivery submission' });
  }
}
