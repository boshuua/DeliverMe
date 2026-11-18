import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service.js';
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
  blockedIps: BlockedIp[] = [];
  isLoading = false;
  isSaving = false;
  modalError = '';

  newIpAddress = '';
  newReason = '';

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadBlockedIps();
  }

  ngAfterViewInit(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#blockWindow').jqxWindow({
        width: 440,
        height: 340,
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

    const ipCellsRenderer = (row: number, columnfield: string, value: string) => {
      return `<div style="padding: 6px 10px;">
        <span style="font-family: monospace; font-weight: 700; color: #991b1b; background: #fee2e2; padding: 2px 6px; border-radius: 4px;">
          ${value}
        </span>
      </div>`;
    };

    const actionCellsRenderer = (row: number) => {
      return `<div style="padding: 4px 8px; text-align: center;">
        <button class="unblock-btn" data-row="${row}" style="background: #10b981; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 11px; font-weight: 600;">
          Unblock
        </button>
      </div>`;
    };

    $('#blockedIpGrid').jqxGrid({
      width: '100%',
      height: 440,
      source: dataAdapter,
      theme: 'material',
      pageable: true,
      pageSize: 10,
      sortable: true,
      filterable: true,
      columnsresize: true,
      columns: [
        { text: 'IP Address', datafield: 'ip_address', width: '25%', cellsrenderer: ipCellsRenderer },
        { text: 'Reason for Block', datafield: 'reason', width: '35%' },
        { text: 'Blocked By (Admin)', datafield: 'blocked_by_name', width: '20%' },
        { text: 'Date Blocked', datafield: 'created_at', width: '20%', cellsformat: 'yyyy-MM-dd HH:mm' },
        { text: 'Action', width: '15%', cellsrenderer: actionCellsRenderer, sortable: false, filterable: false },
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
