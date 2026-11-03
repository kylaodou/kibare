import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { DrawerModule } from 'primeng/drawer';
import { PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import { AmbienceService } from '../core/ambience.service';
import { AuthService } from '../core/auth.service';
import { I18nService, TranslatePipe } from '../core/i18n.service';
import { AppNotification, NOTIF_ICON, NotificationsService } from '../core/notifications.service';
import { ProgressService } from '../core/progress.service';
import { ThemeService } from '../core/theme.service';
import { LogoComponent } from '../shared/logo/logo.component';

export const NAV = [
  { path: '/', key: 'nav.home', icon: 'fa-house', exact: true },
  { path: '/carte', key: 'nav.map', icon: 'fa-map-location-dot', exact: false },
  { path: '/veillee', key: 'nav.veillee', icon: 'fa-fire', exact: false },
  { path: '/contes', key: 'nav.library', icon: 'fa-book-open', exact: false },
  { path: '/langues', key: 'nav.languages', icon: 'fa-language', exact: false },
  { path: '/contributeurs', key: 'nav.contributors', icon: 'fa-people-group', exact: false },
  { path: '/a-propos', key: 'nav.about', icon: 'fa-circle-info', exact: false },
];

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, LogoComponent, TranslatePipe, DrawerModule, TooltipModule, PopoverModule, DatePipe],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly i18n = inject(I18nService);
  readonly theme = inject(ThemeService);
  readonly ambience = inject(AmbienceService);
  readonly auth = inject(AuthService);
  readonly notifs = inject(NotificationsService);
  readonly progress = inject(ProgressService);
  private router = inject(Router);
  readonly nav = NAV;
  readonly menu = signal(false);
  readonly icon = NOTIF_ICON;

  open(n: AppNotification, close: () => void) {
    void this.notifs.markOne(n.id);
    close();
    if (n.link) void this.router.navigateByUrl(n.link);
  }

  initials(name: string) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }
}
