import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Squelettes de chargement, à la forme du contenu attendu : - cards : cartes d'histoire (image + lignes) ; - rows : lignes de tableau ou de liste ; - tiles : chiffres clés du tableau de bord ; - reader : lecteur de conte (illustration + paragraphes). */
@Component({
  selector: 'app-skeleton',
  template: `
    <div class="sk" [attr.aria-busy]="true" aria-live="polite" [attr.aria-label]="'Chargement…'">
      @switch (kind()) {
        @case ('cards') {
          <div class="cards">
            @for (i of items(); track i) {
              <div class="card-sk">
                <span class="skeleton img"></span>
                <span class="skeleton line w40"></span>
                <span class="skeleton line w80 big"></span>
                <span class="skeleton line w60"></span>
              </div>
            }
          </div>
        }
        @case ('rows') {
          <div class="rows">
            @for (i of items(); track i) {
              <div class="row-sk">
                <span class="skeleton dot"></span>
                <span class="skeleton line w30"></span>
                <span class="skeleton line w50"></span>
                <span class="skeleton line w15"></span>
              </div>
            }
          </div>
        }
        @case ('tiles') {
          <div class="tiles">
            @for (i of items(); track i) {
              <span class="skeleton tile"></span>
            }
          </div>
          <span class="skeleton chart"></span>
        }
        @case ('reader') {
          <span class="skeleton line w20"></span>
          <span class="skeleton title"></span>
          <div class="reader">
            <span class="skeleton art"></span>
            <div class="paras">
              @for (i of items(); track i) {
                <span class="skeleton line w100"></span>
                <span class="skeleton line w90"></span>
                <span class="skeleton line w70 gap"></span>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .sk { display: block; }
    .line { height: 12px; margin: 10px 0; }
    .line.big { height: 18px; }
    .line.gap { margin-bottom: 24px; }
    .w15 { width: 15%; } .w20 { width: 20%; } .w30 { width: 30%; } .w40 { width: 40%; } .w50 { width: 50%; }
    .w60 { width: 60%; } .w70 { width: 70%; } .w80 { width: 80%; } .w90 { width: 90%; } .w100 { width: 100%; }
    .cards { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); }
    .card-sk { padding: 0 0 16px; border: 1px solid var(--border); border-radius: var(--radius-l); overflow: hidden; }
    .card-sk .line { margin-inline: 16px; }
    .img { height: 170px; border-radius: 0; margin-bottom: 16px; }
    .rows { display: grid; gap: 4px; }
    .row-sk { display: flex; align-items: center; gap: 18px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius); }
    .row-sk .line { margin: 0; }
    .dot { flex: none; width: 34px; height: 34px; border-radius: 50%; }
    .tiles { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 20px; }
    .tile { height: 90px; border-radius: var(--radius-l); }
    .chart { height: 280px; border-radius: var(--radius-l); }
    .title { height: 44px; width: 55%; margin: 16px 0 32px; }
    .reader { display: grid; gap: 40px; }
    @media (min-width: 900px) { .reader { grid-template-columns: 1fr 1fr; } }
    .art { aspect-ratio: 16 / 10; border-radius: var(--radius-l); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonComponent {
  readonly kind = input<'cards' | 'rows' | 'tiles' | 'reader'>('rows');
  readonly count = input(6);
  readonly items = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
