import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Éclat de petits cœurs qui tournent autour du bouton « j'aime ». */
@Component({
  selector: 'app-heart-burst',
  template: `
    @for (k of [trigger()]; track k) {
      @if (k) {
        <span class="burst" aria-hidden="true">
          @for (a of angles; track a) {
            <i class="fa-solid fa-heart" [style.--a]="a + 'deg'"></i>
          }
        </span>
      }
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; }
    .burst { position: absolute; left: 50%; top: 50%; animation: spin 0.9s ease-out forwards; }
    i {
      position: absolute; left: -5px; top: -5px; font-size: 10px; color: var(--y-red);
      transform: rotate(var(--a)) translateY(0) scale(0.4);
      animation: fly 0.9s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
    }
    i:nth-child(even) { color: var(--y-ochre); font-size: 8px; }
    @keyframes fly {
      60% { opacity: 1; }
      100% { transform: rotate(var(--a)) translateY(-26px) scale(1); opacity: 0; }
    }
    @keyframes spin { to { transform: rotate(140deg); } }
    @media (prefers-reduced-motion: reduce) { .burst { display: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeartBurstComponent {
  readonly trigger = input(0);
  readonly angles = [0, 45, 90, 135, 180, 225, 270, 315];
}
