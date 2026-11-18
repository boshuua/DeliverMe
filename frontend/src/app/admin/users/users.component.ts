import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/services/admin.service.js';
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

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  ngAfterViewInit(): void {
    if (typeof $ !== 'undefined' && $.fn.jqxWindow) {
      $('#userWindow').jqxWindow({
        width: 480,
        height: 480,
        isModal: true,
        autoOpen: false,
        resizable: false,
        theme: 'material',
      });
      $('#openProvisionModalBtn').jqxButton({ theme: 'material' });
      $('#saveUserBtn').jqxButton({ theme: 'material' });
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

    const roleCellsRenderer = (row: number, columnfield: string, value: string) => {
      const isAdm = value === 'ADMIN';
      const bg = isAdm ? '#ede9fe' : '#e0f2fe';
      const text = isAdm ? '#6d28d9' : '#0369a1';
      return `<div style="padding: 6px 10px;">
        <span style="background:${bg}; color:${text}; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">
          ${value}
        </span>
      </div>`;
    };

    const statusCellsRenderer = (row: number, columnfield: string, value: boolean) => {
      const bg = value ? '#dcfce7' : '#fee2e2';
      const text = value ? '#166534' : '#991b1b';
      const label = value ? 'ACTIVE' : 'DEACTIVATED';
      return `<div style="padding: 6px 10px;">
        <span style="background:${bg}; color:${text}; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">
          ${label}
        </span>
      </div>`;
    };

    const actionCellsRenderer = (row: number) => {
      return `<div style="padding: 4px 8px; text-align: center;">
        <button class="toggle-user-btn" data-row="${row}" style="background:#475569; color:#fff; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:11px; font-weight:500;">
          Toggle Status
        </button>
      </div>`;
    };

    $('#usersGrid').jqxGrid({
      width: '100%',
      height: 480,
      source: dataAdapter,
      theme: 'material',
      pageable: true,
      pageSize: 10,
      sortable: true,
      filterable: true,
      columnsresize: true,
      columns: [
        { text: 'Full Name', datafield: 'full_name', width: '22%' },
        { text: 'Email Address', datafield: 'email', width: '25%' },
        { text: 'Role', datafield: 'role', width: '13%', cellsrenderer: roleCellsRenderer },
        { text: 'Status', datafield: 'is_active', width: '15%', cellsrenderer: statusCellsRenderer },
        { text: 'Created By', datafield: 'created_by_name', width: '13%' },
        { text: 'Action', width: '12%', cellsrenderer: actionCellsRenderer, sortable: false, filterable: false },
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
      ? `Reactivate account for ${user.full_name}?`
      : `Deactivate account for ${user.full_name}? They will be unable to log in.`;

    if (confirm(confirmMsg)) {
      this.adminService.updateUser(user.id, { is_active: nextStatus }).subscribe({
        next: () => this.loadUsers(),
        error: (err) => alert(err.error?.error || 'Failed to update user status.'),
      });
    }
  }
}
