import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../core/i18n.service';
import { Art } from '../../core/models';
import { SceneArtComponent } from '../../shared/art/scene-art.component';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, SceneArtComponent, TranslatePipe],
  template: `
    <section class="container nf">
      <div class="art"><app-scene-art [art]="art" [enter]="true" /></div>
      <h1>{{ 'nf.title' | t }}</h1>
      <p class="lead">{{ 'nf.text' | t }}</p>
      <div class="row">
        <a routerLink="/" class="btn"><i class="fa-solid fa-house"></i> {{ 'nav.home' | t }}</a>
        <a routerLink="/carte" class="btn btn-ghost"><i class="fa-solid fa-map-location-dot"></i> {{ 'nav.map' | t }}</a>
      </div>
    </section>
  `,
  styles: `
    .nf { text-align: center; padding-block: 48px 80px; }
    .art { max-width: 560px; margin: 0 auto 32px; aspect-ratio: 16 / 10; border-radius: 24px; overflow: hidden; }
    .art app-scene-art { height: 100%; }
    .lead { margin-inline: auto; }
    .row { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
  `,
})
export class NotFoundPage {
  readonly art: Art = {
    sky: 'night',
    ground: 'savanna',
    items: [
      { k: 'moon', x: 78, y: 300 },
      { k: 'baobab', x: 24, y: 24 },
      { k: 'hare', x: 56, s: 1.6 },
      { k: 'grass', x: 70 },
    ],
  };
}
