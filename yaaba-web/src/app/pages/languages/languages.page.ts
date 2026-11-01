import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe, TxPipe } from '../../core/i18n.service';
import { MiniMapComponent } from '../../shared/mini-map/mini-map.component';
import { taleText } from '../../shared/tale-card/tale-card.component';

@Component({
  selector: 'app-languages',
  imports: [RouterLink, MiniMapComponent, TranslatePipe, TxPipe],
  template: `
    <section class="head">
      <div class="container">
        <span class="eyebrow">{{ 'langs.eyebrow' | t }}</span>
        <h1>{{ 'langs.title' | t }}</h1>
        <p class="lead">{{ 'langs.lead' | t }}</p>
      </div>
    </section>

    <section class="container layout">
      <div class="list">
        @for (l of national(); track l.code) {
          <article
            class="lang card"
            [id]="l.code"
            [class.on]="selected() === l.code"
            (mouseenter)="selected.set(l.code)"
            (focusin)="selected.set(l.code)"
            tabindex="0"
          >
            <header>
              <div>
                <h2>{{ l.name }}</h2>
                <span class="native">{{ l.native }} · {{ l.family }}</span>
              </div>
              <span class="chip chip-green">{{ l.speakers }}</span>
            </header>
            <p>{{ l.description | tx }}</p>
            @if (l.greeting || l.thanks) {
              <div class="phrases">
                @if (l.greeting; as g) {
                  <div class="phrase">
                    <span class="ph-word">{{ g.text }}</span>
                    <span class="ph-mean">{{ g.meaning | tx }}</span>
                  </div>
                }
                @if (l.thanks; as th) {
                  <div class="phrase">
                    <span class="ph-word">{{ th.text }}</span>
                    <span class="ph-mean">{{ th.meaning | tx }}</span>
                  </div>
                }
              </div>
            }
            <footer>
              <div class="regions">
                <i class="fa-solid fa-location-dot"></i>
                {{ regionNames(l.regions) }}
              </div>
              @if (talesIn(l.code).length) {
                <div class="tales">
                  @for (t of talesIn(l.code); track t.slug) {
                    <a [routerLink]="['/contes', t.slug]" class="tale-link">{{ title(t.slug) }}</a>
                  }
                </div>
              }
              <a class="rec" routerLink="/contribuer" [queryParams]="{ langue: l.code }">
                <i class="fa-solid fa-microphone-lines"></i> {{ 'langs.record' | t: { lang: l.name } }}
              </a>
            </footer>
          </article>
        }
      </div>
      <aside class="map-side">
        <div class="map-card card">
          <h3>{{ selectedLang()?.name }}</h3>
          <app-mini-map [highlight]="selectedLang()?.regions ?? []" [showLabels]="false" />
          <p class="legend"><span class="sw"></span> {{ 'langs.legend' | t }}</p>
        </div>
        <div class="note card">
          <i class="fa-solid fa-circle-info"></i>
          <p>{{ 'langs.note' | t }}</p>
        </div>
      </aside>
    </section>
  `,
  styleUrl: './languages.page.scss',
})
export class LanguagesPage {
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  readonly national = computed(() => this.data.languages().filter((l) => l.code !== 'fr' && l.code !== 'en'));
  readonly selected = signal('moore');
  readonly selectedLang = computed(() => this.data.languageMap().get(this.selected()));

  talesIn(code: string) {
    return this.data.tales().filter((t) => t.language === code);
  }

  title(slug: string) {
    const t = this.data.tale(slug);
    return t ? taleText(t, this.i18n.lang()).title : '';
  }

  regionNames(codes: string[]) {
    return codes.map((c) => this.data.regionMap().get(c)?.name).filter(Boolean).join(', ');
  }
}
