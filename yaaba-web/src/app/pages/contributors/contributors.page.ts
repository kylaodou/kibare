import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { Contributor } from '../../core/models';
import { taleText } from '../../shared/tale-card/tale-card.component';

/** Les femmes et les hommes qui font vivre KIBARE : contributeurs dont une contribution a été acceptée. */
@Component({
  selector: 'app-contributors',
  imports: [RouterLink, DatePipe, TranslatePipe],
  template: `
    <section class="head bogolan">
      <div class="container">
        <span class="eyebrow">{{ 'contributors.eyebrow' | t }}</span>
        <h1>{{ 'contributors.title' | t }}</h1>
        <p class="lead">{{ 'contributors.lead' | t }}</p>
        <div class="stats">
          <div><strong>{{ list().length }}</strong><span>{{ 'contributors.k.people' | t }}</span></div>
          <div><strong>{{ total() }}</strong><span>{{ 'contributors.k.contrib' | t }}</span></div>
          <div><strong>{{ regions() }}</strong><span>{{ 'contributors.k.regions' | t }}</span></div>
        </div>
      </div>
    </section>
    <div class="band-tiebele" aria-hidden="true"></div>

    <section class="container body">
      @if (loading()) {
        <p class="muted">…</p>
      } @else if (!list().length) {
        <div class="empty card">
          <i class="fa-solid fa-people-group"></i>
          <h2>{{ 'contributors.empty.title' | t }}</h2>
          <p class="muted">{{ (data.online() ? 'contributors.empty.text' : 'contributors.offline') | t }}</p>
          <a [routerLink]="auth.loggedIn() ? '/contribuer' : '/inscription'" class="btn">{{ 'contributors.cta' | t }}</a>
        </div>
      } @else {
        <div class="grid">
          @for (c of list(); track c.id; let i = $index) {
            <article class="person card">
              <div class="p-top">
                <span class="avatar" [attr.data-i]="i % 4">{{ initials(c.name) }}</span>
                <div>
                  <h2>{{ c.name }}</h2>
                  <p class="meta">
                    @if (c.region) {
                      <span><i class="fa-solid fa-location-dot"></i> {{ data.regionMap().get(c.region)?.name }}</span>
                    }
                    @if (c.language) {
                      <span><i class="fa-solid fa-language"></i> {{ data.languageMap().get(c.language)?.name }}</span>
                    }
                  </p>
                </div>
                <span class="rank" [attr.title]="'contributors.approved' | t">{{ c.approved }}</span>
              </div>
              @if (c.bio) {
                <p class="bio">« {{ c.bio }} »</p>
              }
              @if (c.tales.length) {
                <ul class="tales">
                  @for (s of c.tales; track s) {
                    <li><a [routerLink]="['/contes', s]"><i class="fa-solid fa-book-open"></i> {{ title(s) }}</a></li>
                  }
                </ul>
              }
              <small class="since">{{ 'account.since' | t }} {{ c.since | date: 'MMMM y' }}</small>
            </article>
          }
        </div>
      }
      <div class="cta card">
        <div>
          <h2>{{ 'contributors.joinTitle' | t }}</h2>
          <p class="muted">{{ 'contributors.joinText' | t }}</p>
        </div>
        <a [routerLink]="auth.loggedIn() ? '/contribuer' : '/inscription'" class="btn">{{ 'contributors.cta' | t }} <i class="fa-solid fa-arrow-right"></i></a>
      </div>
    </section>
  `,
  styles: `
    .head { padding-block: clamp(40px, 6vw, 72px); }
    .stats { display: flex; flex-wrap: wrap; gap: 40px; margin-top: 28px; }
    .stats div { display: flex; flex-direction: column; }
    .stats strong { font-family: var(--font-display); font-size: 2.2rem; line-height: 1; color: var(--y-yellow); }
    .stats span { font-size: 0.85rem; color: #e9d5bd; }
    .body { padding-block: 40px 64px; }
    .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
    .person { padding: 22px; display: flex; flex-direction: column; gap: 12px; border-top: 4px solid var(--y-ochre); }
    .p-top { display: flex; gap: 14px; align-items: center; }
    .p-top h2 { font-size: 1.15rem; margin: 0; }
    .avatar { flex: none; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-display); font-weight: 800; color: #fff; background: var(--y-red); }
    .avatar[data-i='1'] { background: var(--y-green); }
    .avatar[data-i='2'] { background: var(--y-ochre); color: #1e1611; }
    .avatar[data-i='3'] { background: #1e1611; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px; margin: 2px 0 0; font-size: 0.82rem; color: var(--text-3); }
    .meta i { color: var(--y-ochre); margin-right: 3px; }
    .rank { margin-left: auto; min-width: 36px; height: 36px; padding: 0 8px; border-radius: var(--radius); display: grid; place-items: center; background: var(--y-yellow-soft); color: var(--y-yellow-ink); font-family: var(--font-display); font-weight: 800; }
    .bio { margin: 0; font-style: italic; color: var(--text-2); }
    .tales { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .tales a { display: flex; gap: 8px; align-items: baseline; font-weight: 700; font-size: 0.9rem; color: var(--y-red); }
    .tales a:hover { text-decoration: underline; }
    .since { color: var(--text-3); margin-top: auto; }
    .empty { padding: 48px 24px; text-align: center; }
    .empty > i { font-size: 2rem; color: var(--y-ochre); margin-bottom: 12px; }
    .cta { margin-top: 40px; padding: 28px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; }
    .cta h2 { font-size: 1.4rem; margin-bottom: 4px; }
    .cta p { margin: 0; }
  `,
})
export class ContributorsPage {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  private i18n = inject(I18nService);
  readonly list = signal<Contributor[]>([]);
  readonly loading = signal(true);
  readonly total = computed(() => this.list().reduce((a, c) => a + c.approved, 0));
  readonly regions = computed(() => new Set(this.list().map((c) => c.region).filter(Boolean)).size);

  constructor() {
    this.data.contributors().subscribe((l) => {
      this.list.set(l);
      this.loading.set(false);
    });
  }

  title(slug: string) {
    const t = this.data.tale(slug);
    return t ? taleText(t, this.i18n.lang()).title : slug;
  }

  initials(name: string) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
  }
}
