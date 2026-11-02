import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input } from '@angular/core';
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
  /** élément nommé dans la phrase en cours : la caméra le cadre (null = plan large) */
  readonly focus = input<number | null>(null);

  readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(renderArt(this.art(), { animate: this.animate(), enter: this.enter(), cinema: this.cinema() })),
  );

  constructor() {
    // caméra synchronisée avec le texte : gros plan doux sur l'élément nommé, retour au plan large sinon
    effect(() => {
      const i = this.focus();
      this.svg();
      queueMicrotask(() => this.frame(i));
    });
  }

  private frame(i: number | null) {
    const root = this.el.nativeElement;
    const cam = root.querySelector<SVGGElement>('.kb, [class^="cam-"]');
    if (!cam) return;
    root.querySelectorAll('.fx.focus').forEach((n) => n.classList.remove('focus'));
    const item = i === null ? null : root.querySelector<SVGGElement>(`[data-i="${i}"]`);
    if (!item) {
      cam.style.transform = '';
      cam.classList.remove('framing');
      return;
    }
    const x = Number(item.dataset['x'] ?? 50);
    // l'animation de plan est suspendue ; on glisse vers l'élément puis il réagit
    cam.classList.add('framing');
    cam.style.transform = `scale(1.32) translate(${((50 - x) * 0.55).toFixed(1)}%, 2%)`;
    const fx = item.querySelector('.fx');
    if (fx) {
      fx.classList.remove('focus');
      void (fx as SVGGElement).getBoundingClientRect();
      fx.classList.add('focus');
    }
  }

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
