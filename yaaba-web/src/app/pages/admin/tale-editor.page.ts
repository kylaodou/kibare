import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { AudioTrack, Scene, Tale, TaleType } from '../../core/models';
import { SceneArtComponent } from '../../shared/art/scene-art.component';
import { ART_PRESETS } from '../../shared/art/presets';
import { AdminService } from './admin.service';

const LANGS = ['fr', 'en', 'moore', 'dioula', 'fulfulde'];

interface Editable extends Omit<Tale, 'audio'> {
  published: boolean;
  rights?: string;
}

/**
 * Éditeur complet d'un conte : métadonnées, textes dans chaque langue,
 * paragraphes illustrés, source et droits, voix enregistrées.
 */
@Component({
  selector: 'app-tale-editor',
  imports: [FormsModule, RouterLink, SceneArtComponent, TranslatePipe],
  templateUrl: './tale-editor.page.html',
  styleUrl: './admin-shared.scss',
  styles: `
    .grid2 { display: grid; gap: 16px; }
    @media (min-width: 760px) { .grid2 { grid-template-columns: 1fr 1fr; } .grid4 { grid-template-columns: repeat(4, 1fr) !important; } }
    .grid4 { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; }
    .full { grid-column: 1 / -1; }
    .langtabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
    .langtabs button { padding: 8px 14px; border-radius: 6px; border: 1px solid var(--border-strong); background: var(--surface); font-weight: 700; cursor: pointer; }
    .langtabs button.on { background: var(--y-red); border-color: var(--y-red); color: #fff; }
    .langtabs .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--y-green); margin-left: 6px; }
    .para { display: grid; gap: 14px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
    @media (min-width: 900px) { .para { grid-template-columns: 240px 1fr; } }
    .para + .para { margin-top: 12px; }
    .p-art { display: grid; gap: 8px; align-content: start; }
    .p-art .thumb { aspect-ratio: 16 / 10; border-radius: 6px; overflow: hidden; }
    .p-art app-scene-art { height: 100%; }
    .p-head { display: flex; align-items: center; gap: 8px; }
    .p-head strong { font-family: var(--font-display); }
    .p-head .grow { flex: 1; }
    textarea.big { min-height: 120px; line-height: 1.6; }
    .bulk { margin-top: 14px; padding: 16px; border: 2px dashed var(--border-strong); border-radius: 10px; display: grid; gap: 10px; }
    .savebar { position: sticky; bottom: 0; z-index: 20; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 14px 18px; margin-top: 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-2); }
    .savebar .grow { flex: 1; }
    .check { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer; }
    .check input { width: 18px; height: 18px; accent-color: var(--y-green); }
    .tracks { list-style: none; padding: 0; margin: 0 0 14px; display: grid; gap: 8px; }
    .tracks li { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; }
    .tracks audio { height: 34px; }
    .hint { padding: 12px 14px; border-radius: 8px; background: var(--y-ochre-soft); font-size: 0.88rem; }
  `,
})
export class TaleEditorPage {
  private admin = inject(AdminService);
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  private toast = inject(MessageService);
  private router = inject(Router);

  readonly slug = input<string>();
  readonly isNew = computed(() => !this.slug());
  readonly t = signal<Editable | null>(null);
  readonly lang = signal('fr');
  readonly langs = LANGS;
  readonly presets = ART_PRESETS;
  readonly saving = signal(false);
  readonly bulk = signal('');
  readonly tracks = signal<AudioTrack[]>([]);
  readonly upLang = signal('moore');
  readonly upNarrator = signal('');
  readonly upFile = signal<File | null>(null);
  readonly types: TaleType[] = ['conte', 'legende', 'recit'];

  constructor() {
    queueMicrotask(() => {
      const s = this.slug();
      if (!s) {
        this.t.set(this.blank());
        return;
      }
      this.admin.tale(s).subscribe({
        next: (tale) => {
          this.tracks.set((tale.audio ?? []).map((a) => ({ ...a, url: this.data.mediaUrl(a.url) })));
          const { audio, ...rest } = tale as Tale & { published: boolean };
          this.t.set({ ...(rest as Editable), published: (tale as { published: boolean }).published });
        },
        error: () => this.toast.add({ severity: 'error', summary: this.i18n.t('admin.error'), life: 3000 }),
      });
    });
  }

  private blank(): Editable {
    return {
      slug: '',
      type: 'conte',
      region: 'centre',
      place: '',
      coords: [12.37, -1.52],
      people: '',
      language: 'moore',
      duration: 5,
      age: 6,
      featured: false,
      cover: 0,
      tags: [],
      i18n: { fr: { title: '', subtitle: '', summary: '', moral: '' } },
      scenes: [{ art: structuredClone(ART_PRESETS[0].art), text: { fr: '' } }],
      quiz: [],
      glossary: [],
      source: { fr: '', en: '' },
      published: false,
      rights: '',
    };
  }

  /* ---------------------------------------------------------- texte */

