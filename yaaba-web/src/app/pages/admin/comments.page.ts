import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { CommentItem } from '../../core/models';
import { taleText } from '../../shared/tale-card/tale-card.component';
import { AdminService } from './admin.service';

@Component({
  selector: 'app-admin-comments',
  imports: [FormsModule, RouterLink, DatePipe, TranslatePipe],
  template: `
    <header class="ph">
      <div>
        <h1>{{ 'admin.nav.comments' | t }}</h1>
        <p class="muted">{{ 'admin.commentsLead' | t }}</p>
      </div>
    </header>
    <div class="toolbar">
      <input type="search" [ngModel]="q()" (ngModelChange)="q.set($event)" [placeholder]="'admin.searchComments' | t" />
      <div class="seg" role="group">
        <button type="button" [class.on]="status() === 'ALL'" (click)="status.set('ALL')">{{ 'admin.f.ALL' | t }}</button>
        <button type="button" [class.on]="status() === 'VISIBLE'" (click)="status.set('VISIBLE')">{{ 'admin.visible' | t }}</button>
        <button type="button" [class.on]="status() === 'HIDDEN'" (click)="status.set('HIDDEN')">{{ 'admin.hidden' | t }}</button>
      </div>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr><th>{{ 'admin.c.author' | t }}</th><th>{{ 'admin.c.comment' | t }}</th><th>{{ 'admin.c.tale' | t }}</th><th>{{ 'admin.c.date' | t }}</th><th></th></tr>
        </thead>
        <tbody>
          @for (c of rows(); track c.id) {
            <tr [style.opacity]="c.status === 'HIDDEN' ? 0.55 : 1">
              <td><strong>{{ c.userName }}</strong>@if (c.parentId) {<br /><small><i class="fa-solid fa-reply"></i> {{ 'admin.reply' | t }}</small>}</td>
              <td class="txt">{{ c.text }}</td>
              <td><a [routerLink]="['/contes', c.taleSlug]" fragment="commentaires" class="more small">{{ title(c.taleSlug) }}</a></td>
              <td><small>{{ c.createdAt | date: 'd MMM y, HH:mm' }}</small></td>
              <td class="acts">
                @if (c.status === 'VISIBLE') {
                  <button type="button" class="ib" (click)="set(c, 'HIDDEN')" [title]="'admin.hide' | t"><i class="fa-solid fa-eye-slash"></i></button>
                } @else {
                  <button type="button" class="ib ok" (click)="set(c, 'VISIBLE')" [title]="'admin.show' | t"><i class="fa-solid fa-eye"></i></button>
                }
                <button type="button" class="ib no" (click)="remove(c)" [title]="'admin.delete' | t"><i class="fa-solid fa-trash-can"></i></button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="muted">{{ 'admin.empty' | t }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './admin-shared.scss',
  styles: `.txt { max-width: 480px; } .acts { white-space: nowrap; } .acts .ib { margin-left: 4px; }`,
})
export class AdminCommentsPage {
  private admin = inject(AdminService);
  private data = inject(DataService);
  private i18n = inject(I18nService);
  readonly items = signal<CommentItem[]>([]);
  readonly q = signal('');
  readonly status = signal<'ALL' | 'VISIBLE' | 'HIDDEN'>('ALL');
  readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return this.items().filter((c) => (this.status() === 'ALL' || c.status === this.status()) && (!q || c.text.toLowerCase().includes(q) || c.userName.toLowerCase().includes(q)));
  });

  constructor() {
    this.admin.comments().subscribe({ next: (l) => this.items.set(l), error: () => {} });
  }

  title(slug: string) {
    const t = this.data.tale(slug);
    return t ? taleText(t, this.i18n.lang()).title : slug;
  }

  set(c: CommentItem, s: 'VISIBLE' | 'HIDDEN') {
    this.admin.moderateComment(c.id, s).subscribe((u) => this.items.update((l) => l.map((x) => (x.id === u.id ? u : x))));
  }

  remove(c: CommentItem) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.admin.deleteComment(c.id).subscribe(() => this.items.update((l) => l.filter((x) => x.id !== c.id)));
  }
}
