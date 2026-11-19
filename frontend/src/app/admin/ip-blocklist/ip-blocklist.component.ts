import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service.js';
import { IconService } from '../../core/services/icon.service.js';
import { BlockedIp } from '../../core/models/index.js';

declare var $: any;

@Component({
  selector: 'app-ip-blocklist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ip-blocklist.component.html',
  styleUrls: ['./ip-blocklist.component.css'],
})
export class IpBlocklistComponent implements OnInit, AfterViewInit {
  private adminService = inject(AdminService);
  iconService = inject(IconService);

  blockedIps: BlockedIp[] = [];
  isLoading = false;
  isSaving = false;
  modalError = '';

  newIpAddress = '';
  newReason = '';

  constructor() {}

  ngOnInit(): void {
    this.loadBlockedIps();
  }

  ngAfterViewInit(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#blockWindow').jqxWindow({
        width: 480,
        height: 'auto',
        isModal: true,
        autoOpen: false,
        resizable: false,
        theme: 'material',
      });
      $('#openBlockModalBtn').jqxButton({ theme: 'material' });
      $('#saveBlockBtn').jqxButton({ theme: 'material' });
    }
  }

  loadBlockedIps(): void {
    this.isLoading = true;
    this.adminService.getBlockedIps().subscribe({
      next: (res) => {
        this.blockedIps = res.blockedIps.filter((b) => b.is_active);
        this.isLoading = false;
        this.renderGrid();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error fetching blocked IPs:', err);
      },
    });
  }

  renderGrid(): void {
    if (typeof $ === 'undefined' || !$.fn.jqxGrid) return;

    const source = {
      localdata: this.blockedIps,
      datatype: 'array',
      datafields: [
        { name: 'id', type: 'string' },
        { name: 'ip_address', type: 'string' },
        { name: 'reason', type: 'string' },
        { name: 'blocked_by_name', type: 'string' },
        { name: 'created_at', type: 'date' },
      ],
    };

    const dataAdapter = new $.jqx.dataAdapter(source);

    const banSvg = this.iconService.getSvgHtml(this.iconService.icons.ban, { size: 12, color: '#dc2626' });
    const checkSvg = this.iconService.getSvgHtml(this.iconService.icons.check, { size: 12, color: '#ffffff' });
    const adminSvg = this.iconService.getSvgHtml(this.iconService.icons.userShield, { size: 12, color: '#64748b' });

    const ipCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 14px;">
        <span style="font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 12px; font-weight: 700; color: #991b1b; background: #fee2e2; border: 1px solid #fecaca; padding: 3px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
          ${banSvg} ${value}
        </span>
      </div>`;
    };

    const reasonCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 14px; font-size: 13px; color: #475569;">
        ${value || '—'}
      </div>`;
    };

    const adminCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      const name = value || 'System Security';
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; gap: 6px; padding: 0 14px; font-size: 13px; color: #334155;">
        ${adminSvg} <span>${name}</span>
      </div>`;
    };

    const dateCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      const formatted = value ? new Date(value).toISOString().replace('T', ' ').substring(0, 16) : '—';
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 14px; font-size: 13px; color: #64748b;">
        ${formatted}
      </div>`;
    };

    const actionCellsRenderer = (row: number) => {
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 8px;">
        <button class="unblock-btn" data-row="${row}" style="background: #10b981; color: #ffffff; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 1px 2px rgba(16, 185, 129, 0.2); transition: background-color 0.15s ease;">
          ${checkSvg} Unblock IP
        </button>
      </div>`;
    };

    $('#blockedIpGrid').jqxGrid({
      width: '100%',
      autoheight: true,
      autorowheight: false,
      source: dataAdapter,
      theme: 'material',
      pageable: true,
      pageSize: 10,
      sortable: true,
      filterable: true,
      columnsresize: true,
      columnsheight: 42,
      rowsheight: 48,
      columns: [
        { text: 'Blocked IP Address', datafield: 'ip_address', width: '22%', cellsrenderer: ipCellsRenderer },
        { text: 'Reason / Incident Note', datafield: 'reason', width: '34%', cellsrenderer: reasonCellsRenderer },
        { text: 'Enforcing Admin', datafield: 'blocked_by_name', width: '18%', cellsrenderer: adminCellsRenderer },
        { text: 'Date Blocked', datafield: 'created_at', width: '14%', cellsrenderer: dateCellsRenderer },
        { text: 'Action', width: '12%', cellsrenderer: actionCellsRenderer, sortable: false, filterable: false },
      ],
    });

    $('#blockedIpGrid').off('click', '.unblock-btn').on('click', '.unblock-btn', (e: any) => {
      const rowIndex = $(e.currentTarget).attr('data-row');
      const rowData = $('#blockedIpGrid').jqxGrid('getrowdata', rowIndex);
      if (rowData) {
        this.unblockIp(rowData.id, rowData.ip_address);
      }
    });
  }

  openBlockModal(): void {
    this.newIpAddress = '';
    this.newReason = '';
    this.modalError = '';

    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#blockWindow').jqxWindow('open');
    }
  }

  closeModal(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#blockWindow').jqxWindow('close');
    }
  }

  saveBlock(): void {
    if (!this.newIpAddress.trim()) {
      this.modalError = 'IP address is required.';
      return;
    }

    this.isSaving = true;
    this.modalError = '';

    this.adminService.blockIp(this.newIpAddress.trim(), this.newReason.trim()).subscribe({
      next: () => {
        this.isSaving = false;
        this.closeModal();
        this.loadBlockedIps();
      },
      error: (err) => {
        this.isSaving = false;
        this.modalError = err.error?.error || 'Failed to block IP address.';
      },
    });
  }

  unblockIp(id: string, ip: string): void {
    if (confirm(`Remove manual block on IP "${ip}"? It will immediately be permitted to connect again.`)) {
      this.adminService.unblockIp(id).subscribe({
        next: () => this.loadBlockedIps(),
        error: (err) => alert(err.error?.error || 'Failed to unblock IP.'),
      });
    }
  }
}
