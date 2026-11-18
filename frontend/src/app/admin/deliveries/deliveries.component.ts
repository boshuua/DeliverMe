import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminService } from '../../core/services/admin.service.js';
import { WebSocketService } from '../../core/services/websocket.service.js';
import { Delivery } from '../../core/models/index.js';

declare var $: any;

@Component({
  selector: 'app-deliveries',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './deliveries.component.html',
  styleUrls: ['./deliveries.component.css'],
})
export class DeliveriesComponent implements OnInit, AfterViewInit, OnDestroy {
  deliveries: Delivery[] = [];
  selectedDelivery: Delivery | null = null;
  photoUrl: string | null = null;
  signatureUrl: string | null = null;
  currentFilter: 'all' | 'active' | 'past' = 'all';
  isLoading = false;

  private subscriptions = new Subscription();

  constructor(
    private adminService: AdminService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    this.loadDeliveries();

    // Listen to real-time events to refresh list
    this.subscriptions.add(
      this.wsService.deliveryCreated$.subscribe(() => {
        this.loadDeliveries();
      })
    );

    this.subscriptions.add(
      this.wsService.deliveryCompleted$.subscribe(() => {
        this.loadDeliveries();
      })
    );
  }

  ngAfterViewInit(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#podWindow').jqxWindow({
        width: 650,
        height: 580,
        isModal: true,
        autoOpen: false,
        resizable: true,
        theme: 'material',
      });
    }
  }

  setFilter(filter: 'all' | 'active' | 'past'): void {
    this.currentFilter = filter;
    this.loadDeliveries();
  }

  loadDeliveries(): void {
    this.isLoading = true;
    const filterParam = this.currentFilter === 'all' ? undefined : this.currentFilter;
    this.adminService.getDeliveries({ type: filterParam }).subscribe({
      next: (res) => {
        this.deliveries = res.deliveries;
        this.isLoading = false;
        this.renderGrid();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading deliveries:', err);
      },
    });
  }

  renderGrid(): void {
    if (typeof $ === 'undefined' || !$.fn.jqxGrid) return;

    const source = {
      localdata: this.deliveries,
      datatype: 'array',
      datafields: [
        { name: 'id', type: 'string' },
        { name: 'delivery_number', type: 'string' },
        { name: 'tracking_number', type: 'string' },
        { name: 'recipient_name', type: 'string' },
        { name: 'delivery_address', type: 'string' },
        { name: 'assigned_driver_name', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'created_at', type: 'date' },
        { name: 'completed_at', type: 'date' },
        { name: 'pod_id', type: 'string' },
      ],
    };

    const dataAdapter = new $.jqx.dataAdapter(source);

    const statusCellsRenderer = (row: number, columnfield: string, value: string) => {
      const colors: Record<string, { bg: string; text: string }> = {
        PENDING: { bg: '#fef3c7', text: '#92400e' },
        ASSIGNED: { bg: '#dbeafe', text: '#1e40af' },
        DELIVERED: { bg: '#dcfce7', text: '#166534' },
        CANCELLED: { bg: '#fee2e2', text: '#991b1b' },
      };
      const c = colors[value] || { bg: '#f1f5f9', text: '#475569' };
      return `<div style="padding: 6px 10px;">
        <span style="background:${c.bg}; color:${c.text}; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">
          ${value}
        </span>
      </div>`;
    };

    const actionCellsRenderer = (row: number) => {
      return `<div style="padding: 4px 8px; text-align: center;">
        <button class="grid-action-btn" data-row="${row}" style="background:#2563eb; color:#fff; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:12px; font-weight:500;">
          View Details
        </button>
      </div>`;
    };

    $('#deliveriesGrid').jqxGrid({
      width: '100%',
      height: 480,
      source: dataAdapter,
      theme: 'material',
      pageable: true,
      pageSize: 10,
      pageSizeOptions: ['5', '10', '20', '50'],
      sortable: true,
      filterable: true,
      columnsresize: true,
      columns: [
        { text: 'Delivery #', datafield: 'delivery_number', width: '13%' },
        { text: 'Tracking #', datafield: 'tracking_number', width: '14%' },
        { text: 'Recipient', datafield: 'recipient_name', width: '15%' },
        { text: 'Address', datafield: 'delivery_address', width: '22%' },
        { text: 'Driver', datafield: 'assigned_driver_name', width: '13%' },
        { text: 'Status', datafield: 'status', width: '11%', cellsrenderer: statusCellsRenderer },
        { text: 'Action', width: '12%', cellsrenderer: actionCellsRenderer, sortable: false, filterable: false },
      ],
    });

    $('#deliveriesGrid').off('click', '.grid-action-btn').on('click', '.grid-action-btn', (e: any) => {
      const rowIndex = $(e.currentTarget).attr('data-row');
      const rowData = $('#deliveriesGrid').jqxGrid('getrowdata', rowIndex);
      if (rowData) {
        this.openPoDDetails(rowData.id);
      }
    });
  }

  openPoDDetails(deliveryId: string): void {
    this.adminService.getDeliveryById(deliveryId).subscribe({
      next: (res) => {
        this.selectedDelivery = res.delivery;
        this.loadMedia(deliveryId, !!res.delivery.has_photo, !!res.delivery.has_signature);

        if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
          $('#podWindow').jqxWindow('open');
        }
      },
      error: (err) => console.error('Error fetching delivery details:', err),
    });
  }

  loadMedia(deliveryId: string, hasPhoto: boolean, hasSignature: boolean): void {
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    if (this.signatureUrl) URL.revokeObjectURL(this.signatureUrl);
    this.photoUrl = null;
    this.signatureUrl = null;

    if (hasPhoto) {
      this.adminService.getPhotoBlob(deliveryId).subscribe({
        next: (blob) => (this.photoUrl = URL.createObjectURL(blob)),
        error: () => (this.photoUrl = null),
      });
    }

    if (hasSignature) {
      this.adminService.getSignatureBlob(deliveryId).subscribe({
        next: (blob) => (this.signatureUrl = URL.createObjectURL(blob)),
        error: () => (this.signatureUrl = null),
      });
    }
  }

  closePoDWindow(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#podWindow').jqxWindow('close');
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.photoUrl) URL.revokeObjectURL(this.photoUrl);
    if (this.signatureUrl) URL.revokeObjectURL(this.signatureUrl);
  }
}
