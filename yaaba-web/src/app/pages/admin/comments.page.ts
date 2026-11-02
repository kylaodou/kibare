import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { CommentItem } from '../../core/models';
import { taleText } from '../../shared/tale-card/tale-card.component';
import { AdminService } from './admin.service';
import { LazyList } from './lazy-list';

/** Modération des commentaires : pagination, recherche, tri et filtre côté serveur. */
@Component({
  selector: 'app-admin-comments',
  imports: [RouterLink, DatePipe, TranslatePipe, TableModule, ConfirmDialogModule],
  providers: [ConfirmationService],
  template: `
    <header class="ph">
      <div>
        <h1>{{ 'admin.nav.comments' | t }}</h1>
        <p class="muted">{{ 'admin.commentsLead' | t }}</p>
      </div>
    </header>
    <div class="toolbar">
      <span class="search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input type="search" #s (input)="list.search(s.value)" [placeholder]="'admin.searchComments' | t" aria-label="Rechercher un commentaire" />
      </span>
      <div class="seg" role="group" aria-label="Visibilité">
        @for (o of statuses; track o.v) {
          <button type="button" [class.on]="(list.filters()['status'] ?? 'ALL') === o.v" [attr.aria-pressed]="(list.filters()['status'] ?? 'ALL') === o.v"
            (click)="list.setFilter('status', o.v === 'ALL' ? undefined : o.v)">{{ o.k | t }}</button>
        }
      </div>
      <span class="grow"></span>
      <span class="muted" aria-live="polite">{{ list.total() }} commentaire(s)</span>
    </div>

    <p-table class="ktable" [value]="list.items()" [lazy]="true" (onLazyLoad)="list.onLazy($event)" [loading]="list.loading()"
      [paginator]="true" [rows]="list.rows()" [first]="list.first()" [totalRecords]="list.total()" paginatorPosition="bottom"
      [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} sur {totalRecords}" dataKey="id"
      [tableStyle]="{ 'min-width': '760px' }" [scrollable]="true">
      <ng-template #header>
        <tr>
          <th>{{ 'admin.c.author' | t }}</th>
          <th style="min-width: 240px">{{ 'admin.c.comment' | t }}</th>
          <th pSortableColumn="taleSlug">{{ 'admin.c.tale' | t }} <p-sortIcon field="taleSlug" /></th>
          <th pSortableColumn="createdAt">{{ 'admin.c.date' | t }} <p-sortIcon field="createdAt" /></th>
          <th><span class="sr-only">Actions</span></th>
        </tr>
      </ng-template>
      <ng-template #body let-c>
        <tr [class.dim]="c.status === 'HIDDEN'">
          <td><strong>{{ c.userName }}</strong>@if (c.parentId) {<br /><small><i class="fa-solid fa-reply"></i> {{ 'admin.reply' | t }}</small>}</td>
          <td class="txt">{{ c.text }}</td>
          <td><a [routerLink]="['/contes', c.taleSlug]" fragment="commentaires" target="_blank" rel="noopener" class="more small">{{ title(c.taleSlug) }}</a></td>
          <td><small>{{ c.createdAt | date: 'dd/MM/yyyy HH:mm' }}</small></td>
          <td class="acts">
            @if (c.status === 'VISIBLE') {
              <button type="button" class="ib" (click)="set(c, 'HIDDEN')" [disabled]="busy() === c.id" [title]="'admin.hide' | t"><i class="fa-solid fa-eye-slash"></i></button>
            } @else {
              <button type="button" class="ib ok" (click)="set(c, 'VISIBLE')" [disabled]="busy() === c.id" [title]="'admin.show' | t"><i class="fa-solid fa-eye"></i></button>
            }
            <button type="button" class="ib no" (click)="remove(c)" [disabled]="busy() === c.id" [title]="'admin.delete' | t"><i class="fa-solid fa-trash-can"></i></button>
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr><td colspan="5" class="empty">{{ list.error() ? 'Le serveur ne répond pas.' : ('admin.noComments' | t) }}</td></tr>
      </ng-template>
    </p-table>
    <p-confirmDialog />
  `,
  styleUrl: './admin-shared.scss',
  styles: `.txt { max-width: 480px; } .acts { white-space: nowrap; } .acts .ib { margin-left: 4px; } .dim td { opacity: 0.55; }`,
})
export class AdminCommentsPage {
  private admin = inject(AdminService);
  private data = inject(DataService);
  private i18n = inject(I18nService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  readonly list = new LazyList<CommentItem>((q) => this.admin.comments(q));
  readonly busy = signal<number | null>(null);
  readonly statuses = [
    { v: 'ALL', k: 'admin.f.ALL' },
    { v: 'VISIBLE', k: 'admin.visible' },
    { v: 'HIDDEN', k: 'admin.hidden' },
  ];

  title(slug: string) {
    const t = this.data.tale(slug);
    return t ? taleText(t, this.i18n.lang()).title : slug;
  }

  set(c: CommentItem, s: 'VISIBLE' | 'HIDDEN') {
    this.busy.set(c.id);
    this.admin.moderateComment(c.id, s).subscribe({
      next: () => {
        this.busy.set(null);
        this.list.load();
      },
      error: () => {
        this.busy.set(null);
        this.toast.add({ severity: 'error', summary: 'Le commentaire n’a pas pu être modifié', life: 3500 });
      },
    });
  }

  remove(c: CommentItem) {
    this.confirm.confirm({
      header: 'Supprimer ce commentaire ?',
      message: 'Le commentaire et ses réponses seront définitivement supprimés.',
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.busy.set(c.id);
        this.admin.deleteComment(c.id).subscribe({
          next: () => {
            this.busy.set(null);
            this.toast.add({ severity: 'success', summary: 'Commentaire supprimé', life: 2500 });
            this.list.load();
          },
          error: () => {
            this.busy.set(null);
            this.toast.add({ severity: 'error', summary: 'Le commentaire n’a pas pu être supprimé', life: 3500 });
          },
        });
      },
    });
  }
}
