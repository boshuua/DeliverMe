import { Component, OnInit, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminService } from '../../core/services/admin.service.js';
import { WebSocketService } from '../../core/services/websocket.service.js';
import { IconService } from '../../core/services/icon.service.js';
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
  private adminService = inject(AdminService);
  private wsService = inject(WebSocketService);
  readonly iconService = inject(IconService);
  readonly icons = this.iconService.icons;

  deliveries: Delivery[] = [];
  selectedDelivery: Delivery | null = null;
  photoUrl: string | null = null;
  signatureUrl: string | null = null;
  currentFilter: 'all' | 'active' | 'past' = 'all';
  isLoading = false;

  get totalCount(): number {
    return this.deliveries.length;
  }

  get activeCount(): number {
    return this.deliveries.filter((d) => d.status === 'PENDING' || d.status === 'ASSIGNED').length;
  }

  get completedCount(): number {
    return this.deliveries.filter((d) => d.status === 'DELIVERED').length;
  }

  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.loadDeliveries();

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
        width: 680,
        height: 600,
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

    const trackingCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      const svg = this.iconService.getSvgHtml(this.icons.qrcode, { size: 13, color: '#2563eb' });
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 12px; gap: 6px;">
        ${svg}
        <code style="font-family: var(--font-mono); font-weight: 700; color: #1e293b; font-size: 12px;">${value}</code>
      </div>`;
    };

    const deliveryNumCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 12px; font-size: 13px; color: #475569; font-weight: 500;">
        ${value}
      </div>`;
    };

    const recipientCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 12px; font-size: 13px; font-weight: 600; color: #0f172a;">
        ${value}
      </div>`;
    };

    const addressCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      const svg = this.iconService.getSvgHtml(this.icons.location, { size: 12, color: '#94a3b8' });
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 12px; gap: 6px; font-size: 13px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${svg}
        <span style="overflow: hidden; text-overflow: ellipsis;">${value}</span>
      </div>`;
    };

    const driverCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      const isAssigned = !!value;
      const svg = this.iconService.getSvgHtml(this.icons.truck, { size: 12, color: isAssigned ? '#2563eb' : '#94a3b8' });
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 12px; gap: 6px; font-size: 13px; color: ${isAssigned ? '#1e293b' : '#94a3b8'};">
        ${svg}
        <span>${value || 'Unassigned'}</span>
      </div>`;
    };

    const statusCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      const statusMap: Record<string, { bg: string; text: string; border: string; icon: any }> = {
        PENDING: { bg: '#fffbeb', text: '#d97706', border: '#fde68a', icon: this.icons.clock },
        ASSIGNED: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', icon: this.icons.truck },
        DELIVERED: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', icon: this.icons.circleCheck },
        CANCELLED: { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3', icon: this.icons.ban },
      };

      const s = statusMap[value] || { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', icon: this.icons.circle };
      const svg = this.iconService.getSvgHtml(s.icon, { size: 11, color: s.text });

      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 12px;">
        <span style="background:${s.bg}; color:${s.text}; border: 1px solid ${s.border}; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
          ${svg} ${value}
        </span>
      </div>`;
    };

    const actionCellsRenderer = (row: number) => {
      const svg = this.iconService.getSvgHtml(this.icons.eye, { size: 12, color: '#ffffff' });
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 6px;">
        <button class="grid-action-btn" data-row="${row}" style="background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);">
          ${svg} View Details
        </button>
      </div>`;
    };

    $('#deliveriesGrid').jqxGrid({
      width: '100%',
      autoheight: true,
      rowsheight: 48,
      source: dataAdapter,
      theme: 'material',
      pageable: true,
      pageSize: 10,
      pageSizeOptions: ['5', '10', '25', '50'],
      sortable: true,
      filterable: true,
      columnsresize: true,
      columns: [
        { text: 'Tracking Code', datafield: 'tracking_number', width: '16%', cellsrenderer: trackingCellsRenderer },
        { text: 'Delivery #', datafield: 'delivery_number', width: '11%', cellsrenderer: deliveryNumCellsRenderer },
        { text: 'Recipient', datafield: 'recipient_name', width: '15%', cellsrenderer: recipientCellsRenderer },
        { text: 'Destination Address', datafield: 'delivery_address', width: '22%', cellsrenderer: addressCellsRenderer },
        { text: 'Assigned Driver', datafield: 'assigned_driver_name', width: '13%', cellsrenderer: driverCellsRenderer },
        { text: 'Status', datafield: 'status', width: '10%', cellsrenderer: statusCellsRenderer },
        { text: 'Artifacts', width: '13%', cellsrenderer: actionCellsRenderer, sortable: false, filterable: false },
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
