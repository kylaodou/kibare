import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { TranslatePipe } from './core/i18n.service';
import { FooterComponent } from './layout/footer.component';
import { HeaderComponent } from './layout/header.component';
import { TourComponent } from './shared/tour/tour.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, ToastModule, TourComponent, TranslatePipe],
  template: `
    <a class="skip-link" href="#main">{{ 'a11y.skip' | t }}</a>
    <!-- le tableau de bord est autonome : pas de menu ni de pied de page du site public -->
    @if (!admin()) {
      <app-header />
    }
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    @if (!admin()) {
      <app-footer />
    }
    <p-toast position="top-right" />
    <app-tour />
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100dvh; }
    main { flex: 1; outline: none; }
  `,
})
export class App {
  private router = inject(Router);
  private url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly admin = computed(() => this.url().startsWith('/admin'));
}
