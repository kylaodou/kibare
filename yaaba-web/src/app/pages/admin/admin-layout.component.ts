import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PopoverModule } from 'primeng/popover';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { AppNotification, NOTIF_ICON, NotificationsService } from '../../core/notifications.service';
import { ThemeService } from '../../core/theme.service';
import { LogoComponent } from '../../shared/logo/logo.component';

/**
 * Coque du back-office, autonome : ni menu ni pied de page du site public.
 * Barre latérale, barre du haut (langue, thème, notifications), contenu.
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoComponent, TranslatePipe, PopoverModule, DatePipe],
  template: `
    <div class="admin" [class.open]="open()">
      <aside class="side">
        <div class="side-head">
          <app-logo [size]="34" />
          <span class="role">{{ 'admin.eyebrow' | t }}</span>
        </div>
        <nav>
          @for (l of links; track l.path) {
            <a [routerLink]="l.path" routerLinkActive="on" [routerLinkActiveOptions]="{ paths: l.exact ? 'exact' : 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' }" ariaCurrentWhenActive="page" (click)="open.set(false)">
              <i class="fa-solid {{ l.icon }}"></i>
              <span>{{ l.key | t }}</span>
              @if (l.path === '/admin/contributions' && pending()) {
                <span class="pill">{{ pending() }}</span>
              }
              @if (l.path === '/admin/notifications' && notifs.unread()) {
                <span class="pill">{{ notifs.unread() }}</span>
              }
            </a>
          }
        </nav>
        <div class="side-foot">
          <a routerLink="/"><i class="fa-solid fa-arrow-up-right-from-square"></i> {{ 'admin.backSite' | t }}</a>
          <div class="me">
            <span class="av">{{ auth.user()?.name?.slice(0, 1) }}</span>
            <span>
              <strong>{{ auth.user()?.name }}</strong>
              <small>{{ auth.user()?.email }}</small>
            </span>
          </div>
          <button type="button" class="logout" (click)="auth.logout()"><i class="fa-solid fa-right-from-bracket"></i> {{ 'nav.logout' | t }}</button>
        </div>
      </aside>
      <div class="main">
        <div class="topline">
          <button type="button" class="burger" (click)="open.set(!open())" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
          @if (!data.online()) {
            <span class="warn"><i class="fa-solid fa-plug-circle-xmark"></i> {{ 'admin.noServer' | t }}</span>
          }
          <div class="tools">
            <button type="button" class="tool" (click)="theme.toggle()" [attr.aria-label]="(theme.dark() ? 'header.light' : 'header.dark') | t">
              <i class="fa-solid" [class.fa-moon]="!theme.dark()" [class.fa-sun]="theme.dark()"></i>
            </button>
            <button type="button" class="tool" (click)="np.toggle($event)" [attr.aria-label]="'notif.title' | t">
              <i class="fa-regular fa-bell"></i>
              @if (notifs.unread()) {
                <span class="badge">{{ notifs.unread() > 9 ? '9+' : notifs.unread() }}</span>
              }
            </button>
            <p-popover #np>
              <div class="np">
                <div class="np-head">
                  <strong>{{ 'notif.title' | t }}</strong>
                  @if (notifs.unread()) {
                    <button type="button" class="link" (click)="notifs.markAll()">{{ 'notif.readAll' | t }}</button>
                  }
                </div>
                <ul>
                  @for (n of notifs.items().slice(0, 6); track n.id) {
                    <li>
                      <button type="button" [class.unread]="!n.read" (click)="openNotif(n); np.hide()">
                        <i class="fa-solid {{ icon[n.type] }}"></i>
                        <span>
                          <span class="msg">{{ n.message }}</span>
                          <small>{{ n.createdAt | date: 'd MMM, HH:mm' }}</small>
                        </span>
                      </button>
                    </li>
                  } @empty {
                    <li class="empty">{{ 'notif.empty' | t }}</li>
                  }
                </ul>
                <a class="np-all" routerLink="/admin/notifications" (click)="np.hide()">{{ 'notif.all' | t }}</a>
              </div>
            </p-popover>
          </div>
        </div>
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
    .admin { display: grid; min-height: 100dvh; background: var(--surface-2); }
    @media (min-width: 1000px) { .admin { grid-template-columns: 260px 1fr; } }
    .side { display: none; flex-direction: column; background: #2b1508; color: #e9d5bd; background-image: var(--pattern-bogolan); }
    @media (min-width: 1000px) { .side { display: flex; position: sticky; top: 0; height: 100dvh; } }
    .open .side { display: flex; position: fixed; inset: 0 auto 0 0; width: 270px; z-index: 300; }
    .side-head { padding: 20px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid rgb(255 255 255 / 0.08); }
    .side-head ::ng-deep .name { color: #fff !important; }
    .role { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--y-ochre); }
    nav { display: flex; flex-direction: column; gap: 2px; padding: 14px 10px; flex: 1; }
    nav a { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 6px; font-weight: 600; font-size: 0.92rem; color: #e9d5bd; }
    nav a i { width: 18px; text-align: center; color: #c9a882; }
    nav a:hover { background: rgb(255 255 255 / 0.06); color: #fff; }
    nav a.on { background: var(--y-ochre); color: #1e1611; }
    nav a.on i { color: #1e1611; }
    .pill { margin-left: auto; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; display: grid; place-items: center; background: var(--y-flag-red); color: #fff; font-size: 0.72rem; font-weight: 800; }
    .side-foot { padding: 14px; border-top: 1px solid rgb(255 255 255 / 0.08); display: grid; gap: 12px; font-size: 0.86rem; }
    .side-foot a, .side-foot button { display: flex; align-items: center; gap: 10px; color: #c9a882; background: none; border: 0; cursor: pointer; padding: 0; font: inherit; }
    .side-foot button.logout { color: #ff8a7a; font-weight: 700; } .side-foot button.logout:hover { color: #fff; }
    .me { display: flex; align-items: center; gap: 10px; }
    .me span:last-child { display: flex; flex-direction: column; min-width: 0; }
    .me strong { color: #fff; }
    .me small { color: #c9a882; overflow: hidden; text-overflow: ellipsis; }
    .av { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--y-ochre); color: #1e1611; font-weight: 800; }
    .main { min-width: 0; padding: 20px clamp(16px, 3vw, 36px) 48px; }
    .topline { display: flex; align-items: center; gap: 12px; min-height: 8px; }
    .burger { width: 40px; height: 40px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; }
    @media (min-width: 1000px) { .burger { display: none; } }
    .tools { margin-left: auto; display: flex; align-items: center; gap: 8px; }
    .langs { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
    .langs button { padding: 7px 10px; border: 0; background: var(--surface); color: var(--text-2); font-weight: 800; font-size: 0.78rem; cursor: pointer; }
    .langs button.on { background: var(--y-red); color: #fff; }
    .tool { position: relative; width: 40px; height: 40px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; }
    .tool:hover { color: var(--y-red); }
    .badge { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; display: grid; place-items: center; background: var(--y-red); color: #fff; font-size: 0.7rem; font-weight: 800; }
    .np { width: min(360px, 86vw); }
    .np-head { display: flex; justify-content: space-between; align-items: center; padding: 4px 4px 10px; border-bottom: 1px solid var(--border); }
    .np .link { border: 0; background: none; color: var(--y-red); font-weight: 700; cursor: pointer; font-size: 0.82rem; }
    .np ul { list-style: none; margin: 0; padding: 6px 0; max-height: 360px; overflow: auto; }
    .np li button { width: 100%; display: flex; gap: 10px; align-items: flex-start; padding: 10px 6px; border: 0; border-radius: 6px; background: none; text-align: left; cursor: pointer; font: inherit; color: var(--text-2); font-size: 0.88rem; }
    .np li button:hover { background: var(--surface-2); }
    .np li button.unread { color: var(--text); font-weight: 600; }
    .np li button i { margin-top: 3px; color: var(--y-red); }
    .np li button > span { display: flex; flex-direction: column; gap: 2px; }
    .np small { color: var(--text-3); font-weight: 500; }
    .np .empty { padding: 16px 6px; color: var(--text-3); font-size: 0.88rem; }
    .np-all { display: block; padding-top: 10px; border-top: 1px solid var(--border); text-align: center; font-weight: 700; color: var(--y-red); font-size: 0.86rem; }
    .warn { padding: 6px 12px; border-radius: 6px; background: var(--y-yellow-soft); color: var(--y-yellow-ink); font-weight: 700; font-size: 0.85rem; }
  `,
})
export class AdminLayout {
  readonly auth = inject(AuthService);
  readonly data = inject(DataService);
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);
  readonly notifs = inject(NotificationsService);
  private router = inject(Router);
  readonly icon = NOTIF_ICON;
  readonly open = signal(false);
  readonly pending = computed(() => this.notifs.items().filter((n) => !n.read && n.type === 'NEW_CONTRIBUTION').length);
  readonly links = [
    { path: '/admin', key: 'admin.nav.overview', icon: 'fa-chart-line', exact: true },
    { path: '/admin/contributions', key: 'admin.nav.contributions', icon: 'fa-inbox', exact: false },
    { path: '/admin/contes', key: 'admin.nav.tales', icon: 'fa-book-open', exact: false },
    { path: '/admin/commentaires', key: 'admin.nav.comments', icon: 'fa-comments', exact: false },
    { path: '/admin/utilisateurs', key: 'admin.nav.users', icon: 'fa-users', exact: false },
    { path: '/admin/notifications', key: 'notif.title', icon: 'fa-bell', exact: false },
  ];

  /** Une notification ouvre la page d'administration concernée, sinon la liste des notifications. */
  openNotif(n: AppNotification) {
    void this.notifs.markOne(n.id);
    void this.router.navigateByUrl(n.link?.startsWith('/admin') ? n.link : '/admin/notifications');
  }
}
