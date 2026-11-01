import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { AdminService, AdminTaleRow } from './admin.service';

@Component({
  selector: 'app-admin-tales',
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <header class="ph">
      <div>
        <h1>{{ 'admin.nav.tales' | t }}</h1>
        <p class="muted">{{ 'admin.talesLead' | t }}</p>
      </div>
      <a routerLink="nouveau" class="btn"><i class="fa-solid fa-plus"></i> {{ 'admin.newTale' | t }}</a>
    </header>

    <div class="toolbar">
      <input type="search" [ngModel]="q()" (ngModelChange)="q.set($event)" [placeholder]="'lib.search' | t" />
      <div class="seg" role="group">
        @for (o of origins; track o) {
          <button type="button" [class.on]="origin() === o" (click)="origin.set(o)">{{ 'admin.o.' + o | t }}</button>
        }
      </div>
      <span class="grow"></span>
      <span class="muted">{{ rows().length }} / {{ items().length }}</span>
    </div>

    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>{{ 'admin.c.title' | t }}</th>
            <th>{{ 'lib.region' | t }}</th>
            <th>{{ 'admin.c.origin' | t }}</th>
            <th>{{ 'admin.c.langs' | t }}</th>
            <th class="num"><i class="fa-regular fa-eye"></i></th>
            <th class="num"><i class="fa-regular fa-comment"></i></th>
            <th class="num"><i class="fa-solid fa-microphone-lines"></i></th>
            <th>{{ 'admin.c.status' | t }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.slug) {
            <tr>
              <td>
                <a class="t-title" [routerLink]="r.slug">{{ r.title }}</a><br />
                <small>{{ 'type.' + r.type | t }} · {{ r.slug }}</small>
              </td>
              <td>{{ data.regionMap().get(r.region)?.name }}</td>
              <td><span class="chip" [class.chip-ochre]="r.origin === 'community'" [class.chip-green]="r.origin === 'admin'">{{ 'admin.o.' + r.origin | t }}</span></td>
              <td><small>{{ r.languages.join(' · ').toUpperCase() }}</small></td>
              <td class="num">{{ r.views }}</td>
              <td class="num">{{ r.comments }}</td>
              <td class="num">{{ r.audio }}</td>
              <td>
                <label class="sw">
                  <input type="checkbox" [checked]="r.published" (change)="toggle(r)" />
                  <span></span>
                  <small>{{ (r.published ? 'admin.published' : 'admin.hidden') | t }}</small>
                </label>
              </td>
              <td class="acts">
                <a class="ib" [routerLink]="['/contes', r.slug]" [title]="'admin.open' | t"><i class="fa-solid fa-eye"></i></a>
                <a class="ib" [routerLink]="r.slug" [title]="'admin.edit' | t"><i class="fa-solid fa-pen"></i></a>
                <button type="button" class="ib no" (click)="remove(r)" [title]="'admin.delete' | t"><i class="fa-solid fa-trash-can"></i></button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './admin-shared.scss',
  styles: `
    .acts { white-space: nowrap; }
    .acts .ib { display: inline-grid; place-items: center; margin-left: 4px; }
    .sw { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
    .sw input { position: absolute; opacity: 0; width: 0; height: 0; }
    .sw span { width: 34px; height: 20px; border-radius: 10px; background: var(--surface-3); position: relative; transition: background-color 0.2s; }
    .sw span::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
    .sw input:checked + span { background: var(--y-green); }
    .sw input:checked + span::after { transform: translateX(14px); }
    .sw input:focus-visible + span { outline: 3px solid var(--y-yellow); }
  `,
})
export class AdminTalesPage {
  private admin = inject(AdminService);
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  private toast = inject(MessageService);
  readonly items = signal<AdminTaleRow[]>([]);
  readonly q = signal('');
  readonly origin = signal<'all' | 'seed' | 'admin' | 'community'>('all');
  readonly origins = ['all', 'seed', 'admin', 'community'] as const;

  readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return this.items().filter((r) => (this.origin() === 'all' || r.origin === this.origin()) && (!q || r.title.toLowerCase().includes(q) || r.slug.includes(q)));
  });

  constructor() {
    this.admin.tales().subscribe({ next: (l) => this.items.set(l), error: () => {} });
  }

  toggle(r: AdminTaleRow) {
    const v = !r.published;
    this.admin.publish(r.slug, v).subscribe({
      next: () => {
        this.items.update((l) => l.map((x) => (x.slug === r.slug ? { ...x, published: v } : x)));
        void this.data.refreshTales();
      },
      error: () => this.toast.add({ severity: 'error', summary: this.i18n.t('admin.error'), life: 3000 }),
    });
  }

  remove(r: AdminTaleRow) {
    if (!confirm(this.i18n.t('admin.confirmDeleteTale'))) return;
    this.admin.deleteTale(r.slug).subscribe(() => {
      this.items.update((l) => l.filter((x) => x.slug !== r.slug));
      void this.data.refreshTales();
    });
  }
}
