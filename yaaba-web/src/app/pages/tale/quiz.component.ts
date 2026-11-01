import { Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { QuizItem } from '../../core/models';

@Component({
  selector: 'app-quiz',
  imports: [TranslatePipe],
  template: `
    <div class="quiz card">
      @if (!finished()) {
        <div class="q-head">
          <span class="chip chip-yellow"><i class="fa-solid fa-circle-question"></i> {{ 'quiz.title' | t }}</span>
          <span class="count">{{ index() + 1 }} / {{ items().length }}</span>
        </div>
        <h3>{{ i18n.tx(current().q, lang()) }}</h3>
        <div class="opts" role="radiogroup">
          @for (o of current().options; track $index) {
            <button
              type="button"
              role="radio"
              [attr.aria-checked]="picked() === $index"
              [disabled]="picked() !== null"
              [class.good]="picked() !== null && $index === current().answer"
              [class.bad]="picked() === $index && $index !== current().answer"
              (click)="pick($index)"
            >
              <span class="letter">{{ 'ABC'[$index] }}</span>
              {{ i18n.tx(o, lang()) }}
              @if (picked() !== null && $index === current().answer) {
                <i class="fa-solid fa-check"></i>
              }
            </button>
          }
        </div>
        @if (picked() !== null) {
          <div class="feedback" [class.ok]="picked() === current().answer">
            <i class="fa-solid" [class.fa-face-smile]="picked() === current().answer" [class.fa-lightbulb]="picked() !== current().answer"></i>
            {{ (picked() === current().answer ? 'quiz.right' : 'quiz.wrong') | t }}
            <button type="button" class="btn btn-sm" (click)="next()">
              {{ (index() < items().length - 1 ? 'quiz.next' : 'quiz.finish') | t }}
              <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        }
      } @else {
        <div class="result">
          <div class="score" [class.perfect]="score() === items().length">
            <strong>{{ score() }}</strong><span>/ {{ items().length }}</span>
          </div>
          <h3>{{ (score() === items().length ? 'quiz.perfect' : score() > 0 ? 'quiz.good' : 'quiz.retryText') | t }}</h3>
          <button type="button" class="btn btn-ghost btn-sm" (click)="restart()"><i class="fa-solid fa-rotate"></i> {{ 'quiz.retry' | t }}</button>
        </div>
      }
    </div>
  `,
  styles: `
    .quiz { padding: 28px; }
    .q-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .count { font-size: 0.82rem; font-weight: 600; color: var(--text-3); }
    h3 { font-size: 1.3rem; margin-bottom: 18px; }
    .opts { display: grid; gap: 10px; }
    .opts button {
      display: flex; align-items: center; gap: 14px; width: 100%;
      padding: 14px 16px; border: 1.5px solid var(--border); border-radius: 12px;
      background: var(--surface); color: var(--text); font-weight: 500; text-align: left; cursor: pointer;
      transition: border-color 0.2s, background-color 0.2s, transform 0.2s;
    }
    .opts button:hover:not(:disabled) { border-color: var(--text); transform: translateX(3px); }
    .opts button:disabled { cursor: default; }
    .opts button i { margin-left: auto; }
    .letter { flex: none; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; background: var(--surface-2); font-weight: 700; font-size: 0.82rem; }
    .good { border-color: var(--y-green) !important; background: var(--y-green-soft) !important; color: var(--y-green-ink) !important; }
    .good .letter { background: var(--y-green); color: #fff; }
    .bad { border-color: var(--y-red) !important; background: var(--y-red-soft) !important; }
    .feedback { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 18px; padding: 12px 14px; border-radius: 12px; background: var(--y-yellow-soft); color: var(--y-yellow-ink); font-weight: 600; animation: reveal 0.4s var(--ease) both; }
    .feedback.ok { background: var(--y-green-soft); color: var(--y-green-ink); }
    .feedback .btn { margin-left: auto; }
    .result { text-align: center; padding: 12px 0; }
    .score { display: inline-flex; align-items: baseline; gap: 6px; font-family: var(--font-display); margin-bottom: 8px; }
    .score strong { font-size: 3.6rem; line-height: 1; color: var(--y-red); }
    .score.perfect strong { color: var(--y-green); }
    .score span { font-size: 1.4rem; color: var(--text-3); }
  `,
})
export class QuizComponent {
  readonly i18n = inject(I18nService);
  readonly items = input.required<QuizItem[]>();
  readonly lang = input('fr');
  readonly done = output<number>();

  readonly index = signal(0);
  readonly picked = signal<number | null>(null);
  readonly score = signal(0);
  readonly finished = signal(false);
  readonly current = computed(() => this.items()[this.index()]);

  pick(i: number) {
    this.picked.set(i);
    if (i === this.current().answer) this.score.update((s) => s + 1);
  }

  next() {
    if (this.index() < this.items().length - 1) {
      this.index.update((i) => i + 1);
      this.picked.set(null);
    } else {
      this.finished.set(true);
      this.done.emit(this.score());
    }
  }

  restart() {
    this.index.set(0);
    this.picked.set(null);
    this.score.set(0);
    this.finished.set(false);
  }
}
