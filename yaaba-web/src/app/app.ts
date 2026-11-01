import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
    <app-header />
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <app-footer />
    <p-toast position="bottom-right" />
    <app-tour />
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100dvh; }
    main { flex: 1; outline: none; }
  `,
})
export class App {}
