import { PagerComponent, paginate } from '../../shared/pager/pager.component';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../core/i18n.service';
import { AppNotification, NOTIF_ICON, NotificationsService } from '../../core/notifications.service';

/** Toutes les notifications de l'administrateur, sans quitter le tableau de bord. */
@Component({
  selector: 'app-admin-notifications',
  imports: [DatePipe, TranslatePipe, PagerComponent],
  template: `
    <header class="head">
      <div>
        <h1>{{ 'notif.title' | t }}</h1>
        <p class="muted">{{ 'admin.notif.lead' | t: { n: notifs.unread() } }}</p>
      </div>
      @if (notifs.unread()) {
        <button type="button" class="btn btn-ghost btn-sm" (click)="notifs.markAll()"><i class="fa-solid fa-check-double"></i> {{ 'notif.readAll' | t }}</button>
      }
    </header>

    <ul class="card list">
      @for (n of pageRows(); track n.id) {
        <li>
          <button type="button" [class.unread]="!n.read" (click)="open(n)">
            <span class="ico"><i class="fa-solid {{ icon[n.type] }}"></i></span>
            <span class="txt">
              <span class="msg">{{ n.message }}</span>
              <small>{{ n.createdAt | date: 'd MMM y, HH:mm' }}</small>
            </span>
            @if (!n.read) {
              <span class="dot" aria-hidden="true"></span>
            }
          </button>
        </li>
      } @empty {
        <li class="empty"><i class="fa-regular fa-bell-slash"></i> {{ 'notif.empty' | t }}</li>
      }
    </ul>
    <app-pager [total]="notifs.items().length" [size]="15" [(page)]="page" />
  `,
  styles: `
    .head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin: 8px 0 24px; }
    h1 { font-size: 1.8rem; margin: 0 0 4px; }
    .head p { margin: 0; }
    .list { list-style: none; margin: 0; padding: 6px; }
    .list button { width: 100%; display: flex; align-items: center; gap: 14px; padding: 14px; border: 0; border-radius: var(--radius); background: none; text-align: left; cursor: pointer; font: inherit; color: var(--text-2); }
    .list button:hover { background: var(--surface-2); }
    .list button.unread { color: var(--text); font-weight: 600; }
    .list li + li { border-top: 1px solid var(--border); }
    .ico { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--y-red-soft); color: var(--y-red); }
    .txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    small { color: var(--text-3); font-weight: 500; }
    .dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--y-ochre); }
    .empty { padding: 40px; text-align: center; color: var(--text-3); }
    .empty i { margin-right: 8px; }
  `,
})
export class AdminNotificationsPage {
  readonly notifs = inject(NotificationsService);
  private router = inject(Router);
  readonly icon = NOTIF_ICON;
  readonly page = signal(1);
  readonly pageRows = computed(() => paginate(this.notifs.items(), this.page(), 15));

  /** On reste dans l'administration : seuls les liens /admin sont suivis. */
  open(n: AppNotification) {
    void this.notifs.markOne(n.id);
    if (n.link?.startsWith('/admin')) void this.router.navigateByUrl(n.link);
  }
}
