import { Injectable, effect, signal } from '@angular/core';

const KEY = 'yaaba.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal(this.initial());

  constructor() {
    effect(() => {
      const dark = this.dark();
      document.documentElement.classList.toggle('app-dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#13110e' : '#D62828');
      try {
        localStorage.setItem(KEY, dark ? 'dark' : 'light');
      } catch {}
    });
  }

  toggle() {
    this.dark.update((d) => !d);
  }

  private initial() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) return saved === 'dark';
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
