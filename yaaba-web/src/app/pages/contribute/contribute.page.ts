import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { AuthService } from '../../core/auth.service';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { ContributionPayload, TaleType } from '../../core/models';
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

  readonly taleOptions = computed(() =>
    this.data.tales().map((t) => ({ label: taleText(t, this.i18n.lang()).title, value: t.slug })),
  );
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
    const parts = this.kind() === 'voice' ? (this.segments().filter(Boolean) as Blob[]) : [];
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
      { k: 'man-up', x: 66, c: '#00894A' },
      { k: 'drum', x: 76 },
    ],
  };
}
