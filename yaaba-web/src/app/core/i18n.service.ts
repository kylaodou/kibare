import { Injectable, Pipe, PipeTransform, computed, effect, inject, signal } from '@angular/core';
import { DICTIONARY, UiLang } from './i18n.dictionary';
import { Txt } from './models';

const STORAGE_KEY = 'yaaba.lang';

/** L'interface est en français (plus de sélecteur FR/EN) ; l'anglais reste disponible pour lire les contes. */
function initialLang(): UiLang {
  return 'fr';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<UiLang>(initialLang());
  readonly dict = computed(() => DICTIONARY[this.lang()]);

  constructor() {
    effect(() => {
      const lang = this.lang();
      document.documentElement.lang = lang;
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {}
    });
  }

  set(lang: UiLang) {
    this.lang.set(lang);
  }

  /** Traduit une clé d'interface ; {nom} est remplacé par params.nom. */
  t(key: string, params?: Record<string, string | number>): string {
    let value = this.dict()[key] ?? DICTIONARY.fr[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
    }
    return value;
  }

  /** Choisit la bonne version d'un texte de contenu, avec repli sur le français. */
  tx(txt: Txt | undefined | null, lang: string = this.lang()): string {
    if (!txt) return '';
    return txt[lang] ?? txt['fr'] ?? Object.values(txt)[0] ?? '';
  }
}

@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}

@Pipe({ name: 'tx', pure: false })
export class TxPipe implements PipeTransform {
  private i18n = inject(I18nService);
  transform(txt: Txt | undefined | null, lang?: string): string {
    return this.i18n.tx(txt, lang ?? this.i18n.lang());
  }
}
