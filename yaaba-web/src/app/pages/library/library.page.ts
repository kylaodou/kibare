import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SelectModule } from 'primeng/select';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { TaleType } from '../../core/models';
import { ProgressService } from '../../core/progress.service';
import { PagerComponent, paginate } from '../../shared/pager/pager.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { TYPE_ICON, TaleCardComponent, taleText } from '../../shared/tale-card/tale-card.component';

type Sort = 'featured' | 'title' | 'short' | 'popular';

@Component({
  selector: 'app-library',
  imports: [FormsModule, RouterLink, SelectModule, TaleCardComponent, TranslatePipe, PagerComponent, SkeletonComponent],
  templateUrl: './library.page.html',
  styleUrl: './library.page.scss',
})
export class LibraryPage {
  readonly data = inject(DataService);
  readonly i18n = inject(I18nService);
  readonly progress = inject(ProgressService);
  private router = inject(Router);

  readonly region = input<string>();
  readonly typeIcon = TYPE_ICON;
  readonly Math = Math;
  readonly types: (TaleType | 'all')[] = ['all', 'conte', 'legende', 'recit'];

  readonly q = signal('');
  readonly type = signal<TaleType | 'all'>('all');
  readonly regionSel = signal<string | null>(null);
  readonly lang = signal<string | null>(null);
  readonly favs = signal(false);
  readonly sort = signal<Sort>('featured');

  readonly regionOptions = computed(() => this.data.regions().map((r) => ({ label: r.name, value: r.code })));
  readonly langOptions = computed(() => {
    const used = new Set(this.data.tales().map((t) => t.language));
    return this.data.languages().filter((l) => used.has(l.code)).map((l) => ({ label: l.name, value: l.code }));
  });
  readonly sortOptions = computed(() => {
    this.i18n.lang();
    return (['featured', 'title', 'short', 'popular'] as Sort[]).map((s) => ({ label: this.i18n.t('lib.sort.' + s), value: s }));
  });

  readonly results = computed(() => {
    const q = norm(this.q());
    const reg = this.regionSel() ?? this.region() ?? null;
    const lang = this.i18n.lang();
    let list = this.data.tales().filter((t) => {
      if (this.type() !== 'all' && t.type !== this.type()) return false;
      if (reg && t.region !== reg) return false;
      if (this.lang() && t.language !== this.lang()) return false;
      if (this.favs() && !this.progress.favorites().has(t.slug)) return false;
      if (!q) return true;
      const tt = taleText(t, lang);
      return [tt.title, tt.subtitle, tt.summary, t.place, t.people, ...t.tags, this.data.regionMap().get(t.region)?.name ?? ''].some((s) => norm(s).includes(q));
    });
    const s = this.sort();
    list = [...list].sort((a, b) => {
      if (s === 'title') return taleText(a, lang).title.localeCompare(taleText(b, lang).title);
      if (s === 'short') return a.duration - b.duration;
      if (s === 'popular') return (b.views ?? 0) + (b.likes ?? 0) * 5 - ((a.views ?? 0) + (a.likes ?? 0) * 5);
      return Number(!!b.featured) - Number(!!a.featured);
    });
    return list;
  });

  /** pagination : 10 histoires par page, retour à la page 1 à chaque nouveau filtre */
  readonly pageSize = 10;
  readonly page = signal(1);
  readonly pageItems = computed(() => paginate(this.results(), this.page(), this.pageSize));
  private resetPage = effect(() => {
    this.results();
    this.page.set(1);
  });

  readonly activeFilters = computed(
    () => +(this.type() !== 'all') + +!!this.regionSel() + +!!this.lang() + +this.favs() + +!!this.q(),
  );

  scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  reset() {
    this.q.set('');
    this.type.set('all');
    this.regionSel.set(null);
    this.lang.set(null);
    this.favs.set(false);
    if (this.region()) void this.router.navigate([], { queryParams: {} });
  }

  surprise() {
    const pool = this.results().length ? this.results() : this.data.tales();
    const t = pool[Math.floor(Math.random() * pool.length)];
    void this.router.navigate(['/contes', t.slug]);
  }
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
