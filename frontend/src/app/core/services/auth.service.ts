import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, UserRole } from '../models/index.js';

interface StoredUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = '/api/v1/auth';
  private tokenKey = 'deliverme_jwt_token';
  private userKey = 'deliverme_user_info';

  currentUser = signal<StoredUser | null>(this.getStoredUser());
  isAuthenticated = computed(() => !!this.currentUser());
  isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');
  isDriver = computed(() => this.currentUser()?.role === 'DRIVER');

  constructor(private http: HttpClient, private router: Router) {}

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem(this.userKey, JSON.stringify(res.user));
        this.currentUser.set(res.user);
      })
    );
  }

  logout(): void {
    if (this.getToken()) {
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
        error: () => {},
      });
    }
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private getStoredUser(): StoredUser | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
