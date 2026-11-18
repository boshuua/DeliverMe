export type UserRole = 'ADMIN' | 'DRIVER';
export type DeliveryStatus = 'PENDING' | 'ASSIGNED' | 'DELIVERED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by_name?: string;
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
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
  pod_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  captured_at?: string | null;
  has_photo?: boolean;
  has_signature?: boolean;
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
  captured_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address: string;
  user_agent?: string | null;
  metadata?: any;
  created_at: string;
}

export interface BlockedIp {
  id: string;
  ip_address: string;
  reason?: string | null;
  is_active: boolean;
  created_at: string;
  blocked_by_name?: string;
  blocked_by_email?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
  };
}

export interface DeliveryAlertEvent {
  deliveryId: string;
  trackingNumber: string;
  createdBy?: string;
  driverId?: string;
  completedAt?: string;
  location?: { latitude: number; longitude: number };
}

export interface SecurityAlertEvent {
  ipAddress: string;
  endpoint?: string;
  blockedBy?: string;
  reason?: string;
  timestamp?: string;
}
