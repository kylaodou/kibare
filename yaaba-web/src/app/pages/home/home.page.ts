import { AfterViewInit, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { Art } from '../../core/models';
import { ProgressService } from '../../core/progress.service';
import { SceneArtComponent } from '../../shared/art/scene-art.component';
import { Map2dComponent } from '../map/map2d.component';
import { Map3dComponent } from '../map/map3d.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { TaleCardComponent, taleText } from '../../shared/tale-card/tale-card.component';
import { TourService } from '../../shared/tour/tour.service';

const HERO: Art = {
  sky: 'night',
  ground: 'village',
  items: [
    { k: 'moon', x: 84, y: 300 },
    { k: 'baobab', x: 20, y: 30, s: 1.15 },
    { k: 'hut', x: 82, y: 34, s: 0.9 },
    { k: 'granary', x: 92, y: 30, s: 0.7 },
    { k: 'fire', x: 52, y: -6, s: 1.1 },
    { k: 'yaaba-sit', x: 36, y: -6, s: 1.1 },
    { k: 'child-sit', x: 64, y: -6, flip: true, s: 1.1 },
    { k: 'child-sit', x: 71, y: -10, flip: true, c: '#C9822B', s: 1.1 },
    { k: 'child-sit', x: 58, y: -26, flip: true, c: '#D62828', s: 1.15 },
  ],
};

@Component({
  selector: 'app-home',
  imports: [RouterLink, SceneArtComponent, TaleCardComponent, Map2dComponent, Map3dComponent, TranslatePipe, SkeletonComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements AfterViewInit {
  readonly data = inject(DataService);
  private destroyRef = inject(DestroyRef);
  private numbers = viewChild<ElementRef<HTMLElement>>('numbers');
  /** valeurs affichées pendant l'animation de comptage */
  readonly shown = signal({ tales: 0, regions: 0, languages: 0 });
  readonly i18n = inject(I18nService);
  readonly progress = inject(ProgressService);
  private router = inject(Router);
  private tour = inject(TourService);
  readonly hero = HERO;

  /** Conte du jour : change chaque jour, identique pour tous les visiteurs. */
  readonly today = computed(() => {
    const list = this.data.tales();
    const day = Math.floor(Date.now() / 86_400_000);
    return list[day % list.length];
  });
  readonly todayText = computed(() => taleText(this.today(), this.i18n.lang()));

  /** 10 histoires : celles mises à la une d'abord, complétées par les autres. */
  readonly featured = computed(() => {
    const all = this.data.tales();
    return [...all.filter((t) => t.featured), ...all.filter((t) => !t.featured)].slice(0, 10);
  });
  readonly resume = computed(() =>
    this.progress
      .inProgress()
      .map((p) => ({ ...p, tale: this.data.tale(p.slug)! }))
      .filter((p) => p.tale)
      .slice(0, 3),
  );
  readonly nationalLanguages = computed(() => this.data.languages().filter((l) => l.greeting));
  readonly languageCount = computed(() => this.data.languages().filter((l) => l.code !== 'en').length);

  readonly steps = [
    { icon: 'fa-map-location-dot', title: 'home.step1.title', text: 'home.step1.text', color: 'red' },
    { icon: 'fa-headphones', title: 'home.step2.title', text: 'home.step2.text', color: 'yellow' },
    { icon: 'fa-stamp', title: 'home.step3.title', text: 'home.step3.text', color: 'green' },
  ];

  constructor() {
    setTimeout(
      () =>
        this.tour.start('home', [
          { title: 'tour.home.1.title', text: 'tour.home.1.text', icon: 'fa-hand-sparkles' },
          { target: '#hero-cta', title: 'tour.home.2.title', text: 'tour.home.2.text', icon: 'fa-map-location-dot' },
          { target: '#tour-sound', title: 'tour.home.3.title', text: 'tour.home.3.text', icon: 'fa-music' },
          { target: '#today', title: 'tour.home.4.title', text: 'tour.home.4.text', icon: 'fa-moon' },
        ]),
      900,
    );
  }

  ngAfterViewInit() {
    const el = this.numbers()?.nativeElement;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        this.countUp();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    this.destroyRef.onDestroy(() => io.disconnect());
  }

  /** Les chiffres montent de 0 à leur valeur en 1,6 s (ralenti en fin de course). */
  private countUp() {
    const target = { tales: this.data.tales().length, regions: this.data.regions().length, languages: this.languageCount() };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return this.shown.set(target);
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 1600);
      const e = 1 - Math.pow(1 - k, 3);
      this.shown.set({
        tales: Math.round(target.tales * e),
        regions: Math.round(target.regions * e),
        languages: Math.round(target.languages * e),
      });
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** carte de l'accueil : 3D par défaut, bascule 2D possible */
  readonly mapView = signal<'2d' | '3d'>('3d');

  regionClick(code: string) {
    void this.router.navigate(['/carte'], { queryParams: { region: code, mode: this.mapView() } });
  }

  openTale(slug: string) {
    void this.router.navigate(['/contes', slug]);
  }
}
