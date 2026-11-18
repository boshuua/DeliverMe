import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component.js';
import { AdminLayoutComponent } from './admin/admin-layout/admin-layout.component.js';
import { DeliveriesComponent } from './admin/deliveries/deliveries.component.js';
import { DeliveryCreateComponent } from './admin/delivery-create/delivery-create.component.js';
import { UsersComponent } from './admin/users/users.component.js';
import { AuditLogsComponent } from './admin/audit-logs/audit-logs.component.js';
import { IpBlocklistComponent } from './admin/ip-blocklist/ip-blocklist.component.js';
import { DriverComponent } from './driver/driver.component.js';
import { adminGuard, driverGuard, guestGuard } from './core/guards/auth.guard.js';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'deliveries', pathMatch: 'full' },
      { path: 'deliveries', component: DeliveriesComponent },
      { path: 'deliveries/new', component: DeliveryCreateComponent },
      { path: 'users', component: UsersComponent },
      { path: 'audit-logs', component: AuditLogsComponent },
      { path: 'ip-blocklist', component: IpBlocklistComponent },
    ],
  },
  {
    path: 'driver',
    component: DriverComponent,
    canActivate: [driverGuard],
  },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '/login',
  },
];
