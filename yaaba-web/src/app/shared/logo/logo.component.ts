import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Logo KIBARE (« histoire » en mooré) : la carte du Burkina, un conteur et un livre ouvert. */
@Component({
  selector: 'app-logo',
  template: `
    @if (variant() === 'full') {
      <img src="brand/kibare-logo.webp" alt="KIBARE" width="180" height="123">
    } @else {
      <img class="mark" src="brand/kibare-mark.webp" alt="" [attr.width]="size()" [attr.height]="size()" />
      @if (wordmark()) {
        <span class="word">
          <!-- comme le logo officiel : le A sans barre, une étoile dorée à sa place -->
          <span class="name" aria-label="KIBARE">KIB<svg class="a" viewBox="0 0 100 100" aria-hidden="true"><polygon class="a-leg" points="36,0 64,0 100,100 76,100 50,24 24,100 0,100" /><polygon class="a-star" points="50.0,57.0 53.2,65.6 62.4,66.0 55.1,71.7 57.6,80.5 50.0,75.4 42.4,80.5 44.9,71.7 37.6,66.0 46.8,65.6" /></svg>RE</span>
          @if (tagline()) {
            <span class="tag">{{ tagline() }}</span>
          }
        </span>
      }
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; }
    img { width: auto; display: block; }
    .mark { flex: none; object-fit: contain; }
    .word { display: flex; flex-direction: column; line-height: 1; }
    .name { display: inline-flex; align-items: baseline; font-family: var(--font-display); font-weight: 800; font-size: 1.45rem; letter-spacing: 0.02em; color: var(--y-red); }
    .a { width: 0.74em; height: 0.72em; margin: 0 0.03em; align-self: baseline; overflow: visible; }
    .a-leg { fill: currentColor; }
    .a-star { fill: #F4A51C; }
    .tag { margin-top: 4px; font-size: 0.74rem; font-style: italic; font-weight: 600; color: var(--text-2); }
    :host-context(.app-dark) .name { color: var(--y-ochre); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoComponent {
  readonly size = input(44);
  readonly wordmark = input(true);
  readonly tagline = input<string>('');
  readonly variant = input<'mark' | 'full'>('mark');
}
