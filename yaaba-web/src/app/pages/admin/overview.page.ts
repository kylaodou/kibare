import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { Bar, BarListComponent } from '../../shared/charts/bar-list.component';
import { LineChartComponent, Point } from '../../shared/charts/line-chart.component';
import { AdminService, Dashboard } from './admin.service';

type Metric = 'VIEW' | 'CONTRIBUTION' | 'COMMENT' | 'SIGNUP';

@Component({
  selector: 'app-admin-overview',
  imports: [RouterLink, DatePipe, LineChartComponent, BarListComponent, TranslatePipe],
  template: `
    <header class="ph">
      <div>
        <h1>{{ 'admin.dashboard' | t }}</h1>
        <p class="muted">{{ 'admin.dashLead' | t }}</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" (click)="load()"><i class="fa-solid fa-rotate"></i> {{ 'admin.refresh' | t }}</button>
    </header>

    @if (d(); as d) {
      <section class="kpis">
        @for (k of kpis(); track k.key) {
          <a class="kpi card" [routerLink]="k.link">
            <span class="k-ico"><i class="fa-solid {{ k.icon }}"></i></span>
            <span class="k-txt">
              <small>{{ k.key | t }}</small>
              <strong>{{ k.value }}</strong>
            </span>
            @if (k.alert) {
              <span class="k-alert">{{ 'admin.toReview' | t }}</span>
            }
          </a>
        }
      </section>

      <section class="card block">
        <div class="b-head">
          <h2>{{ 'admin.activity' | t }}</h2>
          <div class="seg" role="group">
            @for (m of metrics; track m) {
              <button type="button" [class.on]="metric() === m" (click)="metric.set(m)">{{ 'admin.m.' + m | t }}</button>
            }
          </div>
        </div>
        <app-line-chart [points]="series()" [label]="'admin.m.' + metric() | t" [unit]="'admin.m.' + metric() | t" />
        <details class="table">
          <summary>{{ 'admin.tableView' | t }}</summary>
          <table>
            <thead><tr><th>{{ 'admin.c.date' | t }}</th><th>{{ 'admin.m.' + metric() | t }}</th></tr></thead>
            <tbody>
              @for (p of series(); track p.label) {
                <tr><td>{{ p.label }}</td><td>{{ p.value }}</td></tr>
              }
            </tbody>
          </table>
        </details>
      </section>

      <div class="cols">
        <section class="card block">
          <h2>{{ 'admin.topTales' | t }}</h2>
          <app-bar-list [bars]="top()" [unit]="'admin.m.VIEW' | t" [empty]="'admin.noData' | t" />
        </section>
        <section class="card block">
          <h2>{{ 'admin.byStatus' | t }}</h2>
          <app-bar-list [bars]="status()" [sort]="false" [empty]="'admin.noData' | t" />
          <h2 class="mt">{{ 'admin.byLanguage' | t }}</h2>
          <app-bar-list [bars]="byLang()" [empty]="'admin.noData' | t" />
        </section>
      </div>

      <div class="cols">
        <section class="card block">
          <h2>{{ 'admin.byRegion' | t }}</h2>
          <app-bar-list [bars]="byRegion()" />
        </section>
        <section class="card block">
          <h2>{{ 'admin.readLang' | t }}</h2>
          <app-bar-list [bars]="readLang()" [empty]="'admin.noData' | t" />
        </section>
      </div>

      <div class="cols">
        <section class="card block">
          <div class="b-head">
            <h2>{{ 'admin.latestContrib' | t }}</h2>
            <a routerLink="contributions" class="more">{{ 'admin.seeAll' | t }} <i class="fa-solid fa-arrow-right"></i></a>
          </div>
          <ul class="feed">
            @for (c of d.latestContributions; track c.id) {
              <li>
                <span class="f-ico" [attr.data-s]="c.status">
                  <i class="fa-solid" [class.fa-microphone-lines]="c.kind === 'voice'" [class.fa-feather-pointed]="c.kind === 'story'"></i>
                </span>
                <span class="f-txt">
                  <strong>{{ c.title }}</strong>
                  <small>{{ c.authorName }} · {{ data.languageMap().get(c.language)?.name }} · {{ c.createdAt | date: 'd MMM, HH:mm' }}</small>
                </span>
                <span class="chip" [class.chip-yellow]="c.status === 'PENDING'" [class.chip-green]="c.status === 'APPROVED'" [class.chip-red]="c.status === 'REJECTED'">{{ 'admin.s.' + c.status | t }}</span>
              </li>
            } @empty {
              <li class="empty">{{ 'admin.noData' | t }}</li>
            }
          </ul>
        </section>
        <section class="card block">
          <div class="b-head">
            <h2>{{ 'admin.latestComments' | t }}</h2>
            <a routerLink="commentaires" class="more">{{ 'admin.seeAll' | t }} <i class="fa-solid fa-arrow-right"></i></a>
          </div>
          <ul class="feed">
            @for (c of d.latestComments; track c.id) {
              <li>
                <span class="f-ico"><i class="fa-regular fa-comment"></i></span>
                <span class="f-txt">
                  <strong>{{ c.userName }}</strong>
                  <small class="clip">« {{ c.text }} »</small>
                </span>
                <a [routerLink]="['/contes', c.taleSlug]" class="more small">{{ 'admin.open' | t }}</a>
              </li>
            } @empty {
              <li class="empty">{{ 'admin.noData' | t }}</li>
            }
          </ul>
        </section>
      </div>
    } @else if (error()) {
      <div class="card block err"><i class="fa-solid fa-plug-circle-xmark"></i> {{ error() }}</div>
    } @else {
      <div class="skeleton"></div>
    }
  `,
  styleUrl: './admin-shared.scss',
})
export class OverviewPage {
  private admin = inject(AdminService);
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  readonly d = signal<Dashboard | null>(null);
  readonly error = signal('');
  readonly metric = signal<Metric>('VIEW');
  readonly metrics: Metric[] = ['VIEW', 'CONTRIBUTION', 'COMMENT', 'SIGNUP'];