  text(field: 'title' | 'subtitle' | 'summary' | 'moral') {
    return this.t()?.i18n[this.lang()]?.[field] ?? '';
  }

  setText(field: 'title' | 'subtitle' | 'summary' | 'moral', v: string) {
    this.patch((t) => {
      const cur = t.i18n[this.lang()] ?? { title: '', subtitle: '', summary: '', moral: '' };
      t.i18n = { ...t.i18n, [this.lang()]: { ...cur, [field]: v } };
    });
  }

  hasLang(l: string) {
    return !!this.t()?.i18n[l]?.title || !!this.t()?.scenes.some((s) => s.text[l]);
  }

  setScene(i: number, v: string) {
    this.patch((t) => (t.scenes[i] = { ...t.scenes[i], text: { ...t.scenes[i].text, [this.lang()]: v } }));
  }

  setPreset(i: number, id: string) {
    const p = ART_PRESETS.find((x) => x.id === id);
    if (p) this.patch((t) => (t.scenes[i] = { ...t.scenes[i], art: structuredClone(p.art) }));
  }

  addScene(after: number) {
    this.patch((t) => t.scenes.splice(after + 1, 0, { art: structuredClone(ART_PRESETS[(after + 1) % ART_PRESETS.length].art), text: {} } as Scene));
  }

  removeScene(i: number) {
    this.patch((t) => t.scenes.length > 1 && t.scenes.splice(i, 1));
  }

  move(i: number, d: number) {
    this.patch((t) => {
      const j = i + d;
      if (j < 0 || j >= t.scenes.length) return;
      [t.scenes[i], t.scenes[j]] = [t.scenes[j], t.scenes[i]];
    });
  }

  /** Colle un texte entier : chaque paragraphe (séparé par une ligne vide) va dans un bloc illustré. */
  importBulk() {
    const paras = this.bulk().split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!paras.length) return;
    const lang = this.lang();
    this.patch((t) => {
      paras.forEach((p, i) => {
        if (!t.scenes[i]) t.scenes.push({ art: structuredClone(ART_PRESETS[i % ART_PRESETS.length].art), text: {} } as Scene);
        t.scenes[i] = { ...t.scenes[i], text: { ...t.scenes[i].text, [lang]: p } };
      });
    });
    this.bulk.set('');
    this.toast.add({ severity: 'success', summary: this.i18n.t('editor.imported', { n: paras.length }), life: 2500 });
  }

  setField<K extends keyof Editable>(k: K, v: Editable[K]) {
    this.patch((t) => (t[k] = v));
  }

  setCoords(v: string) {
    const [a, b] = v.split(',').map((x) => parseFloat(x));
    if (Number.isFinite(a) && Number.isFinite(b)) this.setField('coords', [a, b]);
  }

  setSource(l: 'fr' | 'en', v: string) {
    this.patch((t) => (t.source = { ...t.source, [l]: v }));
  }

  private patch(fn: (t: Editable) => unknown) {
    const t = this.t();
    if (!t) return;
    const copy = structuredClone(t);
    fn(copy);
    this.t.set(copy);
  }

  /* ------------------------------------------------------------- save */

  save() {
    const t = this.t();
    if (!t) return;
    if (!t.i18n['fr']?.title?.trim()) {
      this.toast.add({ severity: 'warn', summary: this.i18n.t('editor.needTitle'), life: 3000 });
      this.lang.set('fr');
      return;
    }
    const body = { ...t, scenes: t.scenes.filter((s) => Object.values(s.text).some((x) => x?.trim())) };
    this.saving.set(true);
    this.admin.saveTale(this.isNew() ? null : this.slug()!, body).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.add({ severity: 'success', summary: this.i18n.t('editor.saved'), life: 2500 });
        void this.data.refreshTales();
        if (this.isNew()) void this.router.navigate(['/admin/contes', saved.slug], { replaceUrl: true });
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: e?.error?.message ?? this.i18n.t('admin.error'), life: 4000 });
      },
    });
  }

  /* ------------------------------------------------------------ voix */

  pick(e: Event) {
    this.upFile.set((e.target as HTMLInputElement).files?.[0] ?? null);
  }

  upload() {
    const f = this.upFile();
    const s = this.slug();
    if (!f || !s || !this.upNarrator().trim()) return;
    this.admin.addAudio(s, this.upLang(), this.upNarrator().trim(), f).subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.i18n.t('admin.uploaded'), life: 2500 });
        this.upFile.set(null);
        this.upNarrator.set('');
        this.data.audio(s).then((l) => this.tracks.set(l));
      },
      error: () => this.toast.add({ severity: 'error', summary: this.i18n.t('admin.error'), life: 3000 }),
    });
  }

  deleteTrack(a: AudioTrack) {
    this.admin.deleteAudio(a.id).subscribe(() => this.tracks.update((l) => l.filter((x) => x.id !== a.id)));
  }

  langName(code: string) {
    return this.data.languageMap().get(code)?.name ?? code;
  }
}
