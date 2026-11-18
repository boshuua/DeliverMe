import { Component, OnInit, OnDestroy, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service.js';
import { WebSocketService } from '../../core/services/websocket.service.js';

declare var $: any;

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
})
export class AdminLayoutComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private wsService = inject(WebSocketService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  isConnected = false;
  latestAlert: { title: string; message: string; type: 'info' | 'success' | 'warning' | 'error'; time: string } | null = null;

  private subscriptions = new Subscription();

  constructor() {}

  ngOnInit(): void {
    this.wsService.connect();

    this.subscriptions.add(
      this.wsService.isConnected$.subscribe((connected) => {
        this.isConnected = connected;
      })
    );

    this.subscriptions.add(
      this.wsService.deliveryCreated$.subscribe((event) => {
        this.showAlert(
          'New Delivery Created',
          `Delivery #${event.trackingNumber} dispatched by ${event.createdBy || 'Admin'}`,
          'info'
        );
      })
    );

    this.subscriptions.add(
      this.wsService.deliveryCompleted$.subscribe((event) => {
        this.showAlert(
          'Delivery Completed!',
          `Package #${event.trackingNumber} delivered at ${new Date(event.completedAt || Date.now()).toLocaleTimeString()}`,
          'success'
        );
      })
    );

    this.subscriptions.add(
      this.wsService.securityAttempt$.subscribe((event) => {
        this.showAlert(
          'Security Alert',
          `Unauthenticated request from IP: ${event.ipAddress} on ${event.endpoint}`,
          'warning'
        );
      })
    );

    this.subscriptions.add(
      this.wsService.ipBlocked$.subscribe((event) => {
        this.showAlert(
          'IP Blocklist Updated',
          `IP ${event.ipAddress} manually blocked by ${event.blockedBy}`,
          'error'
        );
      })
    );
  }

  ngAfterViewInit(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxNotification) {
      $('#adminNotification').jqxNotification({
        width: 350,
        position: 'top-right',
        opacity: 0.95,
        autoOpen: false,
        autoClose: true,
        autoCloseDelay: 6000,
        template: 'info',
      });
    }
  }

  showAlert(title: string, message: string, type: 'info' | 'success' | 'warning' | 'error'): void {
    this.latestAlert = {
      title,
      message,
      type,
      time: new Date().toLocaleTimeString(),
    };

    if (typeof $ !== 'undefined' && $.fn.jqxNotification) {
      const templateMap: Record<string, string> = {
        info: 'info',
        success: 'success',
        warning: 'warning',
        error: 'error',
      };
      try {
        $('#adminNotification').jqxNotification({ template: templateMap[type] || 'info' });
        $('#adminNotification').jqxNotification('open');
      } catch (e) {
        console.warn('jQWidgets notification error:', e);
      }
    }
  }

  logout(): void {
    this.wsService.disconnect();
    this.authService.logout();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.wsService.disconnect();
  }
}
