import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service.js';
import { IconService } from '../core/services/icon.service.js';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  iconService = inject(IconService);

  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor() {}

  fillAdmin(): void {
    this.email = 'admin@deliverme.local';
  }

  fillDriver(): void {
    this.email = 'driver@deliverme.local';
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.user.role === 'ADMIN') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/driver']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 0 || err.status === 504 || err.status === 502) {
          this.errorMessage = 'Cannot reach backend server. Please verify the backend is running in a terminal (cd backend; npm run dev).';
        } else {
          this.errorMessage = err.error?.error || err.error?.message || 'Login failed. Please check your credentials.';
        }
      },
    });
  }
}
