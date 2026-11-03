import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth.service';

type Step = 'email' | 'code' | 'password';

/** Mot de passe oublié, en trois étapes : adresse e-mail → code à 6 chiffres (valable 5 minutes) → nouveau mot de passe. */
@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="auth">
      <div class="visual">
        <a routerLink="/" class="logo-link"><img src="brand/kibare-logo.png" alt="KIBARE" height="223" /></a>
      </div>

      <div class="panel">
        <ol class="steps" aria-hidden="true">
          <li [class.on]="true"></li>
          <li [class.on]="step() !== 'email'"></li>
          <li [class.on]="step() === 'password'"></li>
        </ol>

        @switch (step()) {
          @case ('email') {
            <h1>Mot de passe oublié</h1>
            <p class="muted">Indiquez l’adresse de votre compte : nous vous enverrons un code à 6 chiffres, valable 5 minutes.</p>
            <form (ngSubmit)="request()" novalidate>
              <label class="field">
                <span>Adresse e-mail</span>
                <input type="email" name="email" [ngModel]="email()" (ngModelChange)="email.set($event); error.set('')" autocomplete="email" required autofocus />
              </label>
              @if (error()) {
                <p class="error" role="alert"><i class="fa-solid fa-circle-exclamation"></i> {{ error() }}</p>
              }
              <button type="submit" class="btn submit" [disabled]="!emailOk() || busy()">
                @if (busy()) {
                  <i class="fa-solid fa-spinner fa-spin"></i>
                }
                Recevoir le code
              </button>
            </form>
          }
          @case ('code') {
            <h1>Saisissez le code</h1>
            <p class="info" role="status"><i class="fa-solid fa-envelope-open-text"></i> {{ notice() }}</p>
            <form (ngSubmit)="verify()" novalidate>
              <label class="field">
                <span>Code reçu par e-mail</span>
                <input class="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"
                  [ngModel]="code()" (ngModelChange)="code.set(onlyDigits($event)); error.set('')" required autofocus />
                <small>
                  @if (remaining() > 0) {
                    Code valable encore {{ clock() }}.
                  } @else {
                    Le code a expiré : demandez-en un nouveau.
                  }
                </small>
              </label>
              @if (error()) {
                <p class="error" role="alert"><i class="fa-solid fa-circle-exclamation"></i> {{ error() }}</p>
              }
              <button type="submit" class="btn submit" [disabled]="code().length !== 6 || busy()">
                @if (busy()) {
                  <i class="fa-solid fa-spinner fa-spin"></i>
                }
                Vérifier le code
              </button>
            </form>
            <p class="switch">
              Rien reçu ? Vérifiez vos courriers indésirables ou
              <button type="button" class="link-btn" (click)="request(true)" [disabled]="busy() || cooldown() > 0">
                {{ cooldown() > 0 ? 'renvoyer dans ' + cooldown() + ' s' : 'renvoyer un code' }}
              </button>
            </p>
          }
          @case ('password') {
            <h1>{{ setup() ? 'Choisissez votre mot de passe' : 'Nouveau mot de passe' }}</h1>
            <p class="muted">Choisissez un mot de passe d’au moins 8 caractères, avec au moins une lettre et un chiffre.</p>
            <form (ngSubmit)="reset()" novalidate>
              <label class="field">
                <span>Nouveau mot de passe</span>
                <span class="pass">
                  <input [type]="show() ? 'text' : 'password'" name="password" [ngModel]="password()" (ngModelChange)="password.set($event); error.set('')"
                    autocomplete="new-password" minlength="8" maxlength="100" required autofocus />
                  <button type="button" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'">
                    <i class="fa-regular" [class.fa-eye]="!show()" [class.fa-eye-slash]="show()"></i>
                  </button>
                </span>
                <span class="strength" [attr.data-level]="strength()"><span></span><span></span><span></span><span></span></span>
              </label>
              <label class="field">
                <span>Confirmation</span>
                <input [type]="show() ? 'text' : 'password'" name="confirm" [ngModel]="confirm()" (ngModelChange)="confirm.set($event); error.set('')"
                  autocomplete="new-password" required />
                @if (confirm() && confirm() !== password()) {
                  <small class="bad">Les deux mots de passe ne correspondent pas.</small>
                }
              </label>
              @if (error()) {
                <p class="error" role="alert"><i class="fa-solid fa-circle-exclamation"></i> {{ error() }}</p>
              }
              <button type="submit" class="btn submit" [disabled]="!passOk() || busy()">
                @if (busy()) {
                  <i class="fa-solid fa-spinner fa-spin"></i>
                }
                Enregistrer le mot de passe
              </button>
            </form>
          }
        }

        <p class="switch"><a routerLink="/connexion"><i class="fa-solid fa-arrow-left"></i> Retour à la connexion</a></p>
      </div>
    </section>
  `,
  styleUrl: './auth.page.scss',
  styles: `.bad { color: var(--y-flag-red, #b3261e) !important; font-weight: 600; }`,
})
export class ForgotPasswordPage {
  readonly auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(MessageService);

