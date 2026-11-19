import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service.js';
import { IconService } from '../../core/services/icon.service.js';
import { User } from '../../core/models/index.js';

declare var $: any;

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
})
export class UsersComponent implements OnInit, AfterViewInit {
  private adminService = inject(AdminService);
  readonly iconService = inject(IconService);
  readonly icons = this.iconService.icons;

  users: User[] = [];
  isLoading = false;
  modalError = '';
  isSaving = false;

  // New user form state
  newFullName = '';
  newEmail = '';
  newPassword = '';
  newRole: 'ADMIN' | 'DRIVER' = 'DRIVER';
  newIsActive = true;

  get adminCount(): number {
    return this.users.filter((u) => u.role === 'ADMIN').length;
  }

  get driverCount(): number {
    return this.users.filter((u) => u.role === 'DRIVER').length;
  }

  get activeCount(): number {
    return this.users.filter((u) => u.is_active).length;
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  ngAfterViewInit(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#userWindow').jqxWindow({
        width: 500,
        height: 480,
        isModal: true,
        autoOpen: false,
        resizable: false,
        theme: 'material',
      });
    }
  }

  loadUsers(): void {
    this.isLoading = true;
    this.adminService.getUsers().subscribe({
      next: (res) => {
        this.users = res.users;
        this.isLoading = false;
        this.renderGrid();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error fetching users:', err);
      },
    });
  }

  renderGrid(): void {
    if (typeof $ === 'undefined' || !$.fn.jqxGrid) return;

    const source = {
      localdata: this.users,
      datatype: 'array',
      datafields: [
        { name: 'id', type: 'string' },
        { name: 'full_name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'is_active', type: 'bool' },
        { name: 'created_by_name', type: 'string' },
        { name: 'created_at', type: 'date' },
      ],
    };

    const dataAdapter = new $.jqx.dataAdapter(source);

    const nameCellsRenderer = (row: number, _columnfield: string, value: string) => {
      const data = $('#usersGrid').jqxGrid('getrowdata', row);
      const isAdm = data?.role === 'ADMIN';
      const icon = isAdm ? this.icons.userShield : this.icons.truck;
      const svg = this.iconService.getSvgHtml(icon, { size: 14, color: isAdm ? '#7c3aed' : '#2563eb' });
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 14px; gap: 8px;">
        ${svg}
        <strong style="color: #0f172a; font-weight: 600; font-size: 13px;">${value}</strong>
      </div>`;
    };

    const emailCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 14px; font-size: 13px; color: #334155;">
        ${value}
      </div>`;
    };

    const roleCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      const isAdm = value === 'ADMIN';
      const bg = isAdm ? '#f5f3ff' : '#eff6ff';
      const text = isAdm ? '#6d28d9' : '#1d4ed8';
      const border = isAdm ? '#ddd6fe' : '#bfdbfe';
      const icon = isAdm ? this.icons.userShield : this.icons.truck;
      const svg = this.iconService.getSvgHtml(icon, { size: 11, color: text });

      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 14px;">
        <span style="background:${bg}; color:${text}; border: 1px solid ${border}; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
          ${svg} ${value}
        </span>
      </div>`;
    };

    const statusCellsRenderer = (_row: number, _columnfield: string, value: boolean) => {
      const bg = value ? '#ecfdf5' : '#fff1f2';
      const text = value ? '#059669' : '#e11d48';
      const border = value ? '#a7f3d0' : '#fecdd3';
      const icon = value ? this.icons.circleCheck : this.icons.ban;
      const svg = this.iconService.getSvgHtml(icon, { size: 11, color: text });
      const label = value ? 'ACTIVE' : 'DEACTIVATED';

      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 14px;">
        <span style="background:${bg}; color:${text}; border: 1px solid ${border}; padding: 3px 10px; border-radius: 20px; font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;">
          ${svg} ${label}
        </span>
      </div>`;
    };

    const createdByCellsRenderer = (_row: number, _columnfield: string, value: string) => {
      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; padding: 0 14px; font-size: 13px; color: #64748b;">
        ${value || 'System'}
      </div>`;
    };

    const actionCellsRenderer = (row: number) => {
      const data = $('#usersGrid').jqxGrid('getrowdata', row);
      const isActive = data?.is_active === true;
      const btnBg = isActive ? '#ef4444' : '#10b981';
      const btnText = isActive ? 'Deactivate' : 'Activate';
      const icon = isActive ? this.icons.toggleOff : this.icons.toggleOn;
      const svg = this.iconService.getSvgHtml(icon, { size: 12, color: '#ffffff' });

      return `<div style="box-sizing: border-box; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 8px;">
        <button class="toggle-user-btn" data-row="${row}" style="background:${btnBg}; color:#fff; border:none; border-radius:6px; padding:6px 12px; cursor:pointer; font-size:12px; font-weight:600; display:inline-flex; align-items:center; gap:5px; transition: all 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
          ${svg} ${btnText}
        </button>
      </div>`;
    };

    $('#usersGrid').jqxGrid({
      width: '100%',
      autoheight: true,
      autorowheight: false,
      rowsheight: 48,
      source: dataAdapter,
      theme: 'material',
      pageable: true,
      pageSize: 10,
      pageSizeOptions: ['5', '10', '20'],
      sortable: true,
      filterable: true,
      columnsresize: true,
      columns: [
        { text: 'Full Name', datafield: 'full_name', width: '22%', cellsrenderer: nameCellsRenderer },
        { text: 'Email Address', datafield: 'email', width: '26%', cellsrenderer: emailCellsRenderer },
        { text: 'Role', datafield: 'role', width: '13%', cellsrenderer: roleCellsRenderer },
        { text: 'Status', datafield: 'is_active', width: '13%', cellsrenderer: statusCellsRenderer },
        { text: 'Created By', datafield: 'created_by_name', width: '13%', cellsrenderer: createdByCellsRenderer },
        { text: 'Actions', width: '13%', cellsrenderer: actionCellsRenderer, sortable: false, filterable: false },
      ],
    });

    $('#usersGrid').off('click', '.toggle-user-btn').on('click', '.toggle-user-btn', (e: any) => {
      const rowIndex = $(e.currentTarget).attr('data-row');
      const rowData = $('#usersGrid').jqxGrid('getrowdata', rowIndex);
      if (rowData) {
        this.toggleUserStatus(rowData);
      }
    });
  }

  openProvisionModal(): void {
    this.newFullName = '';
    this.newEmail = '';
    this.newPassword = '';
    this.newRole = 'DRIVER';
    this.newIsActive = true;
    this.modalError = '';

    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#userWindow').jqxWindow('open');
    }
  }

  closeModal(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#userWindow').jqxWindow('close');
    }
  }

  saveUser(): void {
    if (!this.newFullName || !this.newEmail || !this.newPassword) {
      this.modalError = 'Please fill out all required fields.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.modalError = 'Password must be at least 8 characters long.';
      return;
    }

    this.isSaving = true;
    this.modalError = '';

    this.adminService
      .createUser({
        full_name: this.newFullName,
        email: this.newEmail,
        password: this.newPassword,
        role: this.newRole,
        is_active: this.newIsActive,
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.closeModal();
          this.loadUsers();
        },
        error: (err) => {
          this.isSaving = false;
          this.modalError = err.error?.error || 'Failed to provision user.';
        },
      });
  }

  toggleUserStatus(user: User): void {
    const nextStatus = !user.is_active;
    const confirmMsg = nextStatus
      ? `Reactivate account for "${user.full_name}"?`
      : `Deactivate account for "${user.full_name}"? They will immediately lose login access.`;

    if (confirm(confirmMsg)) {
      this.adminService.updateUser(user.id, { is_active: nextStatus }).subscribe({
        next: () => this.loadUsers(),
        error: (err) => alert(err.error?.error || 'Failed to update user status.'),
      });
    }
  }
}
