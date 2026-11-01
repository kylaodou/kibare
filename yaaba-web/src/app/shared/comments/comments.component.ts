import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { CommentItem } from '../../core/models';

interface Thread {
  c: CommentItem;
  replies: CommentItem[];
}

/** Espace de discussion d'un conte : commentaires, réponses, suppression de ses propres messages. */
@Component({
  selector: 'app-comments',
  imports: [FormsModule, RouterLink, DatePipe, NgTemplateOutlet, TranslatePipe],
  template: `
    <section class="comments" id="commentaires">
      <h2><i class="fa-regular fa-comments"></i> {{ 'comments.title' | t }} <span class="n">{{ items().length }}</span></h2>
      <p class="muted">{{ 'comments.lead' | t }}</p>

      @if (!data.online()) {
        <p class="info"><i class="fa-solid fa-plug-circle-xmark"></i> {{ 'comments.offline' | t }}</p>
      } @else if (auth.user(); as u) {
        <form class="composer" (ngSubmit)="post()">
          <span class="av">{{ u.name.slice(0, 1).toUpperCase() }}</span>
          <div class="cbox">
            @if (replyTo(); as r) {
              <p class="replying"><i class="fa-solid fa-reply"></i> {{ 'comments.replyTo' | t: { name: r.userName } }} <button type="button" (click)="replyTo.set(null)">×</button></p>
            }
            <textarea name="text" rows="3" maxlength="2000" [ngModel]="text()" (ngModelChange)="text.set($event)" [placeholder]="'comments.ph' | t"></textarea>
            <div class="c-foot">
              <small>{{ text().length }}/2000</small>
              <button type="submit" class="btn btn-sm" [disabled]="text().trim().length < 2 || busy()"><i class="fa-solid fa-paper-plane"></i> {{ 'comments.send' | t }}</button>
            </div>
          </div>
        </form>
      } @else {
        <div class="login card">
          <p>{{ 'comments.login' | t }}</p>
          <a class="btn btn-sm" routerLink="/connexion" [queryParams]="{ retour: returnUrl() }">{{ 'nav.login' | t }}</a>
          <a class="btn btn-ghost btn-sm" routerLink="/inscription" [queryParams]="{ retour: returnUrl() }">{{ 'auth.register' | t }}</a>
        </div>
      }

      <ul class="threads">
        @for (th of threads(); track th.c.id) {
          <li>
            <ng-container *ngTemplateOutlet="one; context: { $implicit: th.c }" />
            @if (th.replies.length) {
              <ul class="replies">
                @for (r of th.replies; track r.id) {
                  <li><ng-container *ngTemplateOutlet="one; context: { $implicit: r }" /></li>
                }
              </ul>
            }
          </li>
        } @empty {
          <li class="empty">{{ 'comments.empty' | t }}</li>
        }
      </ul>

      <ng-template #one let-c>
        <article class="msg">
          <span class="av" [class.admin]="c.admin">{{ c.userName.slice(0, 1).toUpperCase() }}</span>
          <div class="m-body">
            <header>
              <strong>{{ c.userName }}</strong>
              @if (c.admin) {
                <span class="chip chip-ochre">{{ 'comments.team' | t }}</span>
              }
              <time>{{ c.createdAt | date: 'd MMM y, HH:mm' }}</time>
            </header>
            <p>{{ c.text }}</p>
            <div class="m-actions">
              @if (auth.loggedIn() && !c.parentId) {
                <button type="button" (click)="reply(c)"><i class="fa-solid fa-reply"></i> {{ 'comments.reply' | t }}</button>
              }
              @if (auth.user()?.id === c.userId || auth.isAdmin()) {
                <button type="button" (click)="remove(c)"><i class="fa-regular fa-trash-can"></i> {{ 'admin.delete' | t }}</button>
              }
            </div>
          </div>
        </article>
      </ng-template>
    </section>
  `,
  styles: `
    .comments { margin-top: 56px; padding-top: 32px; border-top: 1px solid var(--border); scroll-margin-top: calc(var(--header-h) + 20px); }
    h2 { display: flex; align-items: center; gap: 10px; font-size: 1.4rem; }
    h2 i { color: var(--y-ochre); }
    .n { padding: 0 9px; border-radius: 12px; background: var(--surface-2); font-size: 0.85rem; }
    .info { padding: 12px 14px; border-radius: 8px; background: var(--y-yellow-soft); color: var(--y-yellow-ink); }
    .composer { display: flex; gap: 12px; margin: 18px 0 28px; }
    .cbox { flex: 1; }
    textarea { width: 100%; padding: 12px 14px; border: 1.5px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font: inherit; resize: vertical; outline: none; }
    textarea:focus { border-color: var(--y-red); }
    .c-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .c-foot small { color: var(--text-3); }
    .replying { margin: 0 0 8px; font-size: 0.85rem; color: var(--text-2); }
    .replying button { border: 0; background: none; font-size: 1.1rem; cursor: pointer; color: var(--text-3); }
    .login { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 18px; margin: 18px 0 28px; }
    .login p { margin: 0 auto 0 0; }
    .threads, .replies { list-style: none; margin: 0; padding: 0; }
    .threads > li { padding: 16px 0; border-bottom: 1px solid var(--border); }
    .replies { margin: 12px 0 0 52px; display: grid; gap: 12px; }
    .msg { display: flex; gap: 12px; }
    .av { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-3); color: var(--text); font-family: var(--font-display); font-weight: 800; }
    .av.admin { background: var(--y-red); color: #fff; }
    .m-body { flex: 1; min-width: 0; }
    .m-body header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .m-body time { font-size: 0.8rem; color: var(--text-3); }
    .m-body p { margin: 4px 0 6px; white-space: pre-line; }
    .m-actions { display: flex; gap: 14px; }
    .m-actions button { border: 0; background: none; padding: 0; font-size: 0.82rem; font-weight: 700; color: var(--text-3); cursor: pointer; }
    .m-actions button:hover { color: var(--y-red); }
    .empty { color: var(--text-3); padding: 12px 0; }
  `,
})
export class CommentsComponent {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  private i18n = inject(I18nService);
  private toast = inject(MessageService);

  readonly slug = input.required<string>();
  readonly items = signal<CommentItem[]>([]);
  readonly text = signal('');
  readonly busy = signal(false);
  readonly replyTo = signal<CommentItem | null>(null);
  readonly returnUrl = computed(() => `/contes/${this.slug()}#commentaires`);

  readonly threads = computed<Thread[]>(() => {
    const all = this.items();
    return all
      .filter((c) => !c.parentId)
      .map((c) => ({ c, replies: all.filter((r) => r.parentId === c.id) }))
      .reverse();
  });

  constructor() {
    effect(() => {
      const s = this.slug();
      if (this.data.online()) this.data.comments(s).subscribe((l) => this.items.set(l));
    });
  }

  reply(c: CommentItem) {
    this.replyTo.set(c);
    document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
  }

  post() {
    const t = this.text().trim();
    if (t.length < 2) return;
    this.busy.set(true);
    this.data.addComment(this.slug(), t, this.replyTo()?.id).subscribe({
      next: (c) => {
        this.items.update((l) => [...l, c]);
        this.text.set('');
        this.replyTo.set(null);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.toast.add({ severity: 'error', summary: AuthService.message(e, this.i18n.t('admin.error')), life: 3000 });
      },
    });
  }

  remove(c: CommentItem) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.data.deleteComment(c.id).subscribe(() => this.items.update((l) => l.filter((x) => x.id !== c.id && x.parentId !== c.id)));
  }
}
