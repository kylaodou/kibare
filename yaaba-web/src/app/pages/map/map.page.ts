import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe, TxPipe } from '../../core/i18n.service';
import { Tale, TaleType } from '../../core/models';
import { ProgressService } from '../../core/progress.service';
import { SceneArtComponent } from '../../shared/art/scene-art.component';
import { TYPE_ICON, taleText } from '../../shared/tale-card/tale-card.component';
import { TourService } from '../../shared/tour/tour.service';
import { Map2dComponent } from './map2d.component';
import { Map3dComponent } from './map3d.component';

export type MapMode = '2d' | '3d';
const MODE_KEY = 'yaaba.mapMode';

@Component({
  selector: 'app-map-page',
  imports: [FormsModule, RouterLink, SelectModule, TooltipModule, TranslatePipe, TxPipe, Map2dComponent, Map3dComponent, SceneArtComponent],
  templateUrl: './map.page.html',
  styleUrl: './map.page.scss',
})
export class MapPage {
  readonly data = inject(DataService);
  readonly i18n = inject(I18nService);
  readonly progress = inject(ProgressService);
  private router = inject(Router);
  private tour = inject(TourService);

  /** paramètres d'URL (?region=…&conte=…&mode=…) */
  readonly region = input<string>();
  readonly conte = input<string>();
  readonly mode = input<MapMode>();

  readonly view = signal<MapMode>(this.initialMode());
  readonly selectedRegion = signal<string | null>(null);
  readonly selectedTale = signal<string | null>(null);
  readonly types = signal<Set<TaleType>>(new Set(['conte', 'legende', 'recit']));
  readonly lang = signal<string | null>(null);
  readonly query = signal('');
  readonly searchOpen = signal(false);
  readonly panelOpen = signal(true);
  readonly typeIcon = TYPE_ICON;
  readonly allTypes: TaleType[] = ['conte', 'legende', 'recit'];

  readonly filtered = computed(() =>
    this.data.tales().filter((t) => this.types().has(t.type) && (!this.lang() || t.language === this.lang())),
  );

  readonly langOptions = computed(() => {
    const used = new Set(this.data.tales().map((t) => t.language));
    return this.data.languages().filter((l) => used.has(l.code)).map((l) => ({ label: l.name, value: l.code }));
  });

  readonly regionInfo = computed(() => {
    const code = this.selectedRegion();
    return code ? this.data.regionMap().get(code) : undefined;
  });

  readonly regionTales = computed(() => {
    const code = this.selectedRegion();
    return code ? this.filtered().filter((t) => t.region === code) : [];
  });

  readonly taleInfo = computed(() => {
    const slug = this.selectedTale();
    return slug ? this.data.tale(slug) : undefined;
  });

  readonly regionList = computed(() =>
    this.data
      .regions()
      .map((r) => ({ ...r, count: this.filtered().filter((t) => t.region === r.code).length }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly results = computed(() => {
    const q = normalize(this.query());
    if (q.length < 2) return [];
    return this.data
      .tales()
      .filter((t) =>
        [taleText(t, this.i18n.lang()).title, t.place, t.people, this.data.regionMap().get(t.region)?.name ?? '']
          .some((s) => normalize(s).includes(q)),
      )
      .slice(0, 6);
  });

  readonly visitedCount = computed(() => this.progress.state().regionsVisited.length);

  constructor() {
    // URL → état
    effect(() => {
      const r = this.region();
      const c = this.conte();
      const m = this.mode();
      if (m === '2d' || m === '3d') this.view.set(m);
      if (c && this.data.tale(c)) {
        this.selectTale(c, false);
      } else if (r) {
        this.selectRegion(r, false);
      }
    });
    effect(() => {
      try {
        localStorage.setItem(MODE_KEY, this.view());
      } catch {}
    });
    setTimeout(() => this.startTour(false), 1200);
  }

  text(t: Tale) {
    return taleText(t, this.i18n.lang());
  }

  setMode(m: MapMode) {
    this.view.set(m);
    this.syncUrl();
  }

  selectRegion(code: string | null, sync = true) {
    this.selectedRegion.set(code);
    this.selectedTale.set(null);
    if (code) {
      this.progress.visitRegion(code);
      this.panelOpen.set(true);
    }
    if (sync) this.syncUrl();
  }

  selectTale(slug: string, sync = true) {
    const t = this.data.tale(slug);
    if (!t) return;
    this.selectedRegion.set(t.region);
    this.selectedTale.set(slug);
    this.progress.visitRegion(t.region);
    this.panelOpen.set(true);
    this.query.set('');
    this.searchOpen.set(false);
    if (sync) this.syncUrl();
  }

  back() {
    if (this.selectedTale()) this.selectedTale.set(null);
    else this.selectRegion(null);
    this.syncUrl();
  }

  toggleType(t: TaleType) {
    this.types.update((s) => {
      const n = new Set(s);
      if (n.has(t) && n.size > 1) n.delete(t);
      else n.add(t);
      return n;
    });
  }

  startTour(force = true) {
    this.tour.start(
      'map',
      [
        { target: '#map-mode', title: 'tour.map.1.title', text: 'tour.map.1.text', icon: 'fa-cube' },
        { target: '#map-canvas', title: 'tour.map.2.title', text: 'tour.map.2.text', icon: 'fa-hand-pointer' },
        { target: '#map-search', title: 'tour.map.3.title', text: 'tour.map.3.text', icon: 'fa-magnifying-glass' },
        { target: '#map-filters', title: 'tour.map.4.title', text: 'tour.map.4.text', icon: 'fa-filter' },
        { target: '#map-panel', title: 'tour.map.5.title', text: 'tour.map.5.text', icon: 'fa-book-open' },
      ],
      force,
    );
  }

  private syncUrl() {
    void this.router.navigate([], {
      queryParams: {
        region: this.selectedTale() ? null : this.selectedRegion(),
        conte: this.selectedTale(),
        mode: this.view(),
      },
      replaceUrl: true,
    });
  }

  private initialMode(): MapMode {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === '2d' || m === '3d') return m;
    } catch {}
    return window.innerWidth < 768 ? '2d' : '3d';
  }
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
