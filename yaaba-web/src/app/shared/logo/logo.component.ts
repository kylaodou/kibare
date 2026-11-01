import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Logo KIBARE (« histoire » en mooré) : la carte du Burkina, un conteur et un livre ouvert.
 * - variant "full" : logo complet avec le nom et la devise ;
 * - variant "mark" : emblème seul + nom en texte (en-tête, pied de page).
 */
@Component({
  selector: 'app-logo',
  template: `
    @if (variant() === 'full') {
      <img src="brand/kibare-logo.webp" alt="KIBARE — Le Burkina Faso à travers ses histoires" [style.height.px]="size()" width="1200" height="820" />
    } @else {
      <img class="mark" src="brand/kibare-mark.webp" alt="" [attr.width]="size()" [attr.height]="size()" />
      @if (wordmark()) {
        <span class="word">
          <span class="name">KIBARE</span>
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
    .name { font-family: var(--font-display); font-weight: 800; font-size: 1.45rem; letter-spacing: 0.02em; color: var(--y-red); }
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
