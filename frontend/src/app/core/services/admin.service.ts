import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, Delivery, AuditLog, BlockedIp } from '../models/index.js';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private apiUrl = '/api/v1/admin';

  constructor(private http: HttpClient) {}

  // ================= User Provisioning =================
  getUsers(): Observable<{ users: User[] }> {
    return this.http.get<{ users: User[] }>(`${this.apiUrl}/users`);
  }

  createUser(payload: {
    email: string;
    password: string;
    full_name: string;
    role: 'ADMIN' | 'DRIVER';
    is_active?: boolean;
  }): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(`${this.apiUrl}/users`, payload);
  }

  updateUser(
    id: string,
    payload: {
      email?: string;
      full_name?: string;
      role?: 'ADMIN' | 'DRIVER';
      is_active?: boolean;
      password?: string;
    }
  ): Observable<{ user: User }> {
    return this.http.patch<{ user: User }>(`${this.apiUrl}/users/${id}`, payload);
  }

  getDrivers(): Observable<{ drivers: { id: string; full_name: string; email: string }[] }> {
    return this.http.get<{ drivers: { id: string; full_name: string; email: string }[] }>(
      `${this.apiUrl}/drivers`
    );
  }

  // ================= Delivery Management =================
  getDeliveries(params?: { type?: 'active' | 'past'; status?: string }): Observable<{ deliveries: Delivery[] }> {
    let httpParams = new HttpParams();
    if (params?.type) httpParams = httpParams.set('type', params.type);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    return this.http.get<{ deliveries: Delivery[] }>(`${this.apiUrl}/deliveries`, { params: httpParams });
  }

  getDeliveryById(id: string): Observable<{ delivery: Delivery }> {
    return this.http.get<{ delivery: Delivery }>(`${this.apiUrl}/deliveries/${id}`);
  }

  createDelivery(payload: {
    delivery_number: string;
    tracking_number: string;
    assigned_driver_id?: string | null;
    recipient_name: string;
    delivery_address: string;
  }): Observable<{ delivery: Delivery }> {
    return this.http.post<{ delivery: Delivery }>(`${this.apiUrl}/deliveries`, payload);
  }

  getPhotoBlob(deliveryId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/deliveries/${deliveryId}/photo`, { responseType: 'blob' });
  }

  getSignatureBlob(deliveryId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/deliveries/${deliveryId}/signature`, { responseType: 'blob' });
  }

  // ================= Audit & Security =================
  getAuditLogs(params?: {
    limit?: number;
    offset?: number;
    action?: string;
    ip?: string;
  }): Observable<{ logs: AuditLog[]; total: number; limit: number; offset: number }> {
    let httpParams = new HttpParams();
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params?.offset) httpParams = httpParams.set('offset', params.offset.toString());
    if (params?.action) httpParams = httpParams.set('action', params.action);
    if (params?.ip) httpParams = httpParams.set('ip', params.ip);
    return this.http.get<{ logs: AuditLog[]; total: number; limit: number; offset: number }>(
      `${this.apiUrl}/audit-logs`,
      { params: httpParams }
    );
  }

  getBlockedIps(): Observable<{ blockedIps: BlockedIp[] }> {
    return this.http.get<{ blockedIps: BlockedIp[] }>(`${this.apiUrl}/blocked-ips`);
  }

  blockIp(ip_address: string, reason: string): Observable<{ blockedIp: BlockedIp }> {
    return this.http.post<{ blockedIp: BlockedIp }>(`${this.apiUrl}/blocked-ips`, {
      ip_address,
      reason,
    });
  }

  unblockIp(id: string): Observable<{ message: string; id: string }> {
    return this.http.delete<{ message: string; id: string }>(`${this.apiUrl}/blocked-ips/${id}`);
  }
}
