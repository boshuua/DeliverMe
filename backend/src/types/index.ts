import { Request } from 'express';

export type UserRole = 'ADMIN' | 'DRIVER';

export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'DELIVERED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Delivery {
  id: string;
  delivery_number: string;
  tracking_number: string;
  assigned_driver_id?: string | null;
  assigned_driver_name?: string | null;
  status: DeliveryStatus;
  recipient_name: string;
  delivery_address: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date | null;
}

export interface ProofOfDelivery {
  id: string;
  delivery_id: string;
  driver_id: string;
  driver_name?: string;
  photo_url: string;
  signature_url: string;
  latitude: number;
  longitude: number;
  captured_at: Date;
}

export interface AuditLog {
  id: number;
  user_id?: string | null;
  user_email?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address: string;
  user_agent?: string | null;
  metadata?: Record<string, any> | null;
  created_at: Date;
}

export interface BlockedIp {
  id: string;
  ip_address: string;
  reason?: string | null;
  blocked_by: string;
  blocked_by_name?: string;
  is_active: boolean;
  created_at: Date;
}

export interface Webhook {
  id: string;
  target_url: string;
  secret_key: string;
  events: string[];
  is_active: boolean;
  created_at: Date;
}

export interface AuthUserPayload {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
  clientIp?: string;
}
