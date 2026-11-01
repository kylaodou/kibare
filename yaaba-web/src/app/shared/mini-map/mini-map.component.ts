import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DataService } from '../../core/data.service';
import { projectSvg } from '../geo';

export interface MapDot {
  id: string;
  lat: number;
  lon: number;
  label: string;
}

/** Carte SVG légère du Burkina Faso (accueil, passeport, langues). */
@Component({
  selector: 'app-mini-map',
  template: `
    @if (shape(); as s) {
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="label()">
        @for (r of s.regions; track r.code) {
          <path
            [attr.d]="r.d"
            class="region"
            [class.hi]="highlight().includes(r.code)"
            [class.stamp]="stamps().includes(r.code)"
            [class.hover]="hovered() === r.code"
            [class.clickable]="interactive()"
            (pointerenter)="hovered.set(r.code)"
            (pointerleave)="hovered.set(null)"
            (click)="interactive() && regionClick.emit(r.code)"
          >
            <title>{{ r.name }}</title>
          </path>
        }
        @for (r of s.regions; track r.code) {
          @if (stamps().includes(r.code)) {
            <g class="seal" [attr.transform]="'translate(' + r.cx + ',' + r.cy + ')'">
              <circle r="11" />
              <path d="M0,-6 L1.6,-1.9 L5.7,-1.9 L2.4,0.7 L3.5,4.9 L0,2.4 L-3.5,4.9 L-2.4,0.7 L-5.7,-1.9 L-1.6,-1.9Z" />
            </g>
          }
        }
        @for (d of projectedDots(); track d.id) {
          <g class="dot" [attr.transform]="'translate(' + d.x + ',' + d.y + ')'">
            <circle r="9" class="halo" />
            <circle r="4.5" />
            <title>{{ d.label }}</title>
          </g>
        }
        @if (showLabels()) {
          @for (r of s.regions; track r.code) {
            <text [attr.x]="r.cx" [attr.y]="r.cy + (stamps().includes(r.code) ? 24 : 4)" class="lbl" [class.on]="hovered() === r.code">{{ r.name }}</text>
          }
        }
      </svg>
    }
  `,
  styleUrl: './mini-map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiniMapComponent {
  private data = inject(DataService);
  readonly W = 600;
  readonly H = 470;

  readonly highlight = input<string[]>([]);
  readonly stamps = input<string[]>([]);
  readonly dots = input<MapDot[]>([]);
  readonly interactive = input(false);
  readonly showLabels = input(false);
  readonly label = input('Burkina Faso');
  readonly regionClick = output<string>();
  readonly hovered = signal<string | null>(null);

  readonly shape = computed(() => {
    const geo = this.data.geo();
    return geo ? projectSvg(geo, this.W, this.H, 10) : null;
  });

  readonly projectedDots = computed(() => {
    const s = this.shape();
    if (!s) return [];
    return this.dots().map((d) => {
      const [x, y] = s.project(d.lon, d.lat);
      return { ...d, x, y };
    });
  });
}
