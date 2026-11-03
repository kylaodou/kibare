import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, input, signal, untracked, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import { AmbienceService } from '../../core/ambience.service';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe, TxPipe } from '../../core/i18n.service';
import { AudioTrack, GlossaryEntry } from '../../core/models';
import { NarrationService } from '../../core/narration.service';
import { ProgressService } from '../../core/progress.service';
import { sceneFocus } from '../../shared/art/focus';
import { SceneArtComponent } from '../../shared/art/scene-art.component';
import { HeartBurstComponent } from '../../shared/heart-burst/heart-burst.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { CommentsComponent } from '../../shared/comments/comments.component';
import { TYPE_ICON, TaleCardComponent, taleText } from '../../shared/tale-card/tale-card.component';
import { QuizComponent } from './quiz.component';

interface Part {
  text: string;
  term?: GlossaryEntry;
}

/** Langues de lecture proposées, dans cet ordre. */
const READ_LANGS = ['fr', 'en', 'moore', 'dioula', 'fulfulde'];

/**
 * Lecteur d'un conte : illustration à gauche (elle suit le paragraphe en cours),
 * texte intégral à droite, narration audio synchronisée, choix interactifs,
 * puis morale, quiz, glossaire, source, contributeurs et commentaires.
 */
/** Mots (fr, en) qui désignent chaque élément d'illustration. */

/** Une voix : un conteur dans une langue, avec ses fichiers par paragraphe (identifiant de scène → URL). */
interface Voice {
  key: string;
  lang: string;
  narrator: string;
  byScene: Map<string, string>;
  /** enregistrement d'un seul tenant (conte entier) */
  whole?: AudioTrack;
}

