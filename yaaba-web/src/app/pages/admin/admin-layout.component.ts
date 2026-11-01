import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { TranslatePipe } from '../../core/i18n.service';
import { NotificationsService } from '../../core/notifications.service';
import { LogoComponent } from '../../shared/logo/logo.component';

/** Coque du back-office : barre latérale, rappel des demandes en attente, contenu. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoComponent, TranslatePipe],
  template: `
    <div class="admin" [class.open]="open()">
      <aside class="side">
        <div class="side-head">
          <app-logo [size]="34" />
          <span class="role">{{ 'admin.eyebrow' | t }}</span>
        </div>
        <nav>
          @for (l of links; track l.path) {
            <a [routerLink]="l.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: l.exact }" (click)="open.set(false)">
              <i class="fa-solid {{ l.icon }}"></i>
              <span>{{ l.key | t }}</span>
              @if (l.path === 'contributions' && pending()) {
                <span class="pill">{{ pending() }}</span>
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
          <button type="button" (click)="auth.logout()"><i class="fa-solid fa-right-from-bracket"></i> {{ 'nav.logout' | t }}</button>
        </div>
      </aside>
      <div class="main">
        <div class="topline">
          <button type="button" class="burger" (click)="open.set(!open())" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
          @if (!data.online()) {
            <span class="warn"><i class="fa-solid fa-plug-circle-xmark"></i> {{ 'admin.noServer' | t }}</span>
          }
        </div>
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
    .admin { display: grid; min-height: calc(100dvh - var(--header-h) - 1px); background: var(--surface-2); }
    @media (min-width: 1000px) { .admin { grid-template-columns: 260px 1fr; } }
    .side { display: none; flex-direction: column; background: #2b1508; color: #e9d5bd; background-image: var(--pattern-bogolan); }
    @media (min-width: 1000px) { .side { display: flex; position: sticky; top: calc(var(--header-h) + 1px); height: calc(100dvh - var(--header-h) - 1px); } }
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
    .me { display: flex; align-items: center; gap: 10px; }
    .me span:last-child { display: flex; flex-direction: column; min-width: 0; }
    .me strong { color: #fff; }
    .me small { color: #c9a882; overflow: hidden; text-overflow: ellipsis; }
    .av { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--y-ochre); color: #1e1611; font-weight: 800; }
    .main { min-width: 0; padding: 20px clamp(16px, 3vw, 36px) 48px; }
    .topline { display: flex; align-items: center; gap: 12px; min-height: 8px; }
    .burger { width: 40px; height: 40px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; }
    @media (min-width: 1000px) { .burger { display: none; } }
    .warn { padding: 6px 12px; border-radius: 6px; background: var(--y-yellow-soft); color: var(--y-yellow-ink); font-weight: 700; font-size: 0.85rem; }
  `,
})
export class AdminLayout {
  readonly auth = inject(AuthService);
  readonly data = inject(DataService);
  private notifs = inject(NotificationsService);
  readonly open = signal(false);
  readonly pending = computed(() => this.notifs.items().filter((n) => !n.read && n.type === 'NEW_CONTRIBUTION').length);
  readonly links = [
    { path: '', key: 'admin.nav.overview', icon: 'fa-chart-line', exact: true },
    { path: 'contributions', key: 'admin.nav.contributions', icon: 'fa-inbox', exact: false },
    { path: 'contes', key: 'admin.nav.tales', icon: 'fa-book-open', exact: false },
    { path: 'commentaires', key: 'admin.nav.comments', icon: 'fa-comments', exact: false },
    { path: 'utilisateurs', key: 'admin.nav.users', icon: 'fa-users', exact: false },
  ];
}
