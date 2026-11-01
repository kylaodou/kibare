import { Injectable, computed, signal } from '@angular/core';

export interface TourStep {
  /** sélecteur CSS de l'élément à mettre en lumière (aucun = carte centrée) */
  target?: string;
  /** clés de traduction */
  title: string;
  text: string;
  icon?: string;
}

const KEY = 'yaaba.tours';

/** Visites guidées : expliquent pas à pas les fonctionnalités à la première visite. */
@Injectable({ providedIn: 'root' })
export class TourService {
  readonly steps = signal<TourStep[]>([]);
  readonly index = signal(0);
  readonly active = computed(() => this.steps().length > 0);
  readonly step = computed(() => this.steps()[this.index()]);
  private id = '';

  /** Lance la visite si elle n'a jamais été vue (ou si force = true). */
  start(id: string, steps: TourStep[], force = false) {
    if (!force && this.seen(id)) return;
    this.id = id;
    this.index.set(0);
    this.steps.set(steps);
  }

  next() {
    if (this.index() < this.steps().length - 1) this.index.update((i) => i + 1);
    else this.end();
  }

  prev() {
    this.index.update((i) => Math.max(0, i - 1));
  }

  end() {
    this.markSeen(this.id);
    this.steps.set([]);
  }

  seen(id: string) {
    try {
      return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]).includes(id);
    } catch {
      return false;
    }
  }

  private markSeen(id: string) {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
      if (!list.includes(id)) localStorage.setItem(KEY, JSON.stringify([...list, id]));
    } catch {}
  }
}
