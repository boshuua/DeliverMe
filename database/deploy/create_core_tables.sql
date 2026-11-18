-- Deploy delivery_app:create_core_tables to pg

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'DRIVER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_status AS ENUM ('PENDING', 'ASSIGNED', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. deliveries
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_number VARCHAR(100) UNIQUE NOT NULL,
    tracking_number VARCHAR(100) UNIQUE NOT NULL,
    assigned_driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status delivery_status NOT NULL DEFAULT 'PENDING',
    recipient_name VARCHAR(255) NOT NULL,
    delivery_address TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 3. proof_of_delivery
CREATE TABLE IF NOT EXISTS proof_of_delivery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    photo_url TEXT NOT NULL,
    signature_url TEXT NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    ip_address INET NOT NULL,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. blocked_ips
CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET UNIQUE NOT NULL,
    reason TEXT,
    blocked_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_url TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_assigned_driver ON deliveries(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking_number ON deliveries(tracking_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON blocked_ips(ip_address) WHERE is_active = TRUE;

COMMIT;
