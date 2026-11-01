import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '../../core/i18n.service';
import { TourService } from './tour.service';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-tour',
  imports: [TranslatePipe],
  template: `
    @if (tour.step(); as step) {
      <div class="veil" [class.no-target]="!box()" (click)="tour.end()"></div>
      @if (box(); as b) {
        <div class="spot" [style.top.px]="b.top - 8" [style.left.px]="b.left - 8" [style.width.px]="b.width + 16" [style.height.px]="b.height + 16"></div>
      }
      <div
        #card
        class="card"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="step.title | t"
        tabindex="-1"
        [class.centered]="!box()"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        (keydown.escape)="tour.end()"
        (keydown.arrowRight)="tour.next()"
        (keydown.arrowLeft)="tour.prev()"
      >
        <div class="head">
          @if (step.icon) {
            <span class="ico"><i class="fa-solid {{ step.icon }}"></i></span>
          }
          <span class="count">{{ tour.index() + 1 }} / {{ tour.steps().length }}</span>
          <button type="button" class="close" (click)="tour.end()" [attr.aria-label]="'tour.skip' | t"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <h3>{{ step.title | t }}</h3>
        <p>{{ step.text | t }}</p>
        <div class="progress">
          @for (s of tour.steps(); track $index) {
            <span [class.on]="$index <= tour.index()"></span>
          }
        </div>
        <div class="foot">
          <button type="button" class="btn btn-ghost btn-sm" (click)="tour.end()">{{ 'tour.skip' | t }}</button>
          <span class="grow"></span>
          @if (tour.index() > 0) {
            <button type="button" class="btn btn-ghost btn-sm btn-icon" (click)="tour.prev()" [attr.aria-label]="'tour.prev' | t">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
          }
          <button type="button" class="btn btn-sm" (click)="tour.next()">
            {{ (tour.index() === tour.steps().length - 1 ? 'tour.done' : 'tour.next') | t }}
            <i class="fa-solid" [class.fa-arrow-right]="tour.index() < tour.steps().length - 1" [class.fa-check]="tour.index() === tour.steps().length - 1"></i>
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: './tour.component.scss',
})
export class TourComponent {
  readonly tour = inject(TourService);
  readonly box = signal<Box | null>(null);
  readonly pos = signal({ top: 0, left: 0 });
  private card = viewChild<ElementRef<HTMLElement>>('card');
  private raf = 0;

  constructor() {
    effect(() => {
      const step = this.tour.step();
      cancelAnimationFrame(this.raf);
      if (!step) return;
      const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const loop = () => {
        this.measure(el);
        this.raf = requestAnimationFrame(loop);
      };
      loop();
      setTimeout(() => this.card()?.nativeElement.focus(), 50);
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.raf));
  }

  private measure(el: HTMLElement | null) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cw = Math.min(360, vw - 32);
    const ch = this.card()?.nativeElement.offsetHeight ?? 220;
    if (!el || !el.offsetParent) {
      this.box.set(null);
      this.pos.set({ top: Math.max(16, (vh - ch) / 2), left: (vw - cw) / 2 });
      return;
    }
    const r = el.getBoundingClientRect();
    const b = { top: r.top, left: r.left, width: r.width, height: r.height };
    const prev = this.box();
    if (!prev || prev.top !== b.top || prev.left !== b.left || prev.width !== b.width || prev.height !== b.height) this.box.set(b);

    let top = r.bottom + 18;
    if (top + ch > vh - 16) top = r.top - ch - 18;
    if (top < 16) top = Math.min(vh - ch - 16, Math.max(16, r.top + r.height / 2 - ch / 2));
    let left = r.left + r.width / 2 - cw / 2;
    if (r.width > vw * 0.6) left = (vw - cw) / 2;
    left = Math.max(16, Math.min(vw - cw - 16, left));
    const p = this.pos();
    if (p.top !== top || p.left !== left) this.pos.set({ top, left });
  }
}
