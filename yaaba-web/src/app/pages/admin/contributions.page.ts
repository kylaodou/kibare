import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { Contribution } from '../../core/models';
import { NotificationsService } from '../../core/notifications.service';
import { taleText } from '../../shared/tale-card/tale-card.component';
import { AdminService } from './admin.service';

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

@Component({
  selector: 'app-admin-contributions',
  imports: [FormsModule, RouterLink, DatePipe, DialogModule, TranslatePipe],
  template: `
    <header class="ph">
      <div>
        <h1>{{ 'admin.nav.contributions' | t }}</h1>
        <p class="muted">{{ 'admin.contribLead' | t }}</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" (click)="load()"><i class="fa-solid fa-rotate"></i> {{ 'admin.refresh' | t }}</button>
    </header>

    <div class="tabs" role="tablist">
      @for (f of filters; track f) {
        <button type="button" role="tab" [class.on]="filter() === f" (click)="filter.set(f)">
          {{ 'admin.f.' + f | t }} <span class="n">{{ count(f) }}</span>
        </button>
      }
    </div>

    <div class="list">
      @for (c of shown(); track c.id) {
        <article class="c card" [attr.data-s]="c.status">
          <div class="c-head">
            <span class="f-ico"><i class="fa-solid" [class.fa-microphone-lines]="c.kind === 'voice'" [class.fa-feather-pointed]="c.kind === 'story'"></i></span>
            <div class="c-title">
              <strong>{{ title(c) }}</strong>
              <small>
                {{ (c.kind === 'voice' ? 'contrib.voice.title' : 'contrib.story.title') | t }}
                · {{ data.languageMap().get(c.language)?.name }} · {{ data.regionMap().get(c.region)?.name }}
                @if (c.taleType) {
                  · {{ 'type.' + c.taleType | t }}
                }
              </small>
            </div>
            <span class="chip" [class.chip-yellow]="c.status === 'PENDING'" [class.chip-green]="c.status === 'APPROVED'" [class.chip-red]="c.status === 'REJECTED'">{{ 'admin.s.' + c.status | t }}</span>
          </div>
          <div class="c-meta">
            <span><i class="fa-regular fa-user"></i> {{ c.authorName }}</span>
            @if (c.authorEmail) {
              <span><i class="fa-regular fa-envelope"></i> {{ c.authorEmail }}</span>
            }
            <span><i class="fa-regular fa-clock"></i> {{ c.createdAt | date: 'd MMM y, HH:mm' }}</span>
          </div>
          @if (c.summary) {
            <p class="sum">{{ c.summary }}</p>
          }
          @if (c.text) {
            <button type="button" class="read" (click)="reading.set(c)"><i class="fa-solid fa-book-open"></i> {{ 'admin.readText' | t }} ({{ c.text.length }} {{ 'admin.chars' | t }})</button>
          }
          @if (c.segments?.length) {
            <ol class="segs">
              @for (u of c.segments; track u; let i = $index) {
                <li><span>§ {{ i + 1 }}</span><audio [src]="data.mediaUrl(u)" controls preload="none"></audio></li>
              }
            </ol>
          } @else if (c.audioUrl) {
            <audio [src]="data.mediaUrl(c.audioUrl)" controls preload="none"></audio>
          }
          @if (c.reviewNote) {
            <p class="note"><i class="fa-solid fa-quote-left"></i> {{ c.reviewNote }}</p>
          }
          <div class="c-actions">
            @if (c.status !== 'APPROVED') {
              <button type="button" class="btn btn-green btn-sm" (click)="decide(c, 'approve')"><i class="fa-solid fa-check"></i> {{ 'admin.approve' | t }}</button>
            }
            @if (c.status !== 'REJECTED') {
              <button type="button" class="btn btn-ghost btn-sm" (click)="decide(c, 'reject')"><i class="fa-solid fa-ban"></i> {{ 'admin.reject' | t }}</button>
            }
            @if (c.status === 'APPROVED' && (c.publishedSlug || c.taleSlug)) {
              <a class="btn btn-ghost btn-sm" [routerLink]="['/contes', c.publishedSlug || c.taleSlug]"><i class="fa-solid fa-eye"></i> {{ 'admin.open' | t }}</a>
            }
            @if (c.publishedSlug) {
              <a class="btn btn-ghost btn-sm" [routerLink]="['/admin/contes', c.publishedSlug]"><i class="fa-solid fa-pen"></i> {{ 'admin.edit' | t }}</a>
            }
            <span class="grow"></span>
            <button type="button" class="ib no" (click)="remove(c)" [attr.aria-label]="'admin.delete' | t" [title]="'admin.delete' | t"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </article>
      } @empty {
        <div class="card block empty">
          <i class="fa-solid fa-inbox"></i>
          <p>{{ 'admin.empty' | t }}</p>
        </div>
      }
    </div>

    <p-dialog [visible]="!!deciding()" (visibleChange)="!$event && deciding.set(null)" [modal]="true" [style]="{ width: 'min(520px, 94vw)' }"
      [header]="(action() === 'approve' ? 'admin.approveTitle' : 'admin.rejectTitle') | t">
      <p class="muted">{{ (action() === 'approve' ? 'admin.approveText' : 'admin.rejectText') | t }}</p>
      <label class="field">
        <span>{{ 'admin.note' | t }}</span>
        <textarea rows="3" maxlength="500" [ngModel]="note()" (ngModelChange)="note.set($event)" [placeholder]="'admin.notePh' | t"></textarea>
      </label>
      <ng-template #footer>
        <button type="button" class="btn btn-ghost btn-sm" (click)="deciding.set(null)">{{ 'pass.resetNo' | t }}</button>
        <button type="button" class="btn btn-sm" [class.btn-green]="action() === 'approve'" (click)="confirm()">
          {{ (action() === 'approve' ? 'admin.approve' : 'admin.reject') | t }}
        </button>
      </ng-template>
    </p-dialog>

    <p-dialog [visible]="!!reading()" (visibleChange)="!$event && reading.set(null)" [modal]="true" [style]="{ width: 'min(760px, 94vw)' }" [header]="reading()?.title ?? ''">
      @if (reading(); as r) {
        @if (r.moral) {
          <p class="note"><strong>{{ 'contrib.moral' | t }} :</strong> {{ r.moral }}</p>
        }
        <div class="fulltext">{{ r.text }}</div>
      }
    </p-dialog>
  `,
  styleUrl: './admin-shared.scss',
  styles: `
    .list { display: grid; gap: 14px; }
    .c { padding: 18px 20px; display: grid; gap: 10px; }
    .segs { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .segs li { display: flex; align-items: center; gap: 10px; }
    .segs span { flex: none; width: 34px; font-weight: 700; color: var(--y-red); font-size: 0.85rem; }
    .segs audio { height: 36px; width: 100%; max-width: 420px; }
    .c-head { display: flex; align-items: center; gap: 12px; }
    .c-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .c-title small { color: var(--text-3); }
    .c-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 0.84rem; color: var(--text-2); }
    .c-meta i { color: var(--y-ochre); margin-right: 4px; }
    .sum { margin: 0; color: var(--text-2); }
    .read { justify-self: start; border: 0; background: none; color: var(--y-red); font-weight: 700; cursor: pointer; padding: 0; }
    audio { height: 36px; max-width: 360px; }
    .note { margin: 0; padding: 10px 12px; background: var(--y-ochre-soft); border-radius: 6px; font-size: 0.9rem; }
    .c-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .grow { flex: 1; }
    .empty { text-align: center; color: var(--text-3); }
    .empty i { font-size: 1.8rem; color: var(--y-ochre); }
    .fulltext { white-space: pre-line; line-height: 1.75; max-height: 60vh; overflow-y: auto; }
  `,
})
export class AdminContributionsPage {
  private admin = inject(AdminService);
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  private toast = inject(MessageService);
  private notifs = inject(NotificationsService);