  /** ?email=… depuis la page de connexion */
  readonly emailParam = input<string>('', { alias: 'email' });
  /** lien de bienvenue (inscription avec Google) : /definir-mot-de-passe?jeton=… */
  readonly jeton = input<string>('');
  readonly setup = signal(false);

  readonly step = signal<Step>('email');
  readonly email = signal('');
  readonly code = signal('');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly show = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly remaining = signal(0);
  readonly cooldown = signal(0);
  private resetToken = '';
  private timer?: number;

  readonly emailOk = computed(() => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email().trim()));
  readonly passOk = computed(() => {
    const p = this.password();
    return p.length >= 8 && p.length <= 100 && /[A-Za-z]/.test(p) && /[0-9]/.test(p) && p === this.confirm();
  });
  readonly strength = computed(() => {
    const p = this.password();
    return (p.length >= 8 ? 1 : 0) + (/[A-Z]/.test(p) ? 1 : 0) + (/[0-9]/.test(p) ? 1 : 0) + (/[^A-Za-z0-9]/.test(p) ? 1 : 0);
  });

  constructor() {
    queueMicrotask(() => {
      if (this.emailParam()) this.email.set(this.emailParam());
      if (this.jeton()) {
        this.resetToken = this.jeton();
        this.setup.set(true);
        this.step.set('password');
      }
    });
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  clock() {
    const s = this.remaining();
    return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  }

  onlyDigits(v: string) {
    return (v ?? '').replace(/\D/g, '').slice(0, 6);
  }

  /** Étape 1 : la réponse est identique que le compte existe ou non. */
  async request(again = false) {
    if (!this.emailOk() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.auth.forgotPassword(this.email().trim().toLowerCase());
      this.notice.set(r.message);
      this.code.set('');
      this.step.set('code');
      this.startTimers();
      if (again) this.toast.add({ severity: 'info', summary: 'Nouveau code demandé', detail: 'L’ancien code n’est plus valable.', life: 3500 });
    } catch (e) {
      this.error.set(AuthService.message(e, 'La demande n’a pas pu être envoyée. Réessayez plus tard.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Étape 2 : code correct, non expiré, non utilisé (5 essais au plus). */
  async verify() {
    if (this.code().length !== 6 || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.auth.verifyResetCode(this.email().trim().toLowerCase(), this.code());
      this.resetToken = r.resetToken;
      this.step.set('password');
      clearInterval(this.timer);
    } catch (e) {
      this.error.set(AuthService.message(e, 'Code invalide ou expiré'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Étape 3 : nouveau mot de passe, puis retour à la connexion. */
  async reset() {
    if (!this.passOk() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.resetPassword(this.resetToken, this.password());
      this.resetToken = '';
      this.toast.add({
        severity: 'success',
        summary: this.setup() ? 'Mot de passe enregistré' : 'Mot de passe modifié',
        detail: this.auth.loggedIn() ? 'Vous pourrez aussi vous connecter avec votre e-mail et ce mot de passe.' : 'Connectez-vous avec votre nouveau mot de passe.',
        life: 5000,
      });
      if (this.auth.loggedIn()) void this.auth.refresh();
      void this.router.navigate([this.auth.loggedIn() ? '/compte' : '/connexion'], { replaceUrl: true });
    } catch (e) {
      this.error.set(AuthService.message(e, 'Le mot de passe n’a pas pu être modifié'));
      if (this.setup()) this.error.update((m) => m + ' Vous pouvez demander un nouveau lien avec « Mot de passe oublié ».');
    } finally {
      this.busy.set(false);
    }
  }

  private startTimers() {
    clearInterval(this.timer);
    this.remaining.set(5 * 60);
    this.cooldown.set(60);
    this.timer = window.setInterval(() => {
      this.remaining.update((s) => Math.max(0, s - 1));
      this.cooldown.update((s) => Math.max(0, s - 1));
    }, 1000);
  }
}
