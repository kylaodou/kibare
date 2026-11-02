import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { Contribution } from '../../core/models';
import { NotificationsService } from '../../core/notifications.service';
import { AudioPlayerComponent } from '../../shared/audio-player/audio-player.component';
import { AdminService } from './admin.service';
import { LazyList } from './lazy-list';

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

/**
 * Modération des contributions : onglets par statut (compteurs du serveur), recherche, tri et pagination côté serveur.
 * Chaque enregistrement est présenté avec le numéro et le texte exact du paragraphe auquel il est rattaché.
 */
@Component({
  selector: 'app-admin-contributions',
  imports: [FormsModule, RouterLink, DatePipe, DialogModule, ConfirmDialogModule, TableModule, TranslatePipe, AudioPlayerComponent],
  providers: [ConfirmationService],
  template: `
    <header class="ph">
      <div>
        <h1>{{ 'admin.nav.contributions' | t }}</h1>
        <p class="muted">{{ 'admin.contribLead' | t }}</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" (click)="list.load()" [disabled]="list.loading()">
        <i class="fa-solid fa-rotate" [class.fa-spin]="list.loading()"></i> {{ 'admin.refresh' | t }}
      </button>
    </header>

    <div class="tabs" role="tablist" aria-label="Statut des contributions">
      @for (f of filters; track f) {
        <button type="button" role="tab" [class.on]="filter() === f" [attr.aria-selected]="filter() === f" (click)="setFilter(f)">
          {{ 'admin.f.' + f | t }} <span class="n">{{ list.counts()[f] ?? 0 }}</span>
        </button>
      }
    </div>

    <div class="toolbar">
      <span class="search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input type="search" #s (input)="list.search(s.value)" placeholder="Titre, auteur, e-mail, conte…" aria-label="Rechercher une contribution" />
      </span>
      <span class="grow"></span>
      <span class="muted" aria-live="polite">{{ list.total() }} contribution(s)</span>
    </div>

    <p-table class="ktable" [value]="list.items()" [lazy]="true" (onLazyLoad)="list.onLazy($event)" [loading]="list.loading()"
      [paginator]="true" [rows]="list.rows()" [first]="list.first()" [totalRecords]="list.total()" paginatorPosition="bottom"
      [showCurrentPageReport]="true" currentPageReportTemplate="{first}–{last} sur {totalRecords}" dataKey="id"
      [expandedRowKeys]="expanded()" [tableStyle]="{ 'min-width': '820px' }" [scrollable]="true">
      <ng-template #header>
        <tr>
          <th style="width: 48px"><span class="sr-only">Détails</span></th>
          <th pSortableColumn="title" style="min-width: 220px">Contribution <p-sortIcon field="title" /></th>
          <th pSortableColumn="authorName">Auteur <p-sortIcon field="authorName" /></th>
          <th pSortableColumn="language">Langue <p-sortIcon field="language" /></th>
          <th pSortableColumn="createdAt">Reçue le <p-sortIcon field="createdAt" /></th>
          <th pSortableColumn="status">Statut <p-sortIcon field="status" /></th>
          <th><span class="sr-only">Actions</span></th>
        </tr>
      </ng-template>
      <ng-template #body let-c let-open="expanded">
        <tr>
          <td>
            <button type="button" class="ib" [pRowToggler]="c" [attr.aria-expanded]="open" [attr.aria-label]="open ? 'Masquer le détail' : 'Afficher le détail'">
              <i class="fa-solid" [class.fa-chevron-right]="!open" [class.fa-chevron-down]="open"></i>
            </button>
          </td>
          <td>
            <span class="c-title">
              <i class="fa-solid" [class.fa-microphone-lines]="c.kind === 'voice'" [class.fa-feather-pointed]="c.kind === 'story'" aria-hidden="true"></i>
              <strong>{{ c.title }}</strong>
            </span>
            <small>
              {{ (c.kind === 'voice' ? 'contrib.voice.title' : 'contrib.story.title') | t }}
              @if (c.recordings?.length) {
                · {{ c.recordings.length }} enregistrement(s)
              }
            </small>
          </td>
          <td>{{ c.authorName }}@if (c.authorEmail) {<br /><small>{{ c.authorEmail }}</small>}</td>
          <td>{{ data.languageMap().get(c.language)?.name ?? c.language }}</td>
          <td><small>{{ c.createdAt | date: 'dd/MM/yyyy HH:mm' }}</small></td>
          <td><span class="chip" [class.chip-yellow]="c.status === 'PENDING'" [class.chip-ochre]="c.status === 'APPROVED'" [class.chip-red]="c.status === 'REJECTED'">{{ 'admin.s.' + c.status | t }}</span></td>
          <td class="acts">
            @if (c.status === 'PENDING') {
              <button type="button" class="btn btn-sm" (click)="decide(c, 'approve')" [disabled]="busy() === c.id"><i class="fa-solid fa-check"></i> {{ 'admin.approve' | t }}</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="decide(c, 'reject')" [disabled]="busy() === c.id"><i class="fa-solid fa-ban"></i> {{ 'admin.reject' | t }}</button>
            } @else if (c.status === 'REJECTED') {
              <button type="button" class="btn btn-ghost btn-sm" (click)="decide(c, 'approve')" [disabled]="busy() === c.id"><i class="fa-solid fa-check"></i> {{ 'admin.approve' | t }}</button>
            }
            @if (c.status === 'APPROVED' && (c.publishedSlug || c.taleSlug)) {
              <a class="ib" [routerLink]="['/contes', c.publishedSlug || c.taleSlug]" target="_blank" rel="noopener" title="Voir le conte (nouvel onglet)"><i class="fa-solid fa-eye"></i></a>
            }
            <button type="button" class="ib no" (click)="remove(c)" [disabled]="busy() === c.id" [attr.aria-label]="'Supprimer la contribution ' + c.title" title="Supprimer">
              @if (busy() === c.id) {
                <i class="fa-solid fa-spinner fa-spin"></i>
              } @else {
                <i class="fa-solid fa-trash-can"></i>
              }
            </button>
          </td>
        </tr>
      </ng-template>
      <ng-template #expandedrow let-c>
        <tr>
          <td colspan="7" class="detail">
            <div class="d-meta">
              @if (c.taleSlug) {
                <span><i class="fa-solid fa-book-open"></i> Conte : <a [routerLink]="['/contes', c.taleSlug]" target="_blank" rel="noopener">{{ c.taleSlug }}</a></span>
              }
              <span><i class="fa-solid fa-location-dot"></i> {{ data.regionMap().get(c.region)?.name ?? c.region }}</span>
              @if (c.reviewedAt) {
                <span><i class="fa-regular fa-clock"></i> Décision le {{ c.reviewedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
              }
            </div>
            @if (c.summary) {
              <p class="sum">{{ c.summary }}</p>
            }
            @if (c.text) {
              <button type="button" class="read" (click)="reading.set(c)"><i class="fa-solid fa-book-open"></i> {{ 'admin.readText' | t }} ({{ c.text.length }} {{ 'admin.chars' | t }})</button>
            }
            @if (c.recordings?.length) {
              <ol class="recs">
                @for (r of c.recordings; track r.url) {
                  <li>
                    <div class="r-head">
                      @if (r.paragraph) {
                        <span class="pnum">Paragraphe {{ r.paragraph }}</span>
                      } @else {
                        <span class="pnum unk">Paragraphe introuvable</span>
                      }
                      @if (r.matchedBy === 'order') {
                        <small title="Ancienne contribution : rattachée selon l'ordre d'enregistrement">rattaché par ordre</small>
                      }
                    </div>
                    @if (r.text) {
                      <blockquote>{{ r.text }}</blockquote>
                    } @else {
                      <p class="missing"><i class="fa-solid fa-circle-info"></i> Texte du paragraphe indisponible (paragraphe supprimé ou modifié depuis l'enregistrement).</p>
                    }
                    <app-audio-player [src]="data.mediaUrl(r.url)" [label]="r.paragraph ? 'paragraphe ' + r.paragraph : ''" />
                  </li>
                }
              </ol>
            } @else if (c.audioUrl) {
              <app-audio-player [src]="data.mediaUrl(c.audioUrl)" label="enregistrement complet" />
            }
            @if (c.reviewNote) {
              <p class="note"><i class="fa-solid fa-quote-left"></i> {{ c.reviewNote }}</p>
            }
            @if (c.publishedSlug) {
              <a class="btn btn-ghost btn-sm" [routerLink]="['/admin/contes', c.publishedSlug]"><i class="fa-solid fa-pen"></i> {{ 'admin.edit' | t }}</a>
            }
          </td>
        </tr>
      </ng-template>
      <ng-template #emptymessage>
        <tr><td colspan="7" class="empty">{{ list.error() ? 'Le serveur ne répond pas.' : 'Aucune contribution dans cette catégorie.' }}</td></tr>
      </ng-template>
    </p-table>

    <p-dialog [visible]="!!deciding()" (visibleChange)="!$event && !saving() && deciding.set(null)" [modal]="true" [draggable]="false"
      [style]="{ width: 'min(480px, 94vw)' }" [header]="(action() === 'approve' ? 'admin.approveTitle' : 'admin.rejectTitle') | t">
      <p class="muted">« {{ deciding()?.title }} » — {{ deciding()?.authorName }}</p>
      <label class="field">
        <span>{{ 'admin.note' | t }}</span>
        <textarea rows="3" [ngModel]="note()" (ngModelChange)="note.set($event)" maxlength="500"></textarea>
      </label>
      <ng-template #footer>
        <button type="button" class="btn btn-ghost btn-sm" (click)="deciding.set(null)" [disabled]="saving()">Annuler</button>
        <button type="button" class="btn btn-sm" (click)="apply()" [disabled]="saving()">
          @if (saving()) {
            <i class="fa-solid fa-spinner fa-spin"></i>
          }
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
    <p-confirmDialog />
  `,
  styleUrl: './admin-shared.scss',
  styles: `
    .c-title { display: inline-flex; align-items: center; gap: 8px; }
    .c-title i { color: var(--y-red); }
    .acts { white-space: nowrap; text-align: right; }
    .acts > * { margin-left: 6px; vertical-align: middle; }
    .acts .ib { display: inline-grid; place-items: center; }
    .detail { background: var(--surface-2) !important; padding: 16px 20px !important; }
    .detail > * + * { margin-top: 12px; }
    .d-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 0.85rem; color: var(--text-2); }
    .d-meta i { color: var(--y-ochre); margin-right: 4px; }
    .sum { margin: 0; color: var(--text-2); }
    .read { border: 0; background: none; color: var(--y-red); font-weight: 700; cursor: pointer; padding: 0; }
    .recs { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .recs li { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
    .r-head { display: flex; align-items: center; gap: 10px; }
    .pnum { font-weight: 800; color: var(--y-red); font-size: 0.85rem; }
    .pnum.unk { color: var(--text-3); }
    blockquote { margin: 0; padding: 8px 12px; border-left: 3px solid var(--border-strong); color: var(--text); font-size: 0.92rem; line-height: 1.6; white-space: pre-line; }
    .missing { margin: 0; font-size: 0.85rem; color: var(--text-3); }
    .note { margin: 0; padding: 10px 12px; background: var(--y-ochre-soft); border-radius: 6px; font-size: 0.9rem; }
    .fulltext { white-space: pre-line; line-height: 1.75; max-height: 60vh; overflow-y: auto; }
  `,
})
export class AdminContributionsPage {
  private admin = inject(AdminService);
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  private toast = inject(MessageService);
  private confirmation = inject(ConfirmationService);
  private notifs = inject(NotificationsService);

