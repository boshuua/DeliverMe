-- Revert delivery_app:create_core_tables from pg

BEGIN;

DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS blocked_ips;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS proof_of_delivery;
DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS delivery_status;
DROP TYPE IF EXISTS user_role;

COMMIT;
