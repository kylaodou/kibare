import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface Bar {
  label: string;
  value: number;
  icon?: string;
  /** couleur de statut optionnelle (réservée aux états, toujours accompagnée d'une icône) */
  tone?: 'good' | 'warning' | 'critical';
}

/** Barres horizontales d'une seule série : libellé à gauche, valeur au bout de la barre, infobulle native. */
@Component({
  selector: 'app-bar-list',
  template: `
    <ul class="bars" role="list">
      @for (b of sorted(); track b.label) {
        <li [attr.title]="b.label + ' : ' + b.value + ' ' + unit()">
          <span class="lbl">
            @if (b.icon) {
              <i class="fa-solid {{ b.icon }}" [attr.data-tone]="b.tone"></i>
            }
            {{ b.label }}
          </span>
          <span class="track">
            <span class="fill" [attr.data-tone]="b.tone" [style.width.%]="max() ? (b.value / max()) * 100 : 0"></span>
            <span class="val">{{ b.value }}</span>
          </span>
        </li>
      } @empty {
        <li class="empty">{{ empty() }}</li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; --series: #b4581a; --good: #7c3109; --warning: #c98a00; --critical: #c0392b; }
    :host-context(.app-dark) { --series: #e69135; --good: #f0a65a; --warning: #e7b43a; --critical: #ec6a5e; }
    .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    li { display: grid; grid-template-columns: minmax(90px, 38%) 1fr; align-items: center; gap: 12px; font-size: 0.86rem; }
    .lbl { color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lbl i { width: 16px; color: var(--text-3); }
    .lbl i[data-tone='good'] { color: var(--good); }
    .lbl i[data-tone='warning'] { color: var(--warning); }
    .lbl i[data-tone='critical'] { color: var(--critical); }
    .track { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .fill { height: 14px; min-width: 2px; border-radius: 0 4px 4px 0; background: var(--series); transition: width 0.6s var(--ease); }
    .fill[data-tone='good'] { background: var(--good); }
    .fill[data-tone='warning'] { background: var(--warning); }
    .fill[data-tone='critical'] { background: var(--critical); }
    .val { font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
    .empty { display: block; color: var(--text-3); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarListComponent {
  readonly bars = input.required<Bar[]>();
  readonly unit = input('');
  readonly empty = input('—');
  readonly sort = input(true);
  readonly sorted = computed(() => (this.sort() ? [...this.bars()].sort((a, b) => b.value - a.value) : this.bars()));
  readonly max = computed(() => Math.max(0, ...this.bars().map((b) => b.value)));
}
