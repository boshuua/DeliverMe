import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../core/services/admin.service.js';
import { IconService } from '../../core/services/icon.service.js';

declare var $: any;

@Component({
  selector: 'app-delivery-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './delivery-create.component.html',
  styleUrls: ['./delivery-create.component.css'],
})
export class DeliveryCreateComponent implements OnInit, AfterViewInit {
  private adminService = inject(AdminService);
  private router = inject(Router);
  readonly iconService = inject(IconService);
  readonly icons = this.iconService.icons;

  deliveryNumber = '';
  trackingNumber = '';
  recipientName = '';
  deliveryAddress = '';
  assignedDriverId: string | null = null;

  drivers: { id: string; full_name: string; email: string }[] = [];
  isLoading = false;
  errorMessage = '';
  successDelivery: any = null;

  ngOnInit(): void {
    this.generateNumbers();
    this.loadDrivers();
  }

  ngAfterViewInit(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxButton) {
      $('#submitBtn').jqxButton({ theme: 'material' });
      $('#genBtn').jqxButton({ theme: 'material' });
    }
  }

  loadDrivers(): void {
    this.adminService.getDrivers().subscribe({
      next: (res) => (this.drivers = res.drivers),
      error: (err) => console.error('Error fetching drivers:', err),
    });
  }

  generateNumbers(): void {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const trackingSuffix = Math.floor(100000000 + Math.random() * 900000000);
    this.deliveryNumber = `DEL-${randomSuffix}`;
    this.trackingNumber = `TRK-${trackingSuffix}`;
  }

  onSubmit(): void {
    if (!this.deliveryNumber || !this.trackingNumber || !this.recipientName || !this.deliveryAddress) {
      this.errorMessage = 'Please complete all required delivery fields.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.adminService
      .createDelivery({
        delivery_number: this.deliveryNumber,
        tracking_number: this.trackingNumber,
        assigned_driver_id: this.assignedDriverId || null,
        recipient_name: this.recipientName,
        delivery_address: this.deliveryAddress,
      })
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          this.successDelivery = res.delivery;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.error || 'Failed to create delivery.';
        },
      });
  }

  createAnother(): void {
    this.successDelivery = null;
    this.recipientName = '';
    this.deliveryAddress = '';
    this.assignedDriverId = null;
    this.generateNumbers();
  }
}
