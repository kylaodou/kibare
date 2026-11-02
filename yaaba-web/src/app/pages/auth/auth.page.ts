import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { TranslatePipe } from '../../core/i18n.service';
import { GoogleButtonComponent } from '../../shared/google-button/google-button.component';
import { Art } from '../../core/models';

/** Connexion et inscription sur une même page, avec bascule. */
@Component({
  selector: 'app-auth',
  imports: [FormsModule, RouterLink, SelectModule, TranslatePipe, GoogleButtonComponent],
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss',
})
export class AuthPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(MessageService);
  readonly data = inject(DataService);
  readonly retour = input<string>();

  readonly mode = signal<'login' | 'register'>(inject(ActivatedRoute).snapshot.data['mode'] ?? 'login');
  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly region = signal<string | null>(null);
  readonly language = signal<string | null>(null);
  readonly showPass = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly regionOptions = computed(() => this.data.regions().map((r) => ({ label: r.name, value: r.code })));
  readonly langOptions = computed(() => this.data.languages().map((l) => ({ label: l.name, value: l.code })));
  readonly strength = computed(() => {
    const p = this.password();
    return (p.length >= 8 ? 1 : 0) + (/[A-Z]/.test(p) ? 1 : 0) + (/[0-9]/.test(p) ? 1 : 0) + (/[^A-Za-z0-9]/.test(p) ? 1 : 0);
  });
  readonly valid = computed(() => {
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email());
    if (this.mode() === 'login') return emailOk && this.password().length > 0;
    const p = this.password();
    return emailOk && this.name().trim().length >= 2 && p.length >= 8 && p.length <= 100 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);
  });

  readonly art: Art = {
    sky: 'night',
    ground: 'village',
    items: [
      { k: 'moon', x: 80, y: 300 },
      { k: 'baobab', x: 20, y: 28 },
      { k: 'hut', x: 78, y: 30, s: 0.85 },
      { k: 'fire', x: 50 },
      { k: 'yaaba-sit', x: 36 },
      { k: 'child-sit', x: 62, flip: true },
      { k: 'child-sit', x: 68, flip: true, c: '#C9822B' },
    ],
  };

  switch(m: 'login' | 'register') {
    this.mode.set(m);
    this.error.set('');
    void this.router.navigate([m === 'login' ? '/connexion' : '/inscription'], { queryParamsHandling: 'preserve', replaceUrl: true });
  }

  async google(credential: string) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const created = await this.auth.loginWithGoogle(credential);
      const email = this.auth.user()?.email;
      if (created === null) this.toast.add({ severity: 'success', summary: 'Connexion réussie', detail: `Connecté avec Google : ${email}`, life: 4000 });
      else
        this.toast.add({
          severity: created ? 'success' : 'warn',
          summary: 'Bienvenue sur KIBARE !',
          detail: created
            ? `Votre compte est créé. Un e-mail de bienvenue a été envoyé à ${email} pour choisir votre mot de passe.`
            : 'Votre compte est créé, mais l’e-mail de bienvenue n’a pas pu partir. Choisissez votre mot de passe depuis « Mon compte ».',
          life: 8000,
        });
      void this.router.navigateByUrl(this.retour() || (this.auth.isAdmin() ? '/admin' : '/compte'));
    } catch (e) {
      this.error.set(AuthService.message(e, 'Connexion avec Google impossible'));
    } finally {
      this.busy.set(false);
    }
  }

  async submit() {
    if (!this.valid() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.mode() === 'login') await this.auth.login(this.email().trim(), this.password());
      else {
        const sent = await this.auth.register({
          name: this.name().trim(),
          email: this.email().trim().toLowerCase(),
          password: this.password(),
          region: this.region() ?? undefined,
          language: this.language() ?? undefined,
        });
        this.toast.add(
          sent
            ? { severity: 'success', summary: 'Bienvenue sur KIBARE !', detail: `Un lien de confirmation a été envoyé à ${this.email().trim()}. Ouvrez-le pour pouvoir contribuer.`, life: 8000 }
            : { severity: 'warn', summary: 'Compte créé', detail: 'L’e-mail de confirmation n’a pas pu être envoyé. Vous pourrez le renvoyer depuis « Mon compte ».', life: 8000 },
        );
      }
      const target = this.retour() || (this.auth.isAdmin() ? '/admin' : this.mode() === 'register' ? '/contribuer' : '/compte');
      void this.router.navigateByUrl(target);
    } catch (e) {
      this.error.set(AuthService.message(e, this.mode() === 'login' ? 'Connexion impossible' : 'Inscription impossible'));
    } finally {
      this.busy.set(false);
    }
  }
}
