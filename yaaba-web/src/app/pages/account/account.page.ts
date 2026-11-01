import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { Contribution } from '../../core/models';
import { AppNotification, NOTIF_ICON, NotificationsService } from '../../core/notifications.service';
import { ProgressService } from '../../core/progress.service';
import { taleText } from '../../shared/tale-card/tale-card.component';

type Tab = 'contributions' | 'notifications' | 'profile';

@Component({
  selector: 'app-account',
  imports: [FormsModule, RouterLink, SelectModule, DatePipe, TranslatePipe],
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss',
})
export class AccountPage {
  readonly auth = inject(AuthService);
  readonly data = inject(DataService);
  readonly notifs = inject(NotificationsService);
  readonly progress = inject(ProgressService);
  private i18n = inject(I18nService);
  private toast = inject(MessageService);
  private router = inject(Router);

  readonly tab = signal<Tab>(location.hash === '#notifications' ? 'notifications' : 'contributions');
  readonly contributions = signal<Contribution[]>([]);
  readonly loading = signal(true);
  readonly icon = NOTIF_ICON;

  readonly name = signal(this.auth.user()?.name ?? '');
  readonly region = signal<string | null>(this.auth.user()?.region ?? null);
  readonly language = signal<string | null>(this.auth.user()?.language ?? null);
  readonly bio = signal(this.auth.user()?.bio ?? '');
  readonly saving = signal(false);

  readonly counts = computed(() => {
    const l = this.contributions();
    return {
      total: l.length,
      pending: l.filter((c) => c.status === 'PENDING').length,
      approved: l.filter((c) => c.status === 'APPROVED').length,
    };
  });
  readonly regionOptions = computed(() => this.data.regions().map((r) => ({ label: r.name, value: r.code })));
  readonly langOptions = computed(() => this.data.languages().map((l) => ({ label: l.name, value: l.code })));

  constructor() {
    this.data.myContributions().subscribe((l) => {
      this.contributions.set(l);
      this.loading.set(false);
    });
    void this.notifs.poll(true);
  }

  taleTitle(c: Contribution) {
    const slug = c.publishedSlug ?? c.taleSlug;
    const t = slug ? this.data.tale(slug) : undefined;
    return t ? taleText(t, this.i18n.lang()).title : c.title;
  }

  link(c: Contribution) {
    const slug = c.status === 'APPROVED' ? (c.publishedSlug ?? c.taleSlug) : null;
    return slug ? ['/contes', slug] : null;
  }

  openNotif(n: AppNotification) {
    void this.notifs.markOne(n.id);
    if (n.link) void this.router.navigateByUrl(n.link);
  }

  async save() {
    this.saving.set(true);
    try {
      await this.auth.updateProfile({
        name: this.name().trim(),
        region: this.region() ?? undefined,
        language: this.language() ?? undefined,
        bio: this.bio().trim() || undefined,
      });
      this.toast.add({ severity: 'success', summary: this.i18n.t('account.saved'), life: 2500 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: AuthService.message(e, this.i18n.t('admin.error')), life: 4000 });
    } finally {
      this.saving.set(false);
    }
  }
}
