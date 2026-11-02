import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/** Découpe une liste en pages (page commence à 1). */
export function paginate<T>(list: T[], page: number, size: number): T[] {
  return list.slice((page - 1) * size, page * size);
}

/** Pagination : précédent / numéros / suivant. Masquée s'il n'y a qu'une page. */
@Component({
  selector: 'app-pager',
  template: `
    @if (pages() > 1) {
      <nav class="pager" aria-label="Pagination">
        <button type="button" class="nav" [disabled]="page() === 1" (click)="go(page() - 1)" aria-label="Page précédente">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        @for (p of numbers(); track $index) {
          @if (p === 0) {
            <span class="gap">…</span>
          } @else {
            <button type="button" [class.on]="p === page()" [attr.aria-current]="p === page() ? 'page' : null" (click)="go(p)">{{ p }}</button>
          }
        }
        <button type="button" class="nav" [disabled]="page() === pages()" (click)="go(page() + 1)" aria-label="Page suivante">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        <span class="info">{{ from() }}–{{ to() }} / {{ total() }}</span>
      </nav>
    }
  `,
  styles: `
    .pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; margin: 28px 0 8px; }
    button { min-width: 38px; height: 38px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text-2); font-weight: 700; cursor: pointer; }
    button:hover:not(:disabled) { border-color: var(--y-red); color: var(--y-red); }
    button.on { background: var(--y-red); border-color: var(--y-red); color: #fff; }
    button:disabled { opacity: 0.4; cursor: default; }
    .gap { padding: 0 4px; color: var(--text-3); }
    .info { margin-left: 10px; font-size: 0.85rem; color: var(--text-3); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagerComponent {
  readonly total = input.required<number>();
  readonly size = input(12);
  readonly page = model(1);

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly from = computed(() => (this.page() - 1) * this.size() + 1);
  readonly to = computed(() => Math.min(this.total(), this.page() * this.size()));

  /** 1 … 4 5 6 … 12 : la première, la dernière et les voisines de la page courante (0 = ellipse). */
  readonly numbers = computed(() => {
    const n = this.pages();
    const p = this.page();
    const out: number[] = [];
    for (let i = 1; i <= n; i++) {
      if (i === 1 || i === n || Math.abs(i - p) <= 1) out.push(i);
      else if (out[out.length - 1] !== 0) out.push(0);
    }
    return out;
  });

  go(p: number) {
    this.page.set(Math.min(this.pages(), Math.max(1, p)));
  }
}
