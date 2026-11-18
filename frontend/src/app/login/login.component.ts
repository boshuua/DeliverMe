import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service.js';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  fillAdmin(): void {
    this.email = 'admin@deliverme.local';
    this.password = 'Admin123!';
    this.errorMessage = '';
  }

  fillDriver(): void {
    this.email = 'driver@deliverme.local';
    this.password = 'Driver123!';
    this.errorMessage = '';
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
        this.errorMessage = err.error?.error || err.error?.message || 'Login failed. Please check your credentials.';
      },
    });
  }
}
