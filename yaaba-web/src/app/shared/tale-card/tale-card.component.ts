import { HeartBurstComponent } from '../heart-burst/heart-burst.component';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { Tale, TaleText } from '../../core/models';
import { ProgressService } from '../../core/progress.service';
import { SceneArtComponent } from '../art/scene-art.component';

export const TYPE_ICON: Record<string, string> = {
  conte: 'fa-feather-pointed',
  legende: 'fa-star',
  recit: 'fa-landmark',
};

export function taleText(tale: Tale, lang: string): TaleText {
  return tale.i18n[lang] ?? tale.i18n['fr'];
}

@Component({
  selector: 'app-tale-card',
  imports: [RouterLink, SceneArtComponent, TranslatePipe, HeartBurstComponent],
  template: `
    <article class="card card-tale" [class.compact]="compact()" (pointerenter)="hover.set(true)" (pointerleave)="hover.set(false)">
      <a [routerLink]="['/contes', tale().slug]" class="cover" [attr.aria-label]="text().title" tabindex="-1">
        <app-scene-art [art]="cover()" [animate]="hover()" />
        <span class="type chip">
          <i class="fa-solid {{ icon() }}"></i>
          {{ 'type.' + tale().type | t }}
        </span>
        @if (status() === 'done') {
          <span class="done" [attr.title]="'card.done' | t"><i class="fa-solid fa-check"></i></span>
        }
        @if (status() === 'progress') {
          <span class="bar"><span [style.width.%]="progress()"></span></span>
        }
      </a>
      <div class="body">
        <div class="meta">
          <span><i class="fa-solid fa-location-dot"></i> {{ region() }}</span>
          <span><i class="fa-regular fa-clock"></i> {{ tale().duration }} min</span>
        </div>
        <h3>
          <a [routerLink]="['/contes', tale().slug]">{{ text().title }}</a>
        </h3>
        @if (!compact()) {
          <p>{{ text().subtitle }}</p>
        }
        <div class="foot">
          <span class="people">{{ tale().people }}</span>
          <span class="acts">
            <button type="button" class="fav share" (click)="share()" [attr.aria-label]="'tale.share' | t" [title]="'tale.share' | t">
              <i class="fa-solid" [class.fa-share-nodes]="!copied()" [class.fa-check]="copied()"></i>
            </button>
            <button
              type="button"
              class="fav"
              [class.on]="favorite()"
              [class.spin]="burst() > 0 && favorite()"
              (click)="like()"
              [attr.aria-pressed]="favorite()"
              [attr.aria-label]="(favorite() ? 'card.unfav' : 'card.fav') | t"
            >
              @for (k of [burst()]; track k) {
                <i class="fa-heart" [class.fa-solid]="favorite()" [class.fa-regular]="!favorite()"></i>
              }
              <app-heart-burst [trigger]="burst()" />
            </button>
          </span>
        </div>
      </div>
    </article>
  `,
  styleUrl: './tale-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaleCardComponent {
  private i18n = inject(I18nService);
  private data = inject(DataService);
  readonly progressSvc = inject(ProgressService);
  /** déclenche l'éclat de cœurs à chaque « j'aime » */
  readonly burst = signal(0);
  readonly copied = signal(false);

  like() {
    const slug = this.tale().slug;
    const liked = !this.progressSvc.favorites().has(slug);
    this.progressSvc.toggleFavorite(slug);
    if (liked) this.burst.update((n) => n + 1);
  }

  /** Partage natif quand il existe, sinon copie du lien. */
  async share() {
    const url = `${location.origin}/contes/${this.tale().slug}`;
    const title = this.text().title;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: this.text().summary, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1600);
    } catch {}
  }

  readonly tale = input.required<Tale>();
  readonly compact = input(false);
  readonly hover = signal(false);

  readonly text = computed(() => taleText(this.tale(), this.i18n.lang()));
  readonly cover = computed(() => this.tale().scenes[this.tale().cover ?? 0].art);
  readonly icon = computed(() => TYPE_ICON[this.tale().type]);
  readonly region = computed(() => this.data.regionMap().get(this.tale().region)?.name ?? '');
  readonly favorite = computed(() => this.progressSvc.favorites().has(this.tale().slug));
  readonly status = computed(() => {
    const p = this.progressSvc.state().tales[this.tale().slug];
    if (!p) return 'new';
    return p.completed ? 'done' : p.scene > 0 ? 'progress' : 'new';
  });
  readonly progress = computed(() => {
    const p = this.progressSvc.state().tales[this.tale().slug];
    return p ? ((p.scene + 1) / this.tale().scenes.length) * 100 : 0;
  });
}
