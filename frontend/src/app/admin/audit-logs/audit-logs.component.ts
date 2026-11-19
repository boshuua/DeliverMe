import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service.js';
import { IconService } from '../../core/services/icon.service.js';
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
  private adminService = inject(AdminService);
  readonly iconService = inject(IconService);
  readonly icons = this.iconService.icons;

  logs: AuditLog[] = [];
  totalCount = 0;
  isLoading = false;
  filterAction = '';
  filterIp = '';

  selectedMetadata: any = null;

  ngOnInit(): void {
    this.loadLogs();
  }

  ngAfterViewInit(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#metaWindow').jqxWindow({
        width: 520,
        height: 420,
        isModal: true,
        autoOpen: false,
        theme: 'material',
      });
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

    const actionCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      let bg = '#f1f5f9';
      let text = '#334155';
      let icon = this.icons.circle;

      if (value.includes('FAIL') || value.includes('UNAUTH') || value.includes('FORBIDDEN')) {
        bg = '#fff1f2';
        text = '#e11d48';
        icon = this.icons.danger;
      } else if (value.includes('BLOCK')) {
        bg = '#fffbeb';
        text = '#d97706';
        icon = this.icons.ban;
      } else if (value.includes('COMPLETED') || value.includes('PROVISIONED')) {
        bg = '#ecfdf5';
        text = '#059669';
        icon = this.icons.circleCheck;
      } else if (value.includes('LOGIN')) {
        bg = '#eff6ff';
        text = '#2563eb';
        icon = this.icons.userCheck;
      }

      const svg = this.iconService.getSvgHtml(icon, { size: 11, color: text });

      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 12px;">
        <span style="background:${bg}; color:${text}; border: 1px solid ${text}33; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
          ${svg} ${value}
        </span>
      </div>`;
    };

    const timeCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      const formatted = value ? new Date(value).toISOString().replace('T', ' ').substring(0, 19) : '—';
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 12px; font-family: var(--font-mono); font-size: 12px; color: #475569;">
        ${formatted}
      </div>`;
    };

    const userCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 12px; font-size: 13px; color: #334155;">
        ${value || 'Anonymous / Guest'}
      </div>`;
    };

    const ipCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      const banSvg = this.iconService.getSvgHtml(this.icons.ban, { size: 10, color: '#ffffff' });
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 12px;">
        <code style="font-family: var(--font-mono); font-weight: 600; color: #1e293b; font-size: 12px;">${value}</code>
        <button class="block-ip-quick-btn" data-ip="${value}" title="Manually block this IP address" style="background: #e11d48; color: #fff; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; font-weight: 600; box-shadow: 0 1px 2px rgba(225, 29, 72, 0.2);">
          ${banSvg} Block IP
        </button>
      </div>`;
    };

    const metaCellsRenderer = (row: number) => {
      const eyeSvg = this.iconService.getSvgHtml(this.icons.eye, { size: 11, color: '#ffffff' });
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 8px;">
        <button class="view-meta-btn" data-row="${row}" style="background: #475569; color: #fff; border: none; border-radius: 5px; padding: 5px 10px; cursor: pointer; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
          ${eyeSvg} Details
        </button>
      </div>`;
    };

    $('#auditGrid').jqxGrid({
      width: '100%',
      autoheight: true,
      rowsheight: 48,
      source: dataAdapter,
      theme: 'material',
      pageable: true,
      pageSize: 15,
      pageSizeOptions: ['10', '15', '25', '50'],
      sortable: true,
      filterable: false,
      columnsresize: true,
      columns: [
        { text: 'Timestamp', datafield: 'created_at', width: '16%', cellsrenderer: timeCellsRenderer },
        { text: 'Event Action', datafield: 'action', width: '24%', cellsrenderer: actionCellsRenderer },
        { text: 'Requester IP', datafield: 'ip_address', width: '22%', cellsrenderer: ipCellsRenderer },
        { text: 'Actor / User', datafield: 'user_email', width: '26%', cellsrenderer: userCellsRenderer },
        { text: 'Metadata', width: '12%', cellsrenderer: metaCellsRenderer, sortable: false },
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
      user: row.user_email || 'Unauthenticated Requester',
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
    const reason = prompt(
      `Strict Security Policy: Manually block IP address "${ip}"?\nEnter reason for block:`,
      'Suspicious activity recorded in audit logs'
    );
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