  readonly list = new LazyList<Contribution>((q) => this.admin.contributions(q));
  readonly filter = signal<Filter>('PENDING');
  readonly filters: Filter[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];
  readonly expanded = signal<Record<string, boolean>>({});
  readonly deciding = signal<Contribution | null>(null);
  readonly action = signal<'approve' | 'reject'>('approve');
  readonly note = signal('');
  readonly saving = signal(false);
  readonly busy = signal<number | null>(null);
  readonly reading = signal<Contribution | null>(null);

  constructor() {
    this.list.filters.set({ status: 'PENDING' });
    void this.notifs.markAll();
  }

  setFilter(f: Filter) {
    this.filter.set(f);
    this.expanded.set({});
    this.list.setFilter('status', f);
  }

  decide(c: Contribution, a: 'approve' | 'reject') {
    // une contribution validée ne peut jamais être refusée (contrôlé aussi par le serveur)
    if (c.status === 'APPROVED') return;
    this.action.set(a);
    this.note.set('');
    this.deciding.set(c);
  }

  apply() {
    const c = this.deciding();
    if (!c || this.saving()) return;
    const a = this.action();
    this.saving.set(true);
    const call = a === 'approve' ? this.admin.approve(c.id, this.note()) : this.admin.reject(c.id, this.note());
    call.subscribe({
      next: (u) => {
        this.saving.set(false);
        this.deciding.set(null);
        this.toast.add({ severity: 'success', summary: this.i18n.t('admin.' + a + 'd'), detail: this.i18n.t('admin.authorNotified'), life: 3000 });
        if (u.publishedSlug || a === 'approve') void this.data.refreshTales();
        this.list.load(); // la ligne change d'onglet : liste et compteurs rechargés
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: e?.error?.message ?? 'La décision n’a pas pu être enregistrée', life: 4000 });
        this.list.load();
      },
    });
  }

  remove(c: Contribution) {
    this.confirmation.confirm({
      header: 'Supprimer cette contribution ?',
      message: `« ${c.title} » de ${c.authorName} et ses fichiers audio seront définitivement supprimés.`
        + (c.status === 'APPROVED' ? ' Les voix publiées à partir de cette contribution seront retirées.' : ''),
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.busy.set(c.id);
        this.admin.deleteContribution(c.id).subscribe({
          next: () => {
            this.busy.set(null);
            this.toast.add({ severity: 'success', summary: 'Contribution supprimée', life: 2500 });
            this.list.load();
            if (c.status === 'APPROVED') void this.data.refreshTales();
          },
          error: (e) => {
            this.busy.set(null);
            this.toast.add({ severity: 'error', summary: e?.error?.message ?? 'La contribution n’a pas pu être supprimée', life: 4000 });
          },
        });
      },
    });
  }
}