  readonly items = signal<Contribution[]>([]);
  readonly filter = signal<Filter>('PENDING');
  readonly filters: Filter[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];
  readonly deciding = signal<Contribution | null>(null);
  readonly action = signal<'approve' | 'reject'>('approve');
  readonly note = signal('');
  readonly reading = signal<Contribution | null>(null);

  readonly shown = computed(() => (this.filter() === 'ALL' ? this.items() : this.items().filter((c) => c.status === this.filter())));

  constructor() {
    this.load();
  }

  load() {
    this.admin.contributions().subscribe({ next: (l) => this.items.set(l), error: () => {} });
    void this.notifs.markAll();
  }

  count(f: Filter) {
    return f === 'ALL' ? this.items().length : this.items().filter((c) => c.status === f).length;
  }

  title(c: Contribution) {
    const t = c.taleSlug ? this.data.tale(c.taleSlug) : undefined;
    return t ? taleText(t, this.i18n.lang()).title : c.title;
  }

  decide(c: Contribution, a: 'approve' | 'reject') {
    this.action.set(a);
    this.note.set('');
    this.deciding.set(c);
  }

  confirm() {
    const c = this.deciding()!;
    const call = this.action() === 'approve' ? this.admin.approve(c.id, this.note()) : this.admin.reject(c.id, this.note());
    call.subscribe({
      next: (u) => {
        this.items.update((l) => l.map((x) => (x.id === u.id ? u : x)));
        this.toast.add({ severity: this.action() === 'approve' ? 'success' : 'info', summary: this.i18n.t('admin.' + this.action() + 'd'), detail: this.i18n.t('admin.authorNotified'), life: 3000 });
        this.deciding.set(null);
        if (u.publishedSlug) void this.data.refreshTales();
      },
      error: () => this.toast.add({ severity: 'error', summary: this.i18n.t('admin.error'), life: 3000 }),
    });
  }

  remove(c: Contribution) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.admin.deleteContribution(c.id).subscribe(() => this.items.update((l) => l.filter((x) => x.id !== c.id)));
  }
}
