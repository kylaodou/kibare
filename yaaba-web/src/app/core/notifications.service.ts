import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface AppNotification {
  id: number;
  type: 'NEW_CONTRIBUTION' | 'CONTRIBUTION_APPROVED' | 'CONTRIBUTION_REJECTED' | 'NEW_COMMENT' | 'COMMENT_REPLY' | 'NEW_USER';
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export const NOTIF_ICON: Record<string, string> = {
  NEW_CONTRIBUTION: 'fa-inbox',
  CONTRIBUTION_APPROVED: 'fa-circle-check',
  CONTRIBUTION_REJECTED: 'fa-circle-xmark',
  NEW_COMMENT: 'fa-comment',
  COMMENT_REPLY: 'fa-reply',
  NEW_USER: 'fa-user-plus',
};

/** Relève les notifications toutes les 30 s quand l'utilisateur est connecté, et affiche un toast pour chaque nouvelle. */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private toast = inject(MessageService);
  private api = environment.apiUrl;

  readonly items = signal<AppNotification[]>([]);
  readonly unread = computed(() => this.items().filter((n) => !n.read).length);
  private known = new Set<number>();
  private timer?: number;

  constructor() {
    effect(() => {
      const logged = this.auth.loggedIn();
      clearInterval(this.timer);
      this.known.clear();
      this.items.set([]);
      if (!logged) return;
      void this.poll(true);
      this.timer = window.setInterval(() => void this.poll(false), 30_000);
    });
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  async poll(first = false) {
    try {
      const list = await firstValueFrom(this.http.get<AppNotification[]>(`${this.api}/me/notifications`));
      if (!first) {
        for (const n of list.filter((x) => !x.read && !this.known.has(x.id)).slice(0, 3)) {
          const sev = n.type === 'CONTRIBUTION_REJECTED' ? 'warn' : n.type === 'CONTRIBUTION_APPROVED' ? 'success' : 'info';
          this.toast.add({ severity: sev, summary: 'KIBARE', detail: n.message, life: 6000 });
        }
      }
      list.forEach((n) => this.known.add(n.id));
      this.items.set(list);
    } catch {}
  }

  async markAll() {
    this.items.update((l) => l.map((n) => ({ ...n, read: true })));
    try {
      await firstValueFrom(this.http.post(`${this.api}/me/notifications/read`, {}));
    } catch {}
  }

  async markOne(id: number) {
    this.items.update((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await firstValueFrom(this.http.post(`${this.api}/me/notifications/${id}/read`, {}));
    } catch {}
  }
}
