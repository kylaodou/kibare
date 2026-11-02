import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { AdminService, AdminUserRow } from './admin.service';
import { LazyList } from './lazy-list';

/** Comptes : pagination, recherche et tri côté serveur. */
@Component({
  selector: 'app-admin-users',
  imports: [FormsModule, DatePipe, TranslatePipe, TableModule],
  template: `
    <header class="ph">
      <div>
        <h1>{{ 'admin.nav.users' | t }}</h1>
        <p class="muted">{{ 'admin.usersLead' | t: { n: list.total() } }}</p>
      </div>
    </header>
    <div class="toolbar">
      <span class="search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input type="search" #s (input)="list.search(s.value)" [placeholder]="'admin.searchUsers' | t" aria-label="Rechercher un utilisateur" />
      </span>
    </div>

    <p-table class="ktable" [value]="list.items()" [lazy]="true" (onLazyLoad)="list.onLazy($event)" [loading]="list.loading()"
      [paginator]="true" [rows]="list.rows()" [first]="list.first()" [totalRecords]="list.total()" paginatorPosition="bottom"
      [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} sur {totalRecords}"
      [tableStyle]="{ 'min-width': '900px' }" [scrollable]="true">
      <ng-template #header>
        <tr>
          <th pSortableColumn="name" style="min-width: 200px">{{ 'admin.c.author' | t }} <p-sortIcon field="name" /></th>
          <th>{{ 'auth.region' | t }}</th>
          <th class="num">{{ 'admin.k.contrib' | t }}</th>
          <th class="num">{{ 'admin.s.APPROVED' | t }}</th>
          <th class="num">{{ 'admin.k.comments' | t }}</th>
          <th pSortableColumn="lastLoginAt">{{ 'admin.c.lastLogin' | t }} <p-sortIcon field="lastLoginAt" /></th>
          <th pSortableColumn="role">{{ 'admin.c.role' | t }} <p-sortIcon field="role" /></th>
          <th>{{ 'admin.c.status' | t }}</th>
        </tr>
      </ng-template>
      <ng-template #body let-r>
        <tr [class.dim]="!r.user.active">
          <td>
            <span class="t-title">{{ r.user.name }}</span>
            @if (r.user.emailVerified === false) {
              <span class="chip chip-yellow" title="Adresse e-mail non confirmée">non vérifié</span>
            }
            <br /><small>{{ r.user.email }} · {{ r.user.createdAt | date: 'dd/MM/yyyy' }}</small>
          </td>
          <td>{{ r.user.region ? (data.regionMap().get(r.user.region)?.name ?? r.user.region) : '—' }}</td>
          <td class="num">{{ r.contributions }}</td>
          <td class="num">{{ r.approved }}</td>
          <td class="num">{{ r.comments }}</td>
          <td><small>{{ r.lastLoginAt ? (r.lastLoginAt | date: 'dd/MM/yyyy HH:mm') : '—' }}</small></td>
          <td>
            <select [ngModel]="r.user.role" (ngModelChange)="update(r, { role: $event })" [disabled]="r.user.id === auth.user()?.id || busy() === r.user.id" class="sel" [attr.aria-label]="'Rôle de ' + r.user.name">
              <option value="USER">{{ 'admin.role.USER' | t }}</option>
              <option value="ADMIN">{{ 'admin.role.ADMIN' | t }}</option>
            </select>
          </td>
          <td>
            <button type="button" class="btn btn-ghost btn-sm" (click)="update(r, { active: !r.user.active })" [disabled]="r.user.id === auth.user()?.id || busy() === r.user.id">
              {{ (r.user.active ? 'admin.deactivate' : 'admin.activate') | t }}
            </button>
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr><td colspan="8" class="empty">{{ list.error() ? 'Le serveur ne répond pas.' : 'Aucun utilisateur ne correspond à votre recherche.' }}</td></tr>
      </ng-template>
    </p-table>
  `,
  styleUrl: './admin-shared.scss',
  styles: `.sel { padding: 6px 8px; border: 1px solid var(--border-strong); border-radius: 6px; background: var(--surface); color: var(--text); } .dim td { opacity: 0.55; } .chip { margin-left: 6px; font-size: 0.66rem; }`,
})
export class AdminUsersPage {
  private admin = inject(AdminService);
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  private toast = inject(MessageService);
  private i18n = inject(I18nService);
  readonly list = new LazyList<AdminUserRow>((q) => this.admin.users(q));
  readonly busy = signal<number | null>(null);

  update(r: AdminUserRow, p: { active?: boolean; role?: string }) {
    this.busy.set(r.user.id);
    this.admin.updateUser(r.user.id, p).subscribe({
      next: () => {
        this.busy.set(null);
        this.toast.add({ severity: 'success', summary: this.i18n.t('account.saved'), life: 2000 });
        this.list.load();
      },
      error: () => {
        this.busy.set(null);
        this.toast.add({ severity: 'error', summary: this.i18n.t('admin.error'), life: 3000 });
        this.list.load();
      },
    });
  }
}
