import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableLazyLoadEvent } from 'primeng/table';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { PageResult } from '../../core/models';
import { PageQuery } from './admin.service';

/**
 * État d'une liste paginée côté serveur pour un p-table « lazy » :
 * pagination (10 par page), recherche différée, tri et filtres, une seule requête en vol.
 * À créer dans un contexte d'injection (champ de composant).
 */
export class LazyList<T> {
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly counts = signal<Record<string, number | undefined>>({});
  readonly loading = signal(true);
  readonly error = signal(false);
  /** index du premier élément affiché (convention PrimeNG) */
  readonly first = signal(0);
  readonly rows = signal(10);
  readonly q = signal('');
  readonly sort = signal<string | undefined>(undefined);
  readonly filters = signal<Record<string, string | undefined>>({});

  private search$ = new Subject<string>();
  private reload$ = new Subject<void>();

  constructor(private fetch: (q: PageQuery) => Observable<PageResult<T>>) {
    const destroy = inject(DestroyRef);
    this.reload$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(() =>
          this.fetch(this.query()).pipe(
            catchError(() => {
              this.error.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(destroy),
      )
      .subscribe((r) => {
        this.loading.set(false);
        if (!r) return;
        this.error.set(false);
        // page devenue vide (dernier élément supprimé) : on recule d'une page
        if (!r.items.length && r.total > 0 && this.first() > 0) {
          this.first.set(Math.max(0, this.first() - this.rows()));
          this.reload$.next();
          return;
        }
        this.items.set(r.items);
        this.total.set(r.total);
        if (r.counts) this.counts.set(r.counts);
      });
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(destroy))
      .subscribe((q) => {
        this.q.set(q);
        this.first.set(0);
        this.reload$.next();
      });
  }

  query(): PageQuery {
    return { page: Math.floor(this.first() / this.rows()), size: this.rows(), q: this.q(), sort: this.sort(), ...this.filters() };
  }

  load() {
    this.reload$.next();
  }

  /** Événement onLazyLoad du p-table (pagination, tri). */
  onLazy(e: TableLazyLoadEvent) {
    this.first.set(e.first ?? 0);
    if (e.rows) this.rows.set(e.rows);
    const field = Array.isArray(e.sortField) ? e.sortField[0] : e.sortField;
    this.sort.set(field ? `${field},${e.sortOrder === 1 ? 'asc' : 'desc'}` : undefined);
    this.load();
  }

  /** Saisie de recherche : différée, sauf l'effacement qui recharge aussitôt. */
  search(v: string) {
    if (!v.trim()) {
      this.search$.next('');
      this.q.set('');
      this.first.set(0);
      this.load();
      return;
    }
    this.search$.next(v.trim());
  }

  setFilter(key: string, value: string | undefined) {
    this.filters.update((f) => {
      const n = { ...f };
      if (value) n[key] = value;
      else delete n[key];
      return n;
    });
    this.first.set(0);
    this.load();
  }
}
