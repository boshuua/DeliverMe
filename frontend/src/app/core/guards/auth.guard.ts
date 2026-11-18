import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service.js';

export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.isAdmin()) {
    return true;
  }

  if (authService.isAuthenticated() && authService.isDriver()) {
    router.navigate(['/driver']);
    return false;
  }

  router.navigate(['/login']);
  return false;
};

export const driverGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated() && authService.isDriver()) {
    return true;
  }

  if (authService.isAuthenticated() && authService.isAdmin()) {
    router.navigate(['/admin']);
    return false;
  }

  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  if (authService.isAdmin()) {
    router.navigate(['/admin']);
    return false;
  }

  router.navigate(['/driver']);
  return false;
};
