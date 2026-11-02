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
  readonly resending = signal(false);
  /* mot de passe */
  readonly curPass = signal('');
  readonly newPass = signal('');
  readonly newPass2 = signal('');
  readonly showPass = signal(false);
  readonly passBusy = signal(false);
  readonly passError = signal('');
  readonly passOk = computed(() => {
    const p = this.newPass();
    const needCurrent = this.auth.user()?.hasPassword !== false;
    return p.length >= 8 && /[A-Za-z]/.test(p) && /[0-9]/.test(p) && p === this.newPass2() && (!needCurrent || this.curPass().length > 0);
  });

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
    void this.auth.refresh(); // statut de vérification de l'adresse et du mot de passe à jour
    if (location.hash === '#mot-de-passe') this.tab.set('profile');
  }

  /** Définit (compte Google) ou change le mot de passe. */
  async savePassword() {
    if (!this.passOk() || this.passBusy()) return;
    const first = this.auth.user()?.hasPassword === false;
    this.passBusy.set(true);
    this.passError.set('');
    try {
      await this.auth.changePassword(first ? null : this.curPass(), this.newPass());
      this.curPass.set('');
      this.newPass.set('');
      this.newPass2.set('');
      this.toast.add({
        severity: 'success',
        summary: first ? 'Mot de passe enregistré' : 'Mot de passe modifié',
        detail: first ? 'Vous pouvez maintenant vous connecter aussi avec votre e-mail et ce mot de passe.' : undefined,
        life: 4500,
      });
    } catch (e) {
      this.passError.set(AuthService.message(e, 'Le mot de passe n’a pas pu être enregistré'));
    } finally {
      this.passBusy.set(false);
    }
  }

  /** Renvoie le lien de confirmation de l'adresse e-mail. */
  async resend() {
    if (this.resending()) return;
    this.resending.set(true);
    try {
      const r = await this.auth.resendVerification();
      this.toast.add({ severity: 'success', summary: 'E-mail envoyé', detail: r.message, life: 6000 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: 'Envoi impossible', detail: AuthService.message(e, 'Réessayez plus tard.'), life: 6000 });
    } finally {
      this.resending.set(false);
    }
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
