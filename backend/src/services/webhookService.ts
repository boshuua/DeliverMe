import crypto from 'crypto';
import { pool } from '../config/database.js';

export async function dispatchWebhook(event: string, payload: any): Promise<void> {
  try {
    const result = await pool.query<{ id: string; target_url: string; secret_key: string; events: string[] }>(
      'SELECT id, target_url, secret_key, events FROM webhooks WHERE is_active = TRUE'
    );

    const matchingWebhooks = result.rows.filter(
      (hook) => hook.events.includes('*') || hook.events.includes(event)
    );

    if (matchingWebhooks.length === 0) return;

    const bodyString = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    for (const hook of matchingWebhooks) {
      const signature = crypto
        .createHmac('sha256', hook.secret_key)
        .update(bodyString)
        .digest('hex');

      fetch(hook.target_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DeliverMe-Signature': signature,
          'X-DeliverMe-Event': event,
        },
        body: bodyString,
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        console.warn(`[Webhook] Failed to dispatch to ${hook.target_url}:`, err.message);
      });
    }
  } catch (err) {
    console.error('[Webhook] Failed to process webhook dispatches:', err);
  }
}
