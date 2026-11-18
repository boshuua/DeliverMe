-- Verify delivery_app:create_core_tables on pg

BEGIN;

SELECT id, email, password_hash, full_name, role, is_active, created_by, created_at, updated_at
  FROM users
 WHERE FALSE;

SELECT id, delivery_number, tracking_number, assigned_driver_id, status, recipient_name, delivery_address, created_by, created_at, updated_at, completed_at
  FROM deliveries
 WHERE FALSE;

SELECT id, delivery_id, driver_id, photo_url, signature_url, latitude, longitude, captured_at
  FROM proof_of_delivery
 WHERE FALSE;

SELECT id, user_id, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at
  FROM audit_logs
 WHERE FALSE;

SELECT id, ip_address, reason, blocked_by, is_active, created_at
  FROM blocked_ips
 WHERE FALSE;

SELECT id, target_url, secret_key, events, is_active, created_at
  FROM webhooks
 WHERE FALSE;

ROLLBACK;
