import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { ContributionPayload, TaleOption, TaleType } from '../../core/models';
import { SceneArtComponent } from '../../shared/art/scene-art.component';
import { taleText } from '../../shared/tale-card/tale-card.component';
import { RecorderComponent } from './recorder.component';

type Kind = 'voice' | 'story';

@Component({
  selector: 'app-contribute',
  imports: [FormsModule, RouterLink, InputTextModule, SelectModule, TextareaModule, RecorderComponent, SceneArtComponent, TranslatePipe],
  templateUrl: './contribute.page.html',
  styleUrl: './contribute.page.scss',
})
export class ContributePage {
  readonly data = inject(DataService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  private toast = inject(MessageService);

  /** paramètres d'URL : ?conte=…&langue=… */
  readonly conte = input<string>();
  readonly langue = input<string>();

  readonly step = signal(0);
  readonly kind = signal<Kind | null>(null);
  readonly taleSlug = signal<string | null>(null);
  readonly language = signal<string | null>(null);
  readonly title = signal('');
  readonly region = signal<string | null>(null);
  readonly story = signal('');
  readonly taleType = signal<TaleType>('conte');
  readonly summary = signal('');
  readonly moral = signal('');
  readonly consent = signal(false);
  readonly audio = signal<Blob | null>(null);
  /** voix : un enregistrement par paragraphe du conte */
  readonly segments = signal<(Blob | null)[]>([]);
  readonly segDone = computed(() => this.segments().filter(Boolean).length);
  readonly sending = signal(false);
  readonly sent = signal(false);

  readonly stepKeys = ['contrib.s1', 'contrib.s2', 'contrib.s3', 'contrib.s4'];

  /** sélecteur de contes : recherche côté serveur et chargement progressif (20 par page) */
  private optionItems = signal<TaleOption[]>([]);
  readonly optTotal = signal(0);
  readonly optLoading = signal(false);
  private optQuery = '';
  private optPage = 0;
  private optSearch$ = new Subject<string>();
  readonly taleOptions = computed(() => {
    const items = this.optionItems().map((o) => ({ label: o.title, value: o.slug, region: this.data.regionMap().get(o.region)?.name ?? '' }));
    // conte présélectionné (lien « prêter ma voix ») absent de la page courante : ajouté en tête
    const sel = this.taleSlug();
    const t = sel ? this.data.tale(sel) : undefined;
    if (sel && t && !items.some((i) => i.value === sel))
      items.unshift({ label: taleText(t, 'fr').title, value: sel, region: this.data.regionMap().get(t.region)?.name ?? '' });
    return items;
  });
  readonly optMore = computed(() => this.optionItems().length < this.optTotal());
  readonly langOptions = computed(() =>
    this.data.languages().map((l) => ({ label: `${l.name} (${l.native})`, value: l.code })),
  );
  readonly typeOptions = computed(() => {
    this.i18n.lang();
    return (['conte', 'legende', 'recit'] as TaleType[]).map((v) => ({ label: this.i18n.t('type.' + v), value: v }));
  });
  readonly regionOptions = computed(() => this.data.regions().map((r) => ({ label: r.name, value: r.code })));
  readonly tale = computed(() => (this.taleSlug() ? this.data.tale(this.taleSlug()!) : undefined));
  readonly reference = computed(() => {
    const t = this.tale();
    if (!t) return '';
    return t.scenes.map((s) => this.i18n.tx(s.text)).join('\n\n');
  });

  /** Paragraphes à lire, dans la langue choisie quand le texte existe, sinon en français. */
  readonly script = computed(() => {
    const t = this.tale();
    const l = this.language() ?? 'fr';
    return t ? t.scenes.map((s) => s.text[l] || this.i18n.tx(s.text)) : [];
  });

  readonly canNext = computed(() => {
    switch (this.step()) {
      case 0:
        return !!this.kind();
      case 1:
        return this.kind() === 'voice'
          ? !!this.taleSlug() && !!this.language()
          : this.title().trim().length > 2 && !!this.region() && !!this.language() && this.story().trim().length > 40;
      case 2:
        return this.kind() === 'story' || (this.segDone() > 0 && this.segDone() === this.script().length);
      case 3:
        return this.consent();
    }
    return false;
  });

  constructor() {
    this.optSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          this.optLoading.set(true);
          this.optQuery = q;
          this.optPage = 0;
          return this.data.taleOptions(q).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((r) => {
        this.optLoading.set(false);
        if (!r) return;
        this.optionItems.set(r.items);
        this.optTotal.set(r.total);
      });
    this.optSearch$.next('');
    // nouveau conte choisi : autant d'emplacements que de paragraphes
    effect(() => {
      const n = this.tale()?.scenes.length ?? 0;
      this.segments.set(Array.from({ length: n }, () => null));
    });
    effect(() => {
      const c = this.conte();
      const l = this.langue();
      if (c && this.data.tale(c)) {
        this.kind.set('voice');
        this.taleSlug.set(c);
        this.step.set(1);
      }
      if (l) this.language.set(l);
    });
  }

  searchTales(q: string) {
    this.optSearch$.next(q ?? '');
  }

  moreTales() {
    if (this.optLoading()) return;
    this.optLoading.set(true);
    this.data.taleOptions(this.optQuery, this.optPage + 1).subscribe({
      next: (r) => {
        this.optPage = r.page;
        this.optionItems.update((l) => [...l, ...r.items.filter((x) => !l.some((y) => y.slug === x.slug))]);
        this.optTotal.set(r.total);
        this.optLoading.set(false);
      },
      error: () => this.optLoading.set(false),
    });
  }

  setSegment(i: number, blob: Blob | null) {
    this.segments.update((s) => s.map((b, k) => (k === i ? blob : b)));
  }

  choose(k: Kind) {
    this.kind.set(k);
    this.step.set(1);
  }

  next() {
    if (!this.canNext()) return;
    if (this.step() < 3) this.step.update((s) => s + 1);
    else this.submit();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  back() {
    this.step.update((s) => Math.max(0, s - 1));
  }

  submit() {
    const t = this.tale();
    const payload: ContributionPayload = {
      kind: this.kind()!,
      taleSlug: this.kind() === 'voice' ? this.taleSlug()! : undefined,
      title: this.kind() === 'voice' ? (t ? taleText(t, 'fr').title : '') : this.title().trim(),
      region: this.kind() === 'voice' ? (t?.region ?? '') : this.region()!,
      language: this.language()!,
      taleType: this.kind() === 'story' ? this.taleType() : undefined,
      summary: this.kind() === 'story' ? this.summary().trim() || undefined : undefined,
      moral: this.kind() === 'story' ? this.moral().trim() || undefined : undefined,
      text: this.kind() === 'story' ? this.story().trim() : undefined,
      consent: this.consent(),
    };
    this.sending.set(true);
    // chaque enregistrement part avec l'identifiant réel de son paragraphe (jamais la seule position)
    const scenes = t?.scenes ?? [];
    const parts =
      this.kind() === 'voice'
        ? this.segments()
            .map((blob, i) => ({ blob, sceneId: scenes[i]?.id }))
            .filter((p): p is { blob: Blob; sceneId: string } => !!p.blob && !!p.sceneId)
        : [];
    this.data.contribute(payload, this.kind() === 'story' ? (this.audio() ?? undefined) : undefined, parts).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
      },
      error: (e) => {
        this.sending.set(false);
        this.toast.add({ severity: 'error', summary: this.i18n.t('contrib.errTitle'), detail: AuthService.message(e, this.i18n.t('contrib.errText')), life: 6000 });
      },
    });
  }

  again() {
    this.sent.set(false);
    this.step.set(0);
    this.kind.set(null);
    this.taleSlug.set(null);
    this.title.set('');
    this.story.set('');
    this.audio.set(null);
    this.segments.update((s) => s.map(() => null));
    this.consent.set(false);
  }

  readonly thanksArt = {
    sky: 'dusk' as const,
    ground: 'village' as const,
    items: [
      { k: 'sun', x: 80, y: 230 },
      { k: 'baobab', x: 20, y: 26 },
      { k: 'woman-up', x: 46 },
      { k: 'child-up', x: 56, c: '#D62828' },
      { k: 'man-up', x: 66, c: '#C9822B' },
      { k: 'drum', x: 76 },
    ],
  };
}
