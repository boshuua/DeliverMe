import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service.js';
import { AuditLog } from '../../core/models/index.js';

declare var $: any;

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.css'],
})
export class AuditLogsComponent implements OnInit, AfterViewInit {
  logs: AuditLog[] = [];
  totalCount = 0;
  isLoading = false;
  filterAction = '';
  filterIp = '';

  selectedMetadata: any = null;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  ngAfterViewInit(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#metaWindow').jqxWindow({
        width: 480,
        height: 380,
        isModal: true,
        autoOpen: false,
        theme: 'material',
      });
      $('#filterBtn').jqxButton({ theme: 'material' });
      $('#clearBtn').jqxButton({ theme: 'material' });
    }
  }

  loadLogs(): void {
    this.isLoading = true;
    this.adminService
      .getAuditLogs({
        limit: 100,
        action: this.filterAction || undefined,
        ip: this.filterIp || undefined,
      })
      .subscribe({
        next: (res) => {
          this.logs = res.logs;
          this.totalCount = res.total;
          this.isLoading = false;
          this.renderGrid();
        },
        error: (err) => {
          this.isLoading = false;
          console.error('Error fetching audit logs:', err);
        },
      });
  }

  clearFilters(): void {
    this.filterAction = '';
    this.filterIp = '';
    this.loadLogs();
  }

  renderGrid(): void {
    if (typeof $ === 'undefined' || !$.fn.jqxGrid) return;

    const source = {
      localdata: this.logs,
      datatype: 'array',
      datafields: [
        { name: 'id', type: 'number' },
        { name: 'action', type: 'string' },
        { name: 'ip_address', type: 'string' },
        { name: 'user_email', type: 'string' },
        { name: 'entity_type', type: 'string' },
        { name: 'entity_id', type: 'string' },
        { name: 'created_at', type: 'date' },
        { name: 'metadata', type: 'any' },
      ],
    };

    const dataAdapter = new $.jqx.dataAdapter(source);

    const actionCellsRenderer = (row: number, columnfield: string, value: string) => {
      let bg = '#f1f5f9';
      let text = '#334155';

      if (value.includes('FAIL') || value.includes('UNAUTH') || value.includes('FORBIDDEN')) {
        bg = '#fee2e2';
        text = '#991b1b';
      } else if (value.includes('BLOCK')) {
        bg = '#fef3c7';
        text = '#92400e';
      } else if (value.includes('COMPLETED') || value.includes('PROVISIONED')) {
        bg = '#dcfce7';
        text = '#166534';
      } else if (value.includes('LOGIN')) {
        bg = '#e0f2fe';
        text = '#0369a1';
      }

      return `<div style="padding: 6px 10px;">
        <span style="background:${bg}; color:${text}; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">
          ${value}
        </span>
      </div>`;
    };

    const ipCellsRenderer = (row: number, columnfield: string, value: string) => {
      return `<div style="padding: 6px 10px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-family: monospace; font-weight: 600;">${value}</span>
        <button class="block-ip-quick-btn" data-ip="${value}" title="Manually block this IP address" style="background: #ef4444; color: #fff; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer;">
          Block IP
        </button>
      </div>`;
    };

    const metaCellsRenderer = (row: number) => {
      return `<div style="padding: 4px 8px; text-align: center;">
        <button class="view-meta-btn" data-row="${row}" style="background: #64748b; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 11px;">
          View Meta
        </button>
      </div>`;
    };

    $('#auditGrid').jqxGrid({
      width: '100%',
      height: 500,
      source: dataAdapter,
      theme: 'material',
      pageable: true,
      pageSize: 15,
      pageSizeOptions: ['10', '15', '25', '50'],
      sortable: true,
      filterable: false,
      columnsresize: true,
      columns: [
        { text: 'Timestamp', datafield: 'created_at', width: '18%', cellsformat: 'yyyy-MM-dd HH:mm:ss' },
        { text: 'Action Event', datafield: 'action', width: '24%', cellsrenderer: actionCellsRenderer },
        { text: 'Requester IP', datafield: 'ip_address', width: '22%', cellsrenderer: ipCellsRenderer },
        { text: 'Actor / User', datafield: 'user_email', width: '24%' },
        { text: 'Details', width: '12%', cellsrenderer: metaCellsRenderer, sortable: false },
      ],
    });

    $('#auditGrid').off('click', '.block-ip-quick-btn').on('click', '.block-ip-quick-btn', (e: any) => {
      const ip = $(e.currentTarget).attr('data-ip');
      if (ip) {
        this.confirmAndBlockIp(ip);
      }
    });

    $('#auditGrid').off('click', '.view-meta-btn').on('click', '.view-meta-btn', (e: any) => {
      const rowIndex = $(e.currentTarget).attr('data-row');
      const rowData = $('#auditGrid').jqxGrid('getrowdata', rowIndex);
      if (rowData) {
        this.showMetadata(rowData);
      }
    });
  }

  showMetadata(row: any): void {
    this.selectedMetadata = {
      action: row.action,
      ip: row.ip_address,
      user: row.user_email || 'Unauthenticated',
      entity: `${row.entity_type || 'N/A'} : ${row.entity_id || 'N/A'}`,
      metadata: row.metadata,
    };
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#metaWindow').jqxWindow('open');
    }
  }

  closeMeta(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#metaWindow').jqxWindow('close');
    }
  }

  confirmAndBlockIp(ip: string): void {
    const reason = prompt(`Strict Security Policy: Manually block IP address "${ip}"?\nEnter reason for block:`, 'Suspicious activity recorded in audit logs');
    if (reason) {
      this.adminService.blockIp(ip, reason).subscribe({
        next: () => {
          alert(`IP address ${ip} has been manually added to the blocklist.`);
          this.loadLogs();
        },
        error: (err) => alert(err.error?.error || 'Failed to block IP.'),
      });
    }
  }
}
