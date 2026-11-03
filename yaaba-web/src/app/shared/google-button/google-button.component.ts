import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, NgZone, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface GoogleId {
  accounts: {
    id: {
      initialize(o: Record<string, unknown>): void;
      renderButton(el: HTMLElement, o: Record<string, unknown>): void;
    };
  };
}

let script: Promise<void> | null = null;

/** Charge une seule fois la bibliothèque Google Identity Services. */
function loadGis(): Promise<void> {
  script ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      script = null;
      reject(new Error('gsi'));
    };
    document.head.appendChild(s);
  });
  return script;
}

/** Bouton « Continuer avec Google » (Google Identity Services, gratuit). */
@Component({
  selector: 'app-google-button',
  template: `
    @if (enabled()) {
      <div class="or" aria-hidden="true"><span>ou</span></div>
      @if (mode() === 'register') {
        <p class="cap"><i class="fa-brands fa-google"></i> Inscrivez-vous en un clic avec votre compte Google : votre compte KIBARE est créé automatiquement.</p>
      }
      <div class="g" #host></div>
      @if (failed()) {
        <small class="err">Le service Google est momentanément indisponible.</small>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .or { display: flex; align-items: center; gap: 12px; margin: 18px 0 14px; color: var(--text-3); font-size: 0.82rem; }
    .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .g { display: flex; justify-content: center; min-height: 44px; }
    .cap { margin: 0 0 10px; text-align: center; font-size: 0.86rem; color: var(--text-2); }
    .cap i { color: var(--y-red); margin-right: 4px; }
    .err { display: block; text-align: center; color: var(--text-3); margin-top: 6px; }
  `,
})
export class GoogleButtonComponent {
  /** connexion ou inscription : change le libellé du bouton (« Continuer avec » / « S'inscrire avec » Google) */
  readonly mode = input<'login' | 'register'>('login');
  readonly credential = output<string>();
  readonly enabled = signal(false);
  readonly failed = signal(false);
  private host = viewChild<ElementRef<HTMLElement>>('host');
  private http = inject(HttpClient);
  private zone = inject(NgZone);
  /** bibliothèque Google prête et initialisée */
  private gis = signal<GoogleId | null>(null);

  constructor() {
    void this.init();
    // le bouton est dessiné dès que le conteneur existe ET que Google est prêt (quel que soit l'ordre)
    effect(() => {
      const el = this.host()?.nativeElement;
      const g = this.gis();
      if (!el || !g) return;
      const width = Math.min(400, Math.max(220, el.clientWidth || 320));
      g.accounts.id.renderButton(el, {
        theme: 'outline', size: 'large', text: this.mode() === 'register' ? 'signup_with' : 'continue_with',
        shape: 'rectangular', locale: 'fr', width,
      });
    });
  }

  private async init() {
    try {
      const c = await firstValueFrom(this.http.get<{ enabled: boolean; clientId?: string }>(`${environment.apiUrl}/auth/google/config`));
      if (!c.enabled || !c.clientId) return;
      this.enabled.set(true);
      await loadGis();
      const g = (window as unknown as { google: GoogleId }).google;
      const signup = this.mode() === 'register';
      g.accounts.id.initialize({
        client_id: c.clientId,
        context: signup ? 'signup' : 'signin',
        // FedCM : fenêtre de connexion native du navigateur, sans fenêtre pop-up (souvent bloquée)
        use_fedcm_for_button: true,
        use_fedcm_for_prompt: true,
        itp_support: true,
        callback: (r: { credential: string }) => this.zone.run(() => this.credential.emit(r.credential)),
      });
      this.gis.set(g);
    } catch {
      if (this.enabled()) this.failed.set(true);
    }
  }
}
