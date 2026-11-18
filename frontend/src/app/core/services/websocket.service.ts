import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service.js';
import { DeliveryAlertEvent, SecurityAlertEvent } from '../models/index.js';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private socket: Socket | null = null;

  private deliveryCreatedSubject = new Subject<DeliveryAlertEvent>();
  private deliveryCompletedSubject = new Subject<DeliveryAlertEvent>();
  private securityAttemptSubject = new Subject<SecurityAlertEvent>();
  private ipBlockedSubject = new Subject<SecurityAlertEvent>();
  private connectionStatusSubject = new Subject<boolean>();

  deliveryCreated$ = this.deliveryCreatedSubject.asObservable();
  deliveryCompleted$ = this.deliveryCompletedSubject.asObservable();
  securityAttempt$ = this.securityAttemptSubject.asObservable();
  ipBlocked$ = this.ipBlockedSubject.asObservable();
  isConnected$ = this.connectionStatusSubject.asObservable();

  constructor(private authService: AuthService) {}

  connect(): void {
    if (this.socket && this.socket.connected) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) return;

    this.socket = io('/admin-alerts', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected to /admin-alerts');
      this.connectionStatusSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected from /admin-alerts');
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[WebSocket] Connection error:', err.message);
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('delivery:created', (payload: DeliveryAlertEvent) => {
      this.deliveryCreatedSubject.next(payload);
    });

    this.socket.on('delivery:completed', (payload: DeliveryAlertEvent) => {
      this.deliveryCompletedSubject.next(payload);
    });

    this.socket.on('security:unauthenticated_attempt', (payload: SecurityAlertEvent) => {
      this.securityAttemptSubject.next(payload);
    });

    this.socket.on('security:ip_blocked', (payload: SecurityAlertEvent) => {
      this.ipBlockedSubject.next(payload);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionStatusSubject.next(false);
    }
  }
}
