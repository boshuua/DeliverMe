-- Deploy delivery_app:seed_initial_data to pg
-- requires: create_core_tables

BEGIN;

-- Initial administrator (Password: Admin123!)
-- Bcrypt hash generated for salt rounds 10
INSERT INTO users (id, email, password_hash, full_name, role, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@deliverme.local',
    '$2a$10$K9Y2O0n7j6N8fU7B9O4Nqe.sQ7L0v9j0o6a1e3u5p4t2y8w0q1r3m',
    'System Administrator',
    'ADMIN',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Initial sample driver (Password: Driver123!)
INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_by)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'driver@deliverme.local',
    '$2a$10$K9Y2O0n7j6N8fU7B9O4Nqe.sQ7L0v9j0o6a1e3u5p4t2y8w0q1r3m',
    'Dave Driver',
    'DRIVER',
    TRUE,
    'a0000000-0000-0000-0000-000000000001'
) ON CONFLICT (email) DO NOTHING;

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
) ON CONFLICT (delivery_number) DO NOTHING;

COMMIT;
