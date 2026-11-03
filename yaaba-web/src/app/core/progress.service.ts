import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth.service';
import { DataService } from './data.service';

export interface TaleProgress {
  scene: number;
  completed: boolean;
  quiz?: number;
  quizTotal?: number;
  updatedAt: number;
}

interface State {
  tales: Record<string, TaleProgress>;
  favorites: string[];
  liked: string[];
  regionsVisited: string[];
  name?: string;
}

const KEY = 'kibare.passport';

/** « Passeport des contes » : la progression du visiteur, conservée dans son navigateur. */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private data = inject(DataService);
  private auth = inject(AuthService);
  private key = computed(() => `${KEY}.${this.auth.user()?.id ?? 'invite'}`);
  private loadedKey = this.key();
  readonly state = signal<State>(this.read(this.loadedKey));

  readonly completed = computed(() =>
    Object.entries(this.state().tales)
      .filter(([, p]) => p.completed)
      .map(([slug]) => slug),
  );

  readonly inProgress = computed(() =>
    Object.entries(this.state().tales)
      .filter(([, p]) => !p.completed && p.scene > 0)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .map(([slug, p]) => ({ slug, ...p })),
  );

  /** Régions « tamponnées » : au moins un conte terminé dans la région. */
  readonly stamps = computed(() => {
    const done = new Set(this.completed());
    return new Set(this.data.tales().filter((t) => done.has(t.slug)).map((t) => t.region));
  });

  readonly favorites = computed(() => new Set(this.state().favorites));
  readonly liked = computed(() => new Set(this.state().liked));

  constructor() {
    // changement de compte : on charge le passeport de ce compte au lieu d'écraser le sien
    effect(() => {
      const key = this.key();
      if (key === this.loadedKey) return;
      this.loadedKey = key;
      untracked(() => this.state.set(this.read(key)));
    });
    effect(() => {
      const state = this.state();
      try {
        localStorage.setItem(this.loadedKey, JSON.stringify(state));
      } catch {}
    });
  }

  get(slug: string): TaleProgress | undefined {
    return this.state().tales[slug];
  }

  saveScene(slug: string, scene: number) {
    this.patch(slug, { scene });
  }

  complete(slug: string) {
    this.patch(slug, { completed: true });
  }

  saveQuiz(slug: string, score: number, total: number) {
    this.patch(slug, { quiz: Math.max(score, this.get(slug)?.quiz ?? 0), quizTotal: total });
  }

  toggleFavorite(slug: string) {
    this.state.update((s) => ({ ...s, favorites: toggle(s.favorites, slug) }));
  }

  toggleLike(slug: string): boolean {
    const liked = !this.liked().has(slug);
    this.state.update((s) => ({ ...s, liked: toggle(s.liked, slug) }));
    return liked;
  }

  visitRegion(code: string) {
    if (this.state().regionsVisited.includes(code)) return;
    this.state.update((s) => ({ ...s, regionsVisited: [...s.regionsVisited, code] }));
  }

  setName(name: string) {
    this.state.update((s) => ({ ...s, name }));
  }

  reset() {
    this.state.set(empty());
  }

  private patch(slug: string, p: Partial<TaleProgress>) {
    this.state.update((s) => {
      const prev = s.tales[slug] ?? { scene: 0, completed: false, updatedAt: 0 };
      return { ...s, tales: { ...s.tales, [slug]: { ...prev, ...p, updatedAt: Date.now() } } };
    });
  }

  private read(key: string): State {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return { ...empty(), ...JSON.parse(raw) };
    } catch {}
    return empty();
  }
}

function empty(): State {
  return { tales: {}, favorites: [], liked: [], regionsVisited: [] };
}

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}
