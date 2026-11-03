import { ChangeDetectionStrategy, Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';

export interface Point {
  label: string;
  value: number;
}

/** Courbe d'une seule série (aire légère + trait 2 px), réticule et infobulle au survol. */
@Component({
  selector: 'app-line-chart',
  template: `
    <div class="wrap" #wrap (pointermove)="move($event)" (pointerleave)="hover.set(-1)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" role="img" [attr.aria-label]="label()">
        @for (t of ticks(); track t.v) {
          <line [attr.x1]="P" [attr.x2]="W - 8" [attr.y1]="t.y" [attr.y2]="t.y" class="grid" />
        }
        <path [attr.d]="area()" class="area" />
        <path [attr.d]="line()" class="line" />
        @if (hover() >= 0) {
          <line [attr.x1]="x(hover())" [attr.x2]="x(hover())" [attr.y1]="8" [attr.y2]="H - 22" class="cross" />
          <circle [attr.cx]="x(hover())" [attr.cy]="y(points()[hover()].value)" r="5" class="dot" />
        }
        @if (last(); as l) {
          <circle [attr.cx]="x(points().length - 1)" [attr.cy]="y(l.value)" r="4.5" class="dot" />
        }
      </svg>
      <div class="yaxis">
        @for (t of ticks(); track t.v) {
          <span [style.top.%]="(t.y / H) * 100">{{ compact(t.v) }}</span>
        }
      </div>
      <div class="xaxis">
        <span>{{ points()[0]?.label }}</span>
        <span>{{ points()[points().length - 1]?.label }}</span>
      </div>
      @if (hover() >= 0) {
        <div class="tip" [style.left.%]="(x(hover()) / W) * 100" [class.flip]="hover() > points().length * 0.7">
          <small>{{ points()[hover()].label }}</small>
          <strong>{{ points()[hover()].value }}</strong> {{ unit() }}
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; --series: #b4581a; }
    :host-context(.app-dark) { --series: #e69135; }
    .wrap { position: relative; padding-left: 34px; }
    svg { width: 100%; height: 200px; display: block; overflow: visible; }
    .grid { stroke: var(--border); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .area { fill: var(--series); fill-opacity: 0.1; }
    .line { fill: none; stroke: var(--series); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .cross { stroke: var(--text-3); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .dot { fill: var(--series); stroke: var(--surface); stroke-width: 2; vector-effect: non-scaling-stroke; }
    .yaxis { position: absolute; left: 0; top: 0; bottom: 0; width: 30px; }
    .yaxis span { position: absolute; right: 0; transform: translateY(-50%); font-size: 0.7rem; color: var(--text-3); }
    .xaxis { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-3); margin-top: -16px; }
    .tip { position: absolute; top: 0; transform: translateX(8px); padding: 6px 10px; border-radius: 6px; background: var(--text); color: var(--bg); font-size: 0.8rem; white-space: nowrap; pointer-events: none; }
    .tip.flip { transform: translateX(calc(-100% - 8px)); }
    .tip small { display: block; opacity: 0.75; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChartComponent {
  readonly points = input.required<Point[]>();
  readonly label = input('');
  readonly unit = input('');
  readonly hover = signal(-1);
  private wrap = viewChild.required<ElementRef<HTMLElement>>('wrap');

  readonly W = 600;
  readonly H = 200;
  readonly P = 4;

  readonly max = computed(() => {
    const m = Math.max(1, ...this.points().map((p) => p.value));
    const step = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / step) * step;
  });
  readonly ticks = computed(() => [0, 0.5, 1].map((f) => ({ v: Math.round(this.max() * f), y: this.y(this.max() * f) })));
  readonly last = computed(() => this.points()[this.points().length - 1]);

  x(i: number) {
    const n = Math.max(1, this.points().length - 1);
    return this.P + (i / n) * (this.W - this.P - 8);
  }

  y(v: number) {
    return 8 + (1 - v / this.max()) * (this.H - 30);
  }

  readonly line = computed(() => this.points().map((p, i) => `${i ? 'L' : 'M'}${this.x(i).toFixed(1)},${this.y(p.value).toFixed(1)}`).join(''));
  readonly area = computed(() => {
    const pts = this.points();
    if (!pts.length) return '';
    return `${this.line()}L${this.x(pts.length - 1)},${this.y(0)}L${this.x(0)},${this.y(0)}Z`;
  });

  move(e: PointerEvent) {
    const r = this.wrap().nativeElement.querySelector('svg')!.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    const n = this.points().length;
    if (!n || f < 0 || f > 1) return this.hover.set(-1);
    this.hover.set(Math.round(f * (n - 1)));
  }

  compact(v: number) {
    return v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v);
  }
}
