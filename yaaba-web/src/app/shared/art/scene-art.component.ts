import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Art } from '../../core/models';
import { renderArt } from './scene-art';

/** Affiche une scène illustrée animée, avec léger effet de parallaxe au survol. */
@Component({
  selector: 'app-scene-art',
  template: `<div class="art" [class.static]="!animate()" [innerHTML]="svg()"></div>`,
  styleUrl: './scene-art.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(pointermove)': 'move($event)',
    '(pointerleave)': 'reset()',
  },
})
export class SceneArtComponent {
  private sanitizer = inject(DomSanitizer);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly art = input.required<Art>();
  readonly animate = input(true);
  readonly enter = input(false);
  readonly parallax = input(false);
  /** mode film (lecteur) : numéro de la scène */
  readonly cinema = input<number | undefined>(undefined);

  readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(renderArt(this.art(), { animate: this.animate(), enter: this.enter(), cinema: this.cinema() })),
  );

  move(e: PointerEvent) {
    if (!this.parallax() || e.pointerType !== 'mouse') return;
    const r = this.el.nativeElement.getBoundingClientRect();
    this.el.nativeElement.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    this.el.nativeElement.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  }

  reset() {
    this.el.nativeElement.style.setProperty('--px', '0');
    this.el.nativeElement.style.setProperty('--py', '0');
  }
}