@Component({
  selector: 'app-tale-page',
  imports: [RouterLink, FormsModule, SceneArtComponent, TaleCardComponent, QuizComponent, CommentsComponent, TranslatePipe, TxPipe, PopoverModule, TooltipModule, SkeletonComponent, HeartBurstComponent],
  templateUrl: './tale.page.html',
  styleUrl: './tale.page.scss',
})
export class TalePage implements AfterViewInit {
  readonly data = inject(DataService);
  readonly i18n = inject(I18nService);
  readonly narration = inject(NarrationService);
  readonly ambience = inject(AmbienceService);
  readonly progress = inject(ProgressService);
  private title = inject(Title);
  private router = inject(Router);
  private toast = inject(MessageService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly slug = input.required<string>();

  /** paragraphe actif (illustration affichée, phrase surlignée) */
  readonly active = signal(0);
  readonly textLang = signal<string>(this.i18n.lang());
  readonly fontSize = signal(19);
  readonly playing = signal(false);
  readonly answers = signal<Record<number, number>>({});
  readonly tracks = signal<AudioTrack[]>([]);
  /** voix d'un seul tenant (conte entier) choisie par l'auditeur */
  readonly track = signal<AudioTrack | null>(null);
  /** choix de voix : « auto » (première voix du paragraphe dans la langue du texte), « text » (narration du texte) ou une voix précise */
  readonly voiceChoice = signal<string>('auto');
  /** fichiers illisibles : on ne les retente pas, on passe à la narration du texte */
  private broken = new Set<string>();
  readonly stamped = signal(false);
  readonly gloss = signal<GlossaryEntry | null>(null);
  readonly finished = signal(false);
  readonly typeIcon = TYPE_ICON;

  private paras = viewChildren<ElementRef<HTMLElement>>('para');
  private audio?: HTMLAudioElement;
  /** paragraphes réellement lus : restés actifs 2 s à l'écran ou narrés jusqu'au bout */
  private read = new Set<number>();
  private readTimer?: number;
  private frame = 0;

  readonly tale = computed(() => this.data.tale(this.slug()));
  readonly text = computed(() => {
    const t = this.tale();
    return t ? taleText(t, this.textLang()) : null;
  });
  readonly current = computed(() => this.tale()?.scenes[this.active()]);
  readonly region = computed(() => this.data.regionMap().get(this.tale()?.region ?? ''));
  readonly origin = computed(() => this.data.languageMap().get(this.tale()?.language ?? ''));
  readonly favorite = computed(() => this.progress.favorites().has(this.slug()));
  readonly liked = computed(() => this.progress.liked().has(this.slug()));

  /** Langues dans lesquelles le texte est disponible. */
  readonly languages = computed(() => {
    const t = this.tale();
    if (!t) return [];
    return READ_LANGS.filter((l) => t.scenes.some((s) => s.text[l])).map((code) => ({
      code,
      name: this.data.languageMap().get(code)?.name ?? code,
      mt: t.mt?.includes(code) ?? false,
    }));
  });

  /**
   * Voix disponibles, regroupées par conteur et langue. Chaque voix associe un fichier
   * à l'identifiant réel des paragraphes qu'elle couvre (jamais à leur position).
   */
  readonly voices = computed<Voice[]>(() => {
    const t = this.tale();
    const out = new Map<string, Voice>();
    for (const a of this.tracks()) {
      if (a.sceneId) {
        const key = `${a.lang}|${a.narrator}`;
        const v = out.get(key) ?? { key, lang: a.lang, narrator: a.narrator, byScene: new Map<string, string>() };
        if (!v.byScene.has(a.sceneId)) v.byScene.set(a.sceneId, a.url);
        out.set(key, v);
      } else if (a.segments?.length && t) {
        // ancien format (un fichier par paragraphe, dans l'ordre) : rattaché aux identifiants actuels
        const key = `seg-${a.id}`;
        const byScene = new Map<string, string>();
        a.segments.forEach((u, i) => t.scenes[i]?.id && byScene.set(t.scenes[i].id!, u));
        out.set(key, { key, lang: a.lang, narrator: a.narrator, byScene });
      } else {
        out.set(`whole-${a.id}`, { key: `whole-${a.id}`, lang: a.lang, narrator: a.narrator, byScene: new Map(), whole: a });
      }
    }
    return [...out.values()];
  });

  /** Voix utilisée pour le paragraphe i selon le choix de l'auditeur (null : narration du texte). */
  voiceFor(i: number): { url: string; voice: Voice } | null {
    const sid = this.tale()?.scenes[i]?.id;
    const choice = this.voiceChoice();
    if (!sid || choice === 'text') return null;
    const ok = (v: Voice) => {
      const url = v.byScene.get(sid);
      return url && !this.broken.has(url) ? { url, voice: v } : null;
    };
    if (choice !== 'auto') {
      const v = this.voices().find((x) => x.key === choice);
      return v ? ok(v) : null;
    }
    for (const v of this.voices()) if (v.lang === this.textLang() && ok(v)) return ok(v);
    return null;
  }

  /** Voix du paragraphe affiché (pour le lecteur). */
  readonly activeVoice = computed(() => {
    this.tracks();
    this.voiceChoice();
    this.textLang();
    return this.voiceFor(this.active());
  });

  /** Narration enregistrée par paragraphe (fichiers MP3 générés) disponible dans la langue de lecture ? */
  readonly hasRecorded = computed(() => !!this.tale()?.narration?.includes(this.textLang()));
  readonly canSynth = computed(() => this.narration.canSpeak(this.textLang()));
  readonly canPlay = computed(() => this.hasRecorded() || this.canSynth() || !!this.track() || !!this.activeVoice());

  readonly paragraphs = computed<Part[][][]>(() => {
    const t = this.tale();
    if (!t) return [];
    return t.scenes.map((s) =>
      NarrationService.sentences(this.i18n.tx(s.text, this.textLang())).map((sentence) => this.splitGlossary(sentence, t.glossary)),
    );
  });

  /**
   * Élément de l'illustration nommé dans la phrase en cours de lecture (pour que la caméra le cadre).
   * On cherche, dans l'ordre de la phrase, le premier mot qui désigne un élément présent dans la scène.
   */
  readonly focus = computed<number | null>(() => {
    const si = this.narration.current();
    const para = this.paragraphs()[this.active()];
    const scene = this.current();
    if (!this.playing() || si < 0 || !para?.[si] || !scene) return null;
    return sceneFocus(scene.art, para[si].map((p) => p.text).join(''));
  });

  readonly related = computed(() => {
    const t = this.tale();
    if (!t) return [];
    return this.data
      .tales()
      .filter((o) => o.slug !== t.slug)
      .map((o) => ({ o, score: (o.region === t.region ? 3 : 0) + (o.type === t.type ? 1 : 0) + (o.people === t.people ? 2 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => x.o);
  });

  constructor() {
    effect(() => {
      const t = this.tale();
      untracked(() => {
        this.stop();
        this.active.set(0);
        this.answers.set({});
        this.stamped.set(false);
        this.finished.set(false);
        this.track.set(null);
        this.voiceChoice.set('auto');
        this.broken.clear();
        this.read.clear();
        this.tracks.set(t?.audio ?? []);
        if (!t) return;
        this.title.setTitle(`${taleText(t, this.i18n.lang()).title} — KIBARE`);
        if (!t.scenes.some((s) => s.text[this.textLang()])) this.textLang.set('fr');
        this.data.view(t.slug, this.textLang());
        void this.data.audio(t.slug).then((tracks) => this.tracks.set(tracks));
        this.ambience.setRegion(t.region);
        // la narration démarre d'elle-même à l'ouverture du conte
        setTimeout(() => {
          if (this.tale() === t && !this.playing() && this.canPlay()) this.playFrom(0, false);
        }, 900);
      });
    });

    // un paragraphe compte comme lu après 2 s passées en paragraphe actif
    effect(() => {
      const i = this.active();
      untracked(() => {
        clearTimeout(this.readTimer);
        this.readTimer = window.setTimeout(() => this.markRead(i), 2000);
      });
    });

    effect(() => {
      const s = this.current();
      if (s) this.ambience.setMood(s.art.sky);
    });

    effect(() => {
      const speaking = this.playing();
      untracked(() => this.ambience.duck(speaking));
    });

    effect(() => {
      const l = this.i18n.lang();
      untracked(() => {
        if (this.tale()?.scenes.some((s) => s.text[l])) this.changeLang(l);
      });
    });

    inject(DestroyRef).onDestroy(() => {
      this.stop();
      clearTimeout(this.readTimer);
      window.removeEventListener('scroll', this.onScroll);
      this.ambience.duck(false);
      this.ambience.setRegion(null);
    });
  }

  ngAfterViewInit() {
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }

  /**
   * Paragraphe actif = le dernier dont le haut a franchi la ligne de lecture (40 % de l'écran).
   * En haut de page, c'est toujours le premier.
   */
  private onScroll = () => {
    if (this.playing() || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const line = window.innerHeight * 0.4;
      let i = 0;
      this.paras().forEach((el, k) => {
        if (el.nativeElement.getBoundingClientRect().top < line) i = k;
      });
      if (i === this.active()) return;
      this.active.set(i);
      const t = this.tale();
      if (t) this.progress.saveScene(t.slug, i);
    });
  };

  private markRead(i: number) {
    const t = this.tale();
    if (!t) return;
    this.read.add(i);
    if (this.read.size >= t.scenes.length) this.finish();
  }


  /* -------------------------------------------------------- narration */

  togglePlay() {
    // une voix d'un seul tenant se lit à part ; une voix enregistrée par paragraphe suit le texte
    if (this.track()) return this.toggleTrack();
    if (this.playing()) return this.stop();
    this.playFrom(this.active());
  }

  playFrom(i: number, scroll = true) {
    this.stop();
    const t = this.tale();
    if (!t || i >= t.scenes.length) return;
    this.playing.set(true);
    if (scroll) this.scrollTo(i);
    else this.active.set(i);
    const next = () => {
      if (!this.playing()) return;
      // un choix à faire : on attend la réponse avant de continuer
      if (t.scenes[i].choice && this.answers()[i] === undefined) {
        this.playing.set(false);
        return;
      }
      this.markRead(i);
      if (i + 1 < t.scenes.length) setTimeout(() => this.playing() && this.playFrom(i + 1), 700);
      else this.playing.set(false);
    };
    const segment = this.voiceFor(i)?.url;
    if (segment || this.hasRecorded()) {
      const audio = new Audio(segment ?? `audio/narration/${t.slug}/${this.textLang()}/${i}.mp3`);
      this.audio = audio;
      // phrase en cours estimée d'après la position dans le fichier (proportion de caractères)
      const lengths = this.paragraphs()[i].map((parts) => parts.reduce((n, p) => n + p.text.length, 0));
      const total = lengths.reduce((a, b) => a + b, 0) || 1;
      audio.ontimeupdate = () => {
        if (!audio.duration) return;
        let at = (audio.currentTime / audio.duration) * total;
        let si = 0;
        while (si < lengths.length - 1 && at > lengths[si]) at -= lengths[si++];
        if (this.narration.current() !== si) this.narration.current.set(si);
      };
      audio.onended = () => {
        this.narration.current.set(-1);
        next();
      };
      audio.onerror = () => {
        if (segment) {
          // voix illisible : signalée une fois, puis narration du texte pour ce paragraphe
          this.broken.add(segment);
          this.voiceChoice.update((c) => c);
          this.tracks.update((l) => [...l]);
          this.toast.add({ severity: 'warn', summary: 'Enregistrement illisible', detail: 'La narration du texte prend le relais.', life: 3500 });
          if (this.playing()) this.playFrom(i, false);
          return;
        }
        if (this.canSynth()) this.speak(i, next);
        else this.stop();
      };
      void audio.play().catch(() => this.stop());
    } else {
      this.speak(i, next);
    }
  }

  private speak(i: number, done: () => void) {
    const sentences = this.paragraphs()[i].map((parts) => parts.map((p) => p.text).join(''));
    this.narration.speak(sentences, this.textLang(), 0, done);
  }

  stop() {
    this.playing.set(false);
    this.narration.stop();
    this.narration.current.set(-1);
    if (this.audio) {
      this.audio.onended = null;
      this.audio.ontimeupdate = null;
      this.audio.pause();
      this.audio = undefined;
    }
  }

  step(d: number) {
    const t = this.tale();
    if (!t) return;
    const i = Math.max(0, Math.min(t.scenes.length - 1, this.active() + d));
    if (this.playing()) this.playFrom(i);
    else this.scrollTo(i);
  }

  scrollTo(i: number, smooth = true) {
    this.active.set(i);
    this.paras()[i]?.nativeElement.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
  }

  changeLang(code: string) {
    if (code === this.textLang()) return;
    const wasPlaying = this.playing();
    this.stop();
    this.textLang.set(code);
    if (wasPlaying) setTimeout(() => this.playFrom(this.active()), 100);
  }

  /* ----------------------------------------------- voix enregistrées */

  useTrack(t: AudioTrack | null) {
    this.stop();
    this.track.set(t);
  }

  /** Choix explicite de l'auditeur : respecté pour tous les paragraphes que la voix couvre. */
  pickVoice(key: string) {
    const wasPlaying = this.playing();
    const v = this.voices().find((x) => x.key === key);
    this.useTrack(v?.whole ?? null);
    this.voiceChoice.set(v ? key : key === 'text' ? 'text' : 'auto');
    if (wasPlaying && !v?.whole) setTimeout(() => this.playFrom(this.active(), false), 100);
  }

  /** Nombre de paragraphes couverts par une voix. */
  coverage(v: Voice) {
    return this.tale()?.scenes.filter((s) => s.id && v.byScene.has(s.id)).length ?? 0;
  }

  toggleTrack() {
    const t = this.track();
    if (!t) return;
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      this.playing.set(false);
      return;
    }
    if (!this.audio) {
      this.audio = new Audio(t.url);
      this.audio.onended = () => this.playing.set(false);
      this.audio.onerror = () => {
        this.playing.set(false);
        this.toast.add({ severity: 'warn', summary: 'Enregistrement illisible', detail: 'Choisissez une autre voix ou la narration du texte.', life: 4000 });
      };
    }
    void this.audio.play().catch(() => this.playing.set(false));
    this.playing.set(true);
  }

  langName(code: string) {
    return this.data.languageMap().get(code)?.name ?? code;
  }

  /* -------------------------------------------------------- choix */

  answer(i: number, option: number) {
    this.answers.update((a) => ({ ...a, [i]: option }));
    const t = this.tale();
    if (t && this.canSynth() && !this.hasRecorded()) {
      this.narration.speak([this.i18n.tx(t.scenes[i].choice!.reveal, this.textLang())], this.textLang());
    }
  }

  /* --------------------------------------------------------- fin */

  finish() {
    const t = this.tale();
    if (!t || this.finished()) return;
    this.finished.set(true);
    const firstTime = !this.progress.get(t.slug)?.completed;
    const hadStamp = this.progress.stamps().has(t.region);
    this.progress.complete(t.slug);
    if (firstTime && !hadStamp) setTimeout(() => this.stamped.set(true), 600);
  }

  quizDone(score: number) {
    const t = this.tale()!;
    this.progress.saveQuiz(t.slug, score, t.quiz.length);
  }

  /** éclats de cœurs : un compteur par bouton, incrémenté à chaque « j'aime » */
  readonly favBurst = signal(0);
  readonly likeBurst = signal(0);

  toggleFav() {
    const on = !this.favorite();
    this.progress.toggleFavorite(this.slug());
    if (on) this.favBurst.update((n) => n + 1);
  }

  like() {
    const liked = this.progress.toggleLike(this.slug());
    this.data.like(this.slug(), liked);
    if (liked) this.likeBurst.update((n) => n + 1);
  }

  async share() {
    const t = this.tale()!;
    const url = location.href;
    const tt = taleText(t, this.i18n.lang());
    try {
      if (navigator.share) {
        // une carte image (illustration + titre + logo) accompagne le lien quand l'appareil l'accepte
        const card = await this.shareCard(tt.title).catch(() => null);
        const data: ShareData = { title: tt.title, text: `${tt.summary}
${url}`, url };
        if (card && navigator.canShare?.({ files: [card] })) data.files = [card];
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      this.toast.add({ severity: 'success', summary: this.i18n.t('tale.linkCopied'), life: 2500 });
    } catch {}
  }

  /** Image 1200 × 630 : illustration du conte, titre et logo KIBARE. */
  private async shareCard(title: string): Promise<File | null> {
    const svg = this.host.nativeElement.querySelector('.visual svg');
    if (!svg) return null;
    const load = (src: string) =>
      new Promise<HTMLImageElement>((ok, ko) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = ko;
        img.src = src;
      });
    const xml = new XMLSerializer().serializeToString(svg);
    const [art, logo] = await Promise.all([
      load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)),
      load('brand/kibare-logo.png'),
    ]);
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 630;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 1200, 630);
    g.drawImage(art, 0, 0, 760, 630);
    const lw = 340;
    g.drawImage(logo, 800, 60, lw, (logo.height / logo.width) * lw);
    g.fillStyle = '#1e1611';
    g.font = '800 40px Montserrat, sans-serif';
    let y = 380;
    let line = '';
    for (const word of title.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > 360 && line) {
        g.fillText(line, 800, y);
        y += 50;
        line = word;
      } else line = test;
    }
    g.fillText(line, 800, y);
    g.fillStyle = '#7c3109';
    g.fillRect(800, y + 30, 80, 6);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
    return blob ? new File([blob], 'kibare.png', { type: 'image/png' }) : null;
  }

  print() {
    window.print();
  }

  openPassport() {
    this.stamped.set(false);
    void this.router.navigate(['/passeport']);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (e.key === 'ArrowDown' && e.altKey) this.step(1);
    else if (e.key === 'ArrowUp' && e.altKey) this.step(-1);
    else if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A') {
      e.preventDefault();
      this.togglePlay();
    } else return;
  }

  /* ------------------------------------------------------ glossaire */

  private splitGlossary(sentence: string, glossary: GlossaryEntry[]): Part[] {
    if (!glossary.length) return [{ text: sentence }];
    const terms = [...glossary].sort((a, b) => b.term.length - a.term.length);
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // mot entier, pluriel en « s » ou « x » inclus
    const re = new RegExp(`(?<![\\p{L}])(${terms.map((g) => esc(g.term)).join('|')})(s|x)?(?![\\p{L}])`, 'iu');
    const parts: Part[] = [];
    let rest = sentence;
    const used = new Set<string>();
    while (rest) {
      const m = re.exec(rest);
      if (!m) {
        parts.push({ text: rest });
        break;
      }
      const term = terms.find((g) => g.term.toLowerCase() === m[1].toLowerCase());
      if (m.index > 0) parts.push({ text: rest.slice(0, m.index) });
      parts.push(term && !used.has(term.term) ? { text: m[0], term } : { text: m[0] });
      if (term) used.add(term.term);
      rest = rest.slice(m.index + m[0].length);
    }
    return parts;
  }
}