  constructor() {
    this.load();
  }

  load() {
    this.admin.dashboard().subscribe({
      next: (d) => this.d.set(d),
      error: () => this.error.set(this.i18n.t('admin.noServer')),
    });
  }

  readonly kpis = computed(() => {
    const t = this.d()?.totals;
    if (!t) return [];
    return [
      { key: 'admin.k.pending', value: t.pending, icon: 'fa-inbox', link: 'contributions', alert: t.pending > 0 },
      { key: 'admin.k.tales', value: t.tales, icon: 'fa-book-open', link: 'contes', alert: false },
      { key: 'admin.k.views', value: t.views, icon: 'fa-eye', link: '', alert: false },
      { key: 'admin.k.users', value: t.users, icon: 'fa-users', link: 'utilisateurs', alert: false },
      { key: 'admin.k.comments', value: t.comments, icon: 'fa-comments', link: 'commentaires', alert: false },
      { key: 'admin.k.audio', value: t.audioTracks, icon: 'fa-microphone-lines', link: 'contes', alert: false },
    ];
  });

  readonly series = computed<Point[]>(() => {
    const m = this.metric();
    const fmt = new Intl.DateTimeFormat(this.i18n.lang(), { day: 'numeric', month: 'short' });
    return (this.d()?.daily ?? []).map((r) => ({ label: fmt.format(new Date(r.day)), value: Number(r[m] ?? 0) }));
  });

  readonly top = computed<Bar[]>(() => (this.d()?.topTales ?? []).filter((t) => t.views > 0).map((t) => ({ label: t.title, value: t.views })));

  readonly status = computed<Bar[]>(() => {
    const s = this.d()?.contributionsByStatus ?? {};
    return [
      { label: this.i18n.t('admin.s.PENDING'), value: s['PENDING'] ?? 0, icon: 'fa-hourglass-half', tone: 'warning' as const },
      { label: this.i18n.t('admin.s.APPROVED'), value: s['APPROVED'] ?? 0, icon: 'fa-circle-check', tone: 'good' as const },
      { label: this.i18n.t('admin.s.REJECTED'), value: s['REJECTED'] ?? 0, icon: 'fa-circle-xmark', tone: 'critical' as const },
    ];
  });

  readonly byLang = computed<Bar[]>(() => this.toBars(this.d()?.contributionsByLanguage, (k) => this.data.languageMap().get(k)?.name ?? k));
  readonly readLang = computed<Bar[]>(() => this.toBars(this.d()?.viewsByLanguage, (k) => this.data.languageMap().get(k)?.name ?? k));
  readonly byRegion = computed<Bar[]>(() => this.toBars(this.d()?.talesByRegion, (k) => this.data.regionMap().get(k)?.name ?? k));

  private toBars(m: Record<string, number> | undefined, name: (k: string) => string): Bar[] {
    return Object.entries(m ?? {}).map(([k, v]) => ({ label: name(k), value: v }));
  }
}
