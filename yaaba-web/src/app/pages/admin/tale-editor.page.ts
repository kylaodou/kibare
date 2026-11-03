import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { firstValueFrom } from 'rxjs';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { AudioTrack, Scene, Tale, TaleType } from '../../core/models';
import { SceneArtComponent } from '../../shared/art/scene-art.component';
import { ART_PRESETS } from '../../shared/art/presets';
import { AudioPlayerComponent } from '../../shared/audio-player/audio-player.component';
import { RecorderComponent } from '../contribute/recorder.component';
import { AdminService } from './admin.service';

const LANGS = ['fr', 'en', 'moore', 'dioula', 'fulfulde'];
/** Taille maximale d'une vidéo de paragraphe (vérifiée aussi par le serveur). */
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];

type Editable = Omit<Tale, 'audio'> & { published: boolean };

/** Voix enregistrée dans l'éditeur, envoyée une fois le paragraphe enregistré sur le serveur. */
interface PendingVoice {
  key: string;
  sceneId: string;
  lang: string;
  narrator: string;
  blob: Blob;
  url: string;
}

const newSceneId = () => 'p-' + crypto.randomUUID();

/** Éditeur complet d'un conte : métadonnées, textes dans chaque langue, paragraphes illustrés (animation, vidéo) et voix rattachées à chaque paragraphe. */
@Component({
  selector: 'app-tale-editor',
  imports: [FormsModule, RouterLink, SceneArtComponent, TranslatePipe, DialogModule, ConfirmDialogModule, RecorderComponent, AudioPlayerComponent],
  providers: [ConfirmationService],
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
    .langtabs .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--y-ochre); margin-left: 6px; }
    .para { display: grid; gap: 14px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
    @media (min-width: 900px) { .para { grid-template-columns: 260px 1fr; } }
    .para + .para { margin-top: 12px; }
    .p-art { display: grid; gap: 8px; align-content: start; }
    .p-art .thumb { position: relative; aspect-ratio: 16 / 10; border-radius: 6px; overflow: hidden; border: 1px solid var(--border); }
    .p-art app-scene-art { height: 100%; }
    .p-art select { height: 38px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: 6px; background: var(--surface); color: var(--text); font: inherit; font-size: 0.86rem; }
    .anim { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-strong);
      background: var(--surface); font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: background-color 0.2s, color 0.2s, border-color 0.2s; }
    .anim:hover { border-color: var(--y-red); }
    .anim.on { background: var(--y-red); border-color: var(--y-red); color: #fff; }
    .anim:focus-visible, .ib:focus-visible, .drop:focus-within { outline: 2px solid var(--y-ochre); outline-offset: 2px; }
    .p-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .p-head strong { font-family: var(--font-display); }
    .p-head .grow { flex: 1; }
    .ib.voice { position: relative; color: var(--y-red); }
    .ib.voice .n { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: var(--y-red); color: #fff; font-size: 0.66rem; font-weight: 800; display: grid; place-items: center; }
    textarea.big { min-height: 120px; line-height: 1.6; }
    .bulk { margin-top: 14px; padding: 16px; border: 2px dashed var(--border-strong); border-radius: 10px; display: grid; gap: 10px; }
    .savebar { position: sticky; bottom: 0; z-index: 20; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 14px 18px; margin-top: 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow-2); }
    .savebar .grow { flex: 1; }
    .check { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer; }
    .check input { width: 18px; height: 18px; accent-color: var(--y-red); }
    .voices { list-style: none; padding: 0; margin: 4px 0 0; display: grid; gap: 8px; }
    .voices li { display: grid; grid-template-columns: minmax(0, auto) minmax(160px, 1fr) auto; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; }
    @media (max-width: 640px) { .voices li { grid-template-columns: 1fr auto; } .voices app-audio-player { grid-column: 1 / -1; grid-row: 2; } }
    .voices .who { display: flex; flex-direction: column; min-width: 0; font-size: 0.86rem; }
    .voices .who small { color: var(--text-3); }
    .tag { display: inline-block; padding: 1px 7px; border-radius: 4px; background: var(--y-ochre-soft); color: var(--y-red); font-size: 0.7rem; font-weight: 800; }
    .v-title { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 700; color: var(--text-2); margin-top: 6px; }
    .drop { position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 2px dashed var(--border-strong); border-radius: 8px; cursor: pointer; transition: border-color 0.2s, background-color 0.2s; }
    .drop:hover, .drop.over { border-color: var(--y-red); background: var(--y-red-soft); }
    .drop input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .drop i { font-size: 1.4rem; color: var(--y-red); }
    .drop span { display: flex; flex-direction: column; font-size: 0.86rem; }
    .drop small { color: var(--text-3); }
    .vid { display: grid; gap: 6px; }
    .vid video { width: 100%; border-radius: 6px; background: #000; max-height: 180px; }
    .err { color: var(--y-flag-red, #b3261e); font-size: 0.82rem; font-weight: 600; }
    .modal { display: grid; gap: 14px; }
    .modal .actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  `,
})
export class TaleEditorPage {
  private admin = inject(AdminService);
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private router = inject(Router);

  readonly slug = input<string>();
  readonly isNew = computed(() => !this.slug());
  readonly t = signal<Editable | null>(null);
  readonly lang = signal('fr');
  readonly langs = LANGS;
  readonly presets = ART_PRESETS;
  readonly saving = signal(false);
  readonly bulk = signal('');
  readonly types: TaleType[] = ['conte', 'legende', 'recit'];

  /** voix déjà publiées (serveur) et voix en attente d'envoi */
  readonly tracks = signal<AudioTrack[]>([]);
  readonly pending = signal<PendingVoice[]>([]);
  /** identifiants des paragraphes connus du serveur (une voix peut y être envoyée tout de suite) */
  private savedIds = new Set<string>();
  readonly voicesByScene = computed(() => {
    const m = new Map<string, { saved: AudioTrack[]; pending: PendingVoice[] }>();
    const get = (id: string) => m.get(id) ?? (m.set(id, { saved: [], pending: [] }), m.get(id)!);
    for (const a of this.tracks()) if (a.sceneId) get(a.sceneId).saved.push(a);
    for (const p of this.pending()) get(p.sceneId).pending.push(p);
    return m;
  });

  /* animation de l'aperçu, vidéo */
  readonly playing = signal<Set<string>>(new Set());
  readonly videoBusy = signal<string | null>(null);
  readonly videoError = signal<Record<string, string>>({});

  /* fenêtre « voix du paragraphe » */
  readonly voiceFor = signal<{ id: string; index: number } | null>(null);
  readonly vLang = signal('moore');
  readonly vNarrator = signal('');
  readonly vBlob = signal<Blob | null>(null);
  readonly vBusy = signal(false);
  readonly vError = signal('');
  readonly recKey = signal(0);

  constructor() {
    queueMicrotask(() => {
      const s = this.slug();
      if (!s) {
        this.t.set(this.blank());
        return;
      }
      this.admin.tale(s).subscribe({
        next: (tale) => this.load(tale),
        error: () => this.toast.add({ severity: 'error', summary: 'Conte introuvable ou serveur indisponible', life: 4000 }),
      });
    });
  }

  private load(tale: Tale & { published: boolean }) {
    this.tracks.set((tale.audio ?? []).map((a) => ({ ...a, url: this.data.mediaUrl(a.url) })));
    const { audio, age, ...rest } = tale as Tale & { published: boolean; age?: number; rights?: string };
    delete (rest as { rights?: string }).rights;
    const scenes = rest.scenes.map((s) => ({ ...s, id: s.id || newSceneId() }));
    this.savedIds = new Set(rest.scenes.map((s) => s.id).filter((x): x is string => !!x));
    this.t.set({ ...(rest as Editable), scenes, published: tale.published });
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
      featured: false,
      cover: 0,
      tags: [],
      i18n: { fr: { title: '', subtitle: '', summary: '', moral: '' } },
      scenes: [{ id: newSceneId(), art: structuredClone(ART_PRESETS[0].art), text: { fr: '' } }],
      quiz: [],
      glossary: [],
      source: { fr: '', en: '' },
      published: false,
    } as unknown as Editable;
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
    this.patch((t) =>
      t.scenes.splice(after + 1, 0, { id: newSceneId(), art: structuredClone(ART_PRESETS[(after + 1) % ART_PRESETS.length].art), text: {} } as Scene),
    );
  }

  removeScene(i: number) {
    const s = this.t()?.scenes[i];
    if (!s || this.t()!.scenes.length === 1) return;
    const v = this.voicesByScene().get(s.id!);
    const n = (v?.saved.length ?? 0) + (v?.pending.length ?? 0);
    const drop = () => {
      this.pending.update((l) => l.filter((p) => p.sceneId !== s.id));
      this.patch((t) => t.scenes.splice(i, 1));
    };
    if (!n) return drop();
    this.confirm.confirm({
      header: 'Supprimer ce paragraphe ?',
      message: `Ses ${n} voix seront supprimées à l'enregistrement du conte.`,
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: drop,
    });
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
        if (!t.scenes[i]) t.scenes.push({ id: newSceneId(), art: structuredClone(ART_PRESETS[i % ART_PRESETS.length].art), text: {} } as Scene);
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

  /* ------------------------------------------------------- animation */

  toggleAnim(id: string) {
    this.playing.update((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  /* ----------------------------------------------------------- vidéo */

  pickVideo(i: number, id: string, e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const setErr = (msg: string) => this.videoError.update((m) => ({ ...m, [id]: msg }));
    if (!VIDEO_TYPES.includes(file.type)) return setErr('Format non pris en charge : choisissez une vidéo MP4, WebM ou OGV.');
    if (file.size > MAX_VIDEO_BYTES)
      return setErr(`Vidéo trop volumineuse : ${(file.size / 1024 / 1024).toFixed(2)} Mo (10 Mo maximum).`);
    setErr('');
    this.videoBusy.set(id);
    this.admin.uploadVideo(file).subscribe({
      next: (m) => {
        this.videoBusy.set(null);
        this.patch((t) => {
          const k = t.scenes.findIndex((s) => s.id === id);
          if (k >= 0) t.scenes[k] = { ...t.scenes[k], video: m.url };
        });
        this.toast.add({ severity: 'success', summary: `Vidéo ajoutée au paragraphe ${i + 1}`, life: 2500 });
      },
      error: (err) => {
        this.videoBusy.set(null);
        setErr(err?.error?.message ?? 'La vidéo n’a pas pu être envoyée.');
      },
    });
  }

  removeVideo(id: string) {
    this.patch((t) => {
      const k = t.scenes.findIndex((s) => s.id === id);
      if (k >= 0) {
        const { video, ...rest } = t.scenes[k];
        t.scenes[k] = rest;
      }
    });
  }

  /* ------------------------------------------------------------ voix */

  openVoice(id: string, index: number) {
    this.voiceFor.set({ id, index });
    this.vNarrator.set('');
    this.vBlob.set(null);
    this.vError.set('');
    this.vLang.set(this.lang());
    this.recKey.update((k) => k + 1);
  }

  closeVoice() {
    this.voiceFor.set(null);
    this.vBlob.set(null);
  }

  /** Valide la voix : envoyée tout de suite si le paragraphe existe sur le serveur, sinon à l'enregistrement du conte. */
  addVoice() {
    const target = this.voiceFor();
    const blob = this.vBlob();
    const narrator = this.vNarrator().trim();
    if (!target || !blob) return this.vError.set('Enregistrez ou choisissez un fichier audio.');
    if (!narrator) return this.vError.set('Le nom du conteur est obligatoire.');
    if (blob.size > 30 * 1024 * 1024) return this.vError.set('Fichier audio trop volumineux (30 Mo maximum).');
    const slug = this.slug();
    if (slug && this.savedIds.has(target.id)) {
      this.vBusy.set(true);
      this.admin.addAudio(slug, target.id, this.vLang(), narrator, blob).subscribe({
        next: (a) => {
          this.vBusy.set(false);
          this.tracks.update((l) => [...l, { ...a, url: this.data.mediaUrl(a.url) }]);
          this.toast.add({ severity: 'success', summary: `Voix ajoutée au paragraphe ${target.index + 1}`, life: 2500 });
          this.closeVoice();
        },
        error: (e) => {
          this.vBusy.set(false);
          this.vError.set(e?.error?.message ?? 'La voix n’a pas pu être envoyée.');
        },
      });
      return;
    }
    this.pending.update((l) => [
      ...l,
      { key: crypto.randomUUID(), sceneId: target.id, lang: this.vLang(), narrator, blob, url: URL.createObjectURL(blob) },
    ]);
    this.toast.add({ severity: 'info', summary: 'Voix prête : elle sera publiée à l’enregistrement du conte', life: 3000 });
    this.closeVoice();
  }

  removePending(p: PendingVoice) {
    URL.revokeObjectURL(p.url);
    this.pending.update((l) => l.filter((x) => x.key !== p.key));
  }

  deleteTrack(a: AudioTrack) {
    this.confirm.confirm({
      header: 'Supprimer cette voix ?',
      message: `La voix de ${a.narrator} sera définitivement supprimée.`,
      icon: 'fa-solid fa-trash-can',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.admin.deleteAudio(a.id).subscribe({
          next: () => {
            this.tracks.update((l) => l.filter((x) => x.id !== a.id));
            this.toast.add({ severity: 'success', summary: 'Voix supprimée', life: 2500 });
          },
          error: () => this.toast.add({ severity: 'error', summary: 'La voix n’a pas pu être supprimée', life: 3500 }),
        }),
    });
  }

  /* ------------------------------------------------------------- save */

  save() {
    const t = this.t();
    if (!t || this.saving()) return;
    if (!t.i18n['fr']?.title?.trim()) {
      this.toast.add({ severity: 'warn', summary: this.i18n.t('editor.needTitle'), life: 3000 });
      this.lang.set('fr');
      return;
    }
    // un paragraphe vide est retiré, sauf s'il porte une voix ou une vidéo
    const keep = (s: Scene) =>
      Object.values(s.text).some((x) => x?.trim()) || !!s.video || !!this.voicesByScene().get(s.id!)?.pending.length;
    const body = { ...t, scenes: t.scenes.filter(keep) };
    this.saving.set(true);
    this.admin.saveTale(this.isNew() ? null : this.slug()!, body).subscribe({
      next: (saved) => void this.afterSave(saved),
      error: (e) => {
        this.saving.set(false);
        this.toast.add({ severity: 'error', summary: e?.error?.message ?? 'Le conte n’a pas pu être enregistré', life: 4500 });
      },
    });
  }

  /** Envoie les voix en attente vers leur paragraphe (identifiant conservé par le serveur), puis revient à la liste. */
  private async afterSave(saved: Tale) {
    const ids = new Set(saved.scenes.map((s) => s.id));
    const queue = this.pending().filter((p) => ids.has(p.sceneId));
    let failed = 0;
    for (const p of queue) {
      try {
        await firstValueFrom(this.admin.addAudio(saved.slug, p.sceneId, p.lang, p.narrator, p.blob));
        URL.revokeObjectURL(p.url);
      } catch {
        failed++;
      }
    }
    this.pending.set([]);
    this.saving.set(false);
    void this.data.refreshTales();
    const voices = queue.length - failed;
    this.toast.add({
      severity: 'success',
      summary: this.isNew() ? 'Conte créé' : 'Conte enregistré',
      detail: voices ? `${voices} voix publiée(s).` : undefined,
      life: 3500,
    });
    if (failed) this.toast.add({ severity: 'warn', summary: `${failed} voix n’ont pas pu être envoyées`, detail: 'Rouvrez le conte pour les ajouter à nouveau.', life: 6000 });
    void this.router.navigateByUrl('/admin/contes');
  }

  langName(code: string) {
    return this.data.languageMap().get(code)?.name ?? code;
  }

  mediaUrl(u: string) {
    return this.data.mediaUrl(u);
  }
}
