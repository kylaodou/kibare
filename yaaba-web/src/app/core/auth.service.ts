import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  region?: string;
  language?: string;
  bio?: string;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

const KEY = 'kibare.session';

/** Session utilisateur : jeton JWT conservé dans le navigateur, profil en signal. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private api = environment.apiUrl;

  readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(null);
  readonly loggedIn = computed(() => !!this.user());
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as AuthResponse;
        if (!this.expired(s.token)) {
          this.token.set(s.token);
          this.user.set(s.user);
        } else {
          localStorage.removeItem(KEY);
        }
      }
    } catch {}
  }

  async register(data: { name: string; email: string; password: string; region?: string; language?: string }) {
    this.store(await firstValueFrom(this.http.post<AuthResponse>(`${this.api}/auth/register`, data)));
  }

  async login(email: string, password: string) {
    this.store(await firstValueFrom(this.http.post<AuthResponse>(`${this.api}/auth/login`, { email, password })));
  }

  async refresh() {
    if (!this.token()) return;
    try {
      const u = await firstValueFrom(this.http.get<User>(`${this.api}/me`));
      this.user.set(u);
      this.persist();
    } catch {}
  }

  async updateProfile(data: { name: string; region?: string; language?: string; bio?: string }) {
    const u = await firstValueFrom(this.http.put<User>(`${this.api}/me`, data));
    this.user.set(u);
    this.persist();
  }

  logout(redirect = true) {
    this.token.set(null);
    this.user.set(null);
    try {
      localStorage.removeItem(KEY);
    } catch {}
    if (redirect) void this.router.navigate(['/']);
  }

  /** Message d'erreur lisible renvoyé par l'API. */
  static message(e: unknown, fallback: string) {
    if (e instanceof HttpErrorResponse) {
      if (e.status === 0) return 'Serveur injoignable';
      return (e.error && typeof e.error === 'object' && 'message' in e.error ? (e.error as { message: string }).message : null) ?? fallback;
    }
    return fallback;
  }

  private store(r: AuthResponse) {
    this.token.set(r.token);
    this.user.set(r.user);
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ token: this.token(), user: this.user() }));
    } catch {}
  }

  private expired(token: string) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}

/** Ajoute le jeton aux appels de l'API et déconnecte proprement si la session a expiré. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const toApi = req.url.startsWith(environment.apiUrl);
  const r = token && toApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(r).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && token && toApi && !req.url.endsWith('/auth/login')) auth.logout(false);
      return throwError(() => e);
    }),
  );
};
