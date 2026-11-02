import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/** Confirmation de l'adresse e-mail à partir du lien reçu à l'inscription (?jeton=…). */
@Component({
  selector: 'app-verify-email',
  imports: [RouterLink],
  template: `
    <section class="auth">
      <div class="visual">
        <a routerLink="/" class="logo-link"><img src="brand/kibare-logo.png" alt="KIBARE" height="223" /></a>
      </div>
      <div class="panel" aria-live="polite">
        @switch (state()) {
          @case ('pending') {
            <h1><i class="fa-solid fa-spinner fa-spin"></i> Vérification en cours…</h1>
          }
          @case ('ok') {
            <h1><i class="fa-solid fa-circle-check ok"></i> Adresse confirmée</h1>
            <p class="muted">Merci ! Votre adresse e-mail est vérifiée : vous pouvez maintenant prêter votre voix et partager vos récits.</p>
            <a class="btn submit" [routerLink]="auth.loggedIn() ? '/contribuer' : '/connexion'">{{ auth.loggedIn() ? 'Contribuer' : 'Se connecter' }}</a>
          }
          @case ('error') {
            <h1><i class="fa-solid fa-circle-exclamation bad"></i> Lien invalide</h1>
            <p class="error" role="alert">{{ message() }}</p>
            <p class="muted">Depuis « Mon compte », vous pouvez demander un nouveau lien de confirmation.</p>
            <a class="btn submit" [routerLink]="auth.loggedIn() ? '/compte' : '/connexion'">{{ auth.loggedIn() ? 'Mon compte' : 'Se connecter' }}</a>
          }
        }
      </div>
    </section>
  `,
  styleUrl: './auth.page.scss',
  styles: `.ok { color: var(--y-ochre); } .bad { color: var(--y-flag-red, #b3261e); } h1 i { margin-right: 8px; }`,
})
export class VerifyEmailPage {
  readonly auth = inject(AuthService);
  readonly jeton = input<string>('');
  readonly state = signal<'pending' | 'ok' | 'error'>('pending');
  readonly message = signal('');

  constructor() {
    queueMicrotask(async () => {
      const token = this.jeton();
      if (!token) {
        this.message.set('Le lien ne contient pas de jeton de vérification.');
        this.state.set('error');
        return;
      }
      try {
        await this.auth.verifyEmail(token);
        this.state.set('ok');
      } catch (e) {
        this.message.set(AuthService.message(e, 'Ce lien de vérification est invalide ou a expiré.'));
        this.state.set('error');
      }
    });
  }
}
