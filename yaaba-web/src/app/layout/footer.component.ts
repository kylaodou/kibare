import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { TranslatePipe } from '../core/i18n.service';
import { LogoComponent } from '../shared/logo/logo.component';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, LogoComponent, TranslatePipe],
  template: `
    @if (visible()) {
      <footer class="bogolan">
        <div class="band-danfani"></div>
        <div class="container grid">
          <div class="about">
            <app-logo [size]="40" [tagline]="'brand.tagline' | t" />
            <p>{{ 'footer.mission' | t }}</p>
          </div>
          <div>
            <h4>{{ 'footer.explore' | t }}</h4>
            <a routerLink="/carte">{{ 'nav.map' | t }}</a>
            <a routerLink="/contes">{{ 'nav.library' | t }}</a>
            <a routerLink="/langues">{{ 'nav.languages' | t }}</a>
            <a routerLink="/passeport">{{ 'nav.passport' | t }}</a>
          </div>
          <div>
            <h4>{{ 'footer.participate' | t }}</h4>
            <a routerLink="/contribuer">{{ 'nav.contribute' | t }}</a>
            <a routerLink="/contributeurs">{{ 'nav.contributors' | t }}</a>
            <a routerLink="/a-propos">{{ 'nav.about' | t }}</a>
            <a routerLink="/admin">{{ 'footer.admin' | t }}</a>
          </div>
        </div>
        <div class="container bottom">
          <span>© {{ year }} KIBARE</span>
        </div>
      </footer>
    }
  `,
  styles: `
    footer {
      margin-top: 40px;
      font-size: 0.92rem;
    }
    .band-danfani { margin-bottom: 56px; }
    .about app-logo {
      display: inline-block;
      padding: 10px 14px;
      background: #fff;
      border-radius: var(--radius);
    }
    .grid {
      display: grid;
      gap: 36px;
      grid-template-columns: 1fr;
    }
    @media (min-width: 768px) {
      .grid { grid-template-columns: 2fr 1fr 1fr; }
    }
    .about p { margin: 18px 0; max-width: 40ch; }
    h4 {
      font-family: var(--font-body);
      font-size: 0.78rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--y-ochre);
      margin-bottom: 14px;
    }
    a { display: block; padding: 4px 0; color: #fbebd0; transition: color 0.2s; }
    a:hover { color: var(--y-ochre); }
    .bottom {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      margin-top: 44px;
      padding-block: 22px;
      border-top: 1px solid rgb(255 255 255 / 0.15);
      font-size: 0.82rem;
      color: #d9c2a5;
    }
  `,
})
export class FooterComponent {
  private router = inject(Router);
  readonly year = new Date().getFullYear();
  private url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly visible = computed(() => !this.url().startsWith('/carte') && !this.url().startsWith('/admin'));
}
