import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { DataService } from '../../core/data.service';
import { TranslatePipe } from '../../core/i18n.service';
import { AdminService, AdminTaleRow } from './admin.service';
import { LazyList } from './lazy-list';

/** Liste des contes : pagination, recherche et tri côté serveur (du plus récent au plus ancien). */
@Component({
  selector: 'app-admin-tales',
  imports: [RouterLink, TranslatePipe, TableModule, ConfirmDialogModule, DatePipe],
  providers: [ConfirmationService],
  template: `
    <header class="ph">
      <div>
        <h1>{{ 'admin.nav.tales' | t }}</h1>
        <p class="muted">{{ 'admin.talesLead' | t }}</p>
      </div>
      <a routerLink="/admin/contes/nouveau" class="btn"><i class="fa-solid fa-plus"></i> {{ 'admin.newTale' | t }}</a>
    </header>

    <div class="toolbar">
      <span class="search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input type="search" #s (input)="list.search(s.value)" placeholder="Titre, lieu, peuple, région…" aria-label="Rechercher un conte" />
      </span>
      <div class="seg" role="group" aria-label="Origine">
        @for (o of origins; track o) {
          <button type="button" [class.on]="(list.filters()['origin'] ?? 'all') === o" [attr.aria-pressed]="(list.filters()['origin'] ?? 'all') === o"
            (click)="list.setFilter('origin', o === 'all' ? undefined : o)">{{ 'admin.o.' + o | t }}</button>
        }
      </div>
      <span class="grow"></span>
      <span class="muted" aria-live="polite">{{ list.total() }} conte(s)</span>
    </div>

    <p-table class="ktable" [value]="list.items()" [lazy]="true" (onLazyLoad)="list.onLazy($event)" [loading]="list.loading()"
      [paginator]="true" [rows]="list.rows()" [first]="list.first()" [totalRecords]="list.total()" paginatorPosition="bottom"
      [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} sur {totalRecords}" dataKey="slug"
      [tableStyle]="{ 'min-width': '880px' }" [scrollable]="true">
      <ng-template #header>
        <tr>
          <th pSortableColumn="title" style="min-width: 220px">{{ 'admin.c.title' | t }} <p-sortIcon field="title" /></th>
          <th pSortableColumn="region">{{ 'lib.region' | t }} <p-sortIcon field="region" /></th>
          <th>{{ 'admin.c.origin' | t }}</th>
          <th>{{ 'admin.c.langs' | t }}</th>
          <th pSortableColumn="views" class="num"><i class="fa-regular fa-eye" title="Lectures"></i> <p-sortIcon field="views" /></th>
          <th class="num"><i class="fa-regular fa-comment" title="Commentaires"></i></th>
          <th class="num"><i class="fa-solid fa-microphone-lines" title="Voix"></i></th>
          <th pSortableColumn="createdAt">Créé le <p-sortIcon field="createdAt" /></th>
          <th>{{ 'admin.c.status' | t }}</th>
          <th><span class="sr-only">Actions</span></th>
        </tr>
      </ng-template>
      <ng-template #body let-r>
        <tr>
          <td>
            <a class="t-title" [routerLink]="['/admin/contes', r.slug]">{{ r.title }}</a><br />
            <small>{{ 'type.' + r.type | t }} · {{ r.slug }}</small>
          </td>
          <td>{{ data.regionMap().get(r.region)?.name ?? r.region }}</td>
          <td><span class="chip" [class.chip-ochre]="r.origin === 'community'">{{ 'admin.o.' + r.origin | t }}</span></td>
          <td><small>{{ r.languages.join(' · ').toUpperCase() }}</small></td>
          <td class="num">{{ r.views }}</td>
          <td class="num">{{ r.comments }}</td>
          <td class="num">{{ r.audio }}</td>
          <td><small>{{ r.createdAt | date: 'dd/MM/yyyy' }}</small></td>
          <td>
            <label class="sw">
              <input type="checkbox" [checked]="r.published" (change)="toggle(r)" [disabled]="busy() === r.slug" [attr.aria-label]="'Publier ' + r.title" />
              <span></span>
              <small>{{ (r.published ? 'admin.published' : 'admin.hidden') | t }}</small>
            </label>
          </td>
          <td class="acts">
            <a class="ib" [routerLink]="['/contes', r.slug]" target="_blank" rel="noopener" [title]="'Voir (nouvel onglet)'"><i class="fa-solid fa-eye"></i></a>
            <a class="ib" [routerLink]="['/admin/contes', r.slug]" [title]="'admin.edit' | t"><i class="fa-solid fa-pen"></i></a>
            <button type="button" class="ib no" (click)="remove(r)" [disabled]="busy() === r.slug" [title]="'admin.delete' | t"><i class="fa-solid fa-trash-can"></i></button>
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr><td colspan="10" class="empty">{{ list.error() ? 'Le serveur ne répond pas.' : 'Aucun conte ne correspond à votre recherche.' }}</td></tr>
      </ng-template>
    </p-table>
    <p-confirmDialog />
  `,
  styleUrl: './admin-shared.scss',
  styles: `
    .acts { white-space: nowrap; }
    .acts .ib { display: inline-grid; place-items: center; margin-left: 4px; }
    .sw { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
    .sw input { position: absolute; opacity: 0; width: 0; height: 0; }
    .sw span { width: 34px; height: 20px; border-radius: 10px; background: var(--surface-3); position: relative; transition: background-color 0.2s; }
    .sw span::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
    .sw input:checked + span { background: var(--y-red); }
    .sw input:checked + span::after { transform: translateX(14px); }
    .sw input:focus-visible + span { outline: 3px solid var(--y-yellow); }
  `,
})
export class AdminTalesPage {
  private admin = inject(AdminService);
  readonly data = inject(DataService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  readonly list = new LazyList<AdminTaleRow>((q) => this.admin.tales(q));
  readonly origins = ['all', 'seed', 'admin', 'community'] as const;
  readonly busy = signal<string | null>(null);

  toggle(r: AdminTaleRow) {
    const v = !r.published;
    this.busy.set(r.slug);
    this.admin.publish(r.slug, v).subscribe({
      next: () => {
        this.busy.set(null);
        this.list.items.update((l) => l.map((x) => (x.slug === r.slug ? { ...x, published: v } : x)));
        this.toast.add({ severity: 'success', summary: v ? 'Conte publié' : 'Conte masqué', life: 2000 });
        void this.data.refreshTales();
      },
      error: () => {
        this.busy.set(null);
        this.list.load();
        this.toast.add({ severity: 'error', summary: 'Le statut n’a pas pu être modifié', life: 3500 });
      },
    });
  }

  remove(r: AdminTaleRow) {
    this.confirm.confirm({
      header: 'Supprimer ce conte ?',
      message: `« ${r.title} » et ses voix seront définitivement supprimés.`,
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.busy.set(r.slug);
        this.admin.deleteTale(r.slug).subscribe({
          next: () => {
            this.busy.set(null);
            this.toast.add({ severity: 'success', summary: 'Conte supprimé', life: 2500 });
            this.list.load();
            void this.data.refreshTales();
          },
          error: (e) => {
            this.busy.set(null);
            this.toast.add({ severity: 'error', summary: e?.error?.message ?? 'Le conte n’a pas pu être supprimé', life: 3500 });
          },
        });
      },
    });
  }
}
