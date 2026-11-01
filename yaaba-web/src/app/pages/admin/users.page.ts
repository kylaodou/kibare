import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { AdminService, AdminUserRow } from './admin.service';

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule, DatePipe, TranslatePipe],
  template: `
    <header class="ph">
      <div>
        <h1>{{ 'admin.nav.users' | t }}</h1>
        <p class="muted">{{ 'admin.usersLead' | t: { n: items().length } }}</p>
      </div>
    </header>
    <div class="toolbar">
      <input type="search" [ngModel]="q()" (ngModelChange)="q.set($event)" [placeholder]="'admin.searchUsers' | t" />
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>{{ 'admin.c.author' | t }}</th>
            <th>{{ 'auth.region' | t }}</th>
            <th class="num">{{ 'admin.k.contrib' | t }}</th>
            <th class="num">{{ 'admin.s.APPROVED' | t }}</th>
            <th class="num">{{ 'admin.k.comments' | t }}</th>
            <th>{{ 'admin.c.lastLogin' | t }}</th>
            <th>{{ 'admin.c.role' | t }}</th>
            <th>{{ 'admin.c.status' | t }}</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.user.id) {
            <tr [style.opacity]="r.user.active ? 1 : 0.55">
              <td><span class="t-title">{{ r.user.name }}</span><br /><small>{{ r.user.email }} · {{ r.user.createdAt | date: 'd MMM y' }}</small></td>
              <td>{{ r.user.region ? data.regionMap().get(r.user.region)?.name : '—' }}</td>
              <td class="num">{{ r.contributions }}</td>
              <td class="num">{{ r.approved }}</td>
              <td class="num">{{ r.comments }}</td>
              <td><small>{{ r.lastLoginAt ? (r.lastLoginAt | date: 'd MMM, HH:mm') : '—' }}</small></td>
              <td>
                <select [ngModel]="r.user.role" (ngModelChange)="update(r, { role: $event })" [disabled]="r.user.id === auth.user()?.id" class="sel">
                  <option value="USER">{{ 'admin.role.USER' | t }}</option>
                  <option value="ADMIN">{{ 'admin.role.ADMIN' | t }}</option>
                </select>
              </td>
              <td>
                <button type="button" class="btn btn-ghost btn-sm" (click)="update(r, { active: !r.user.active })" [disabled]="r.user.id === auth.user()?.id">
                  {{ (r.user.active ? 'admin.deactivate' : 'admin.activate') | t }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './admin-shared.scss',
  styles: `.sel { padding: 6px 8px; border: 1px solid var(--border-strong); border-radius: 6px; background: var(--surface); color: var(--text); }`,
})
export class AdminUsersPage {
  private admin = inject(AdminService);
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  private toast = inject(MessageService);
  private i18n = inject(I18nService);
  readonly items = signal<AdminUserRow[]>([]);
  readonly q = signal('');
  readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return this.items().filter((r) => !q || r.user.name.toLowerCase().includes(q) || r.user.email.toLowerCase().includes(q));
  });

  constructor() {
    this.load();
  }

  load() {
    this.admin.users().subscribe({ next: (l) => this.items.set(l), error: () => {} });
  }

  update(r: AdminUserRow, p: { active?: boolean; role?: string }) {
    this.admin.updateUser(r.user.id, p).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.i18n.t('account.saved'), life: 2000 });
        this.load();
      },
      error: () => this.toast.add({ severity: 'error', summary: this.i18n.t('admin.error'), life: 3000 }),
    });
  }
}
