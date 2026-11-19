-- Deploy delivery_app:seed_initial_data to pg
-- requires: create_core_tables

BEGIN;

-- Initial administrator (Password: Admin123!)
-- Dynamically hashes via PostgreSQL pgcrypto extension with Blowfish/bcrypt (bf)
INSERT INTO users (id, email, password_hash, full_name, role, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@deliverme.local',
    crypt('Admin123!', gen_salt('bf', 10)),
    'System Administrator',
    'ADMIN',
    TRUE
)
ON CONFLICT (email)
DO UPDATE SET password_hash = crypt('Admin123!', gen_salt('bf', 10));

-- Initial sample driver (Password: Driver123!)
INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_by)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'driver@deliverme.local',
    crypt('Driver123!', gen_salt('bf', 10)),
    'Dave Driver',
    'DRIVER',
    TRUE,
    'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (email)
DO UPDATE SET password_hash = crypt('Driver123!', gen_salt('bf', 10));

-- Sample delivery ready for driver QR scan
INSERT INTO deliveries (
    id,
    delivery_number,
    tracking_number,
    assigned_driver_id,
    status,
    recipient_name,
    delivery_address,
    created_by
)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'DEL-10001',
    'TRK-987654321',
    'd0000000-0000-0000-0000-000000000001',
    'ASSIGNED',
    'Alice Smith',
    '742 Evergreen Terrace, Springfield',
    'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (delivery_number) DO NOTHING;

COMMIT;
