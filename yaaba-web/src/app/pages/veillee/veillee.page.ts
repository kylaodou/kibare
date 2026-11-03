import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, computed, effect, inject, signal, viewChild, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AmbienceService } from '../../core/ambience.service';
import { DataService } from '../../core/data.service';
import { I18nService } from '../../core/i18n.service';
import { Tale } from '../../core/models';
import { NarrationService } from '../../core/narration.service';
import { ProgressService } from '../../core/progress.service';
import { sceneFocus } from '../../shared/art/focus';
import { SceneArtComponent } from '../../shared/art/scene-art.component';
import { taleText } from '../../shared/tale-card/tale-card.component';
import { VeilleeSound } from './veillee-sound';
import { HOTSPOTS, Hotspot, VeilleeWorld } from './veillee-world';

const LANGS = ['fr', 'en', 'moore', 'dioula', 'fulfulde'];

/**
 * La Veillée : village 3D (WebGL) où chaque objet ouvre un conte, raconté par le griot,
 * avec la narration et les textes existants du site. La 3D n'est chargée que sur cette page.
 */
@Component({
  selector: 'app-veillee',
  imports: [RouterLink, FormsModule, SceneArtComponent],
  templateUrl: './veillee.page.html',
  styleUrl: './veillee.page.scss',
})
export class VeilleePage implements AfterViewInit, OnDestroy {
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  private zone = inject(NgZone);
  private ambience = inject(AmbienceService);
  private progress = inject(ProgressService);
  private toast = inject(MessageService);

  private stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private canvasHost = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private labelEls = viewChildren<ElementRef<HTMLElement>>('label');

  readonly hotspots = HOTSPOTS;
  readonly state = signal<'loading' | 'ready' | 'in' | 'nogl' | 'lost'>('loading');
  readonly muted = signal(false);
  readonly listOpen = signal(false);
  /** recherche dans tous les contes */
  readonly query = signal('');
  /** l'illustration du paragraphe accompagne le récit (masquable) */
  readonly showArt = signal(true);
  readonly fullscreen = signal(false);
  readonly coarse = matchMedia('(pointer: coarse)').matches;

  /* conte ouvert */
  readonly spot = signal<Hotspot | null>(null);
  /** rang dans les contes à la une, pour « Un autre conte » du griot */
  private griotIndex = signal(this.dayIndex());
  /** conte choisi dans la liste : c'est le griot qui le raconte */
  readonly chosen = signal<string | null>(null);
  readonly lang = signal('fr');
  /* récit en cours */
  readonly telling = signal(false);
  readonly paused = signal(false);
  readonly sceneIndex = signal(0);
  readonly subtitle = signal('');

  private featured = computed(() => this.data.tales().filter((t) => t.featured));
  readonly tale = computed<Tale | undefined>(() => {
    const s = this.spot();
    if (!s) return undefined;
    if (s.slug) return this.data.tale(s.slug);
    const c = this.chosen();
    if (c) return this.data.tale(c);
    const l = this.featured();
    return l.length ? l[this.griotIndex() % l.length] : undefined;
  });
  /** Langues où le conte a une narration complète. */
  readonly langs = computed(() => {
    const t = this.tale();
    const list = t?.narration?.length ? t.narration : ['fr'];
    return LANGS.filter((l) => list.includes(l)).map((code) => ({ code, name: this.data.languageMap().get(code)?.name ?? code }));
  });
  readonly title = computed(() => {
    const t = this.tale();
    return t ? taleText(t, this.lang()).title : '';
  });
  readonly summary = computed(() => {
    const t = this.tale();
    return t ? taleText(t, this.lang()).summary : '';
  });
  /** Tous les contes publiés, triés par titre et filtrés par la recherche. */
  readonly allTales = computed(() => {
    const fold = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const q = fold(this.query().trim());
    const regions = this.data.regionMap();
    return this.data
      .tales()
      .map((t) => ({ slug: t.slug, title: taleText(t, 'fr').title, place: t.place, region: regions.get(t.region)?.name ?? '' }))
      .filter((t) => !q || fold(`${t.title} ${t.place} ${t.region}`).includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  });
  readonly total = computed(() => this.data.tales().length);
  /** Paragraphe raconté : son illustration s'affiche pendant le récit. */
  readonly scene = computed(() => (this.telling() ? this.tale()?.scenes[this.sceneIndex()] : undefined));
  /** La caméra de l'illustration cadre ce que nomme la phrase en cours. */
  readonly focus = computed(() => {
    const s = this.scene();
    return s && this.subtitle() ? sceneFocus(s.art, this.subtitle()) : null;
  });
  readonly regionName = computed(() => this.data.regionMap().get(this.tale()?.region ?? '')?.name ?? '');

  private world?: VeilleeWorld;
  private sound?: VeilleeSound;
  private audio?: HTMLAudioElement;
  private textTimer?: number;
  private musicWasOn = false;
  private lostCheck?: number;

  constructor() {
    // les étiquettes HTML suivent les objets 3D à chaque image
    effect(() => {
      const els = new Map(this.labelEls().map((e) => [e.nativeElement.dataset['id']!, e.nativeElement]));
      this.world?.setLabels(els);
    });
    // la langue choisie doit exister pour le conte affiché
    effect(() => {
      const list = this.langs();
      if (list.length && !list.some((l) => l.code === this.lang())) this.lang.set(list[0].code);
    });
  }

  ngAfterViewInit() {
    // laisse la page s'afficher (écran d'accueil) avant de construire la scène
    setTimeout(() => this.init(), 60);
  }

  private init() {
    try {
      this.zone.runOutsideAngular(() => {
        this.world = new VeilleeWorld(this.canvasHost().nativeElement, {
          select: (id) => this.zone.run(() => this.open(id)),
          listener: (f, p) => this.sound?.listener(f, p),
        });
      });
      this.world?.setLabels(new Map(this.labelEls().map((e) => [e.nativeElement.dataset['id']!, e.nativeElement])));
      this.state.set('ready');
      this.lostCheck = window.setInterval(() => {
        if (this.world?.lost) {
          clearInterval(this.lostCheck);
          this.stopTelling();
          this.state.set('lost');
        }
      }, 1000);
    } catch {
      this.state.set('nogl');
    }
  }

  ngOnDestroy() {
    clearInterval(this.lostCheck);
    this.stopTelling();
    this.world?.dispose();
    this.sound?.dispose();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    // la musique du site reprend en quittant le village
    if (this.musicWasOn) this.ambience.start();
  }

  /** Geste de l'utilisateur : le son peut démarrer. */
  enter() {
    this.musicWasOn = this.ambience.playing();
    if (this.musicWasOn) this.ambience.stop();
    this.zone.runOutsideAngular(() => (this.sound = new VeilleeSound()));
    this.state.set('in');
    this.canvasHost().nativeElement.querySelector('canvas')?.focus?.();
  }

  toggleMute() {
    this.muted.update((m) => !m);
    this.sound?.setMuted(this.muted());
    if (this.audio) this.audio.muted = this.muted();
  }

  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await this.stage().nativeElement.requestFullscreen();
      this.fullscreen.set(!!document.fullscreenElement);
    } catch {
      this.fullscreen.set(false);
    }
  }

  /* ---------------------------------------------------------- contes */

  /** Depuis la liste ou une étiquette : on marche jusqu'à l'objet et on ouvre le conte. */
  visit(h: Hotspot) {
    this.listOpen.set(false);
    this.world?.walkTo(h.id);
    this.open(h.id);
  }

  /** Un conte de la liste : le griot le raconte, on rejoint sa place autour du feu. */
  chooseTale(slug: string) {
    this.listOpen.set(false);
    this.stopTelling();
    this.chosen.set(slug);
    this.world?.walkTo('griot');
    this.spot.set(HOTSPOTS.find((x) => x.id === 'griot') ?? null);
  }

  private open(id: string) {
    const h = HOTSPOTS.find((x) => x.id === id) ?? null;
    if (this.telling() && h?.id !== this.spot()?.id) this.stopTelling();
    // toucher le griot sans choisir de conte : il revient à sa proposition du soir
    if (h?.id === 'griot' && !this.telling() && this.spot()?.id !== 'griot') this.chosen.set(null);
    this.spot.set(h);
  }

  close() {
    this.stopTelling();
    this.spot.set(null);
  }

  otherTale() {
    this.stopTelling();
    this.chosen.set(null);
    this.griotIndex.update((i) => i + 1);
  }

  /** Le griot raconte le conte : mêmes MP3 et mêmes textes que le lecteur classique. */
  tell() {
    const t = this.tale();
    if (!t) return;
    this.stopTelling();
    // un seul élément audio, créé pendant le geste : les téléphones refusent sinon d'enchaîner les paragraphes
    this.audio = new Audio();
    this.audio.muted = this.muted();
    this.telling.set(true);
    this.paused.set(false);
    this.world?.setTalking(true);
    this.world?.walkTo('griot');
    this.sound?.duck(true);
    this.data.view(t.slug, this.lang());
    this.playScene(t, 0);
  }

  private playScene(t: Tale, i: number) {
    clearTimeout(this.textTimer);
    if (i >= t.scenes.length) {
      this.finish(t);
      return;
    }
    this.sceneIndex.set(i);
    const lang = this.lang();
    const text = this.i18n.tx(t.scenes[i].text, lang);
    const sentences = NarrationService.sentences(text);
    const lengths = sentences.map((s) => s.length);
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    this.subtitle.set(sentences[0] ?? '');
    const a = this.audio!;
    const next = () => this.playScene(t, i + 1);
    const fallback = () => {
      // fichier absent ou illisible : le texte défile seul, le conte continue
      a.onerror = null;
      this.textTimer = window.setTimeout(next, Math.min(14000, 2500 + text.length * 55));
    };
    a.onended = next;
    a.onerror = fallback;
    a.ontimeupdate = () => {
      if (!a.duration) return;
      let at = (a.currentTime / a.duration) * total;
      let k = 0;
      while (k < lengths.length - 1 && at > lengths[k]) at -= lengths[k++];
      if (this.subtitle() !== sentences[k]) this.subtitle.set(sentences[k]);
    };
    a.src = `audio/narration/${t.slug}/${lang}/${i}.mp3`;
    void a.play().catch((e: DOMException) => {
      if (e.name !== 'AbortError') fallback();
    });
  }

  togglePause() {
    const a = this.audio;
    if (!a) return;
    if (a.paused) {
      void a.play().catch(() => {});
      this.paused.set(false);
      this.world?.setTalking(true);
    } else {
      a.pause();
      this.paused.set(true);
      this.world?.setTalking(false);
    }
  }

  skip() {
    const t = this.tale();
    if (t && this.telling()) {
      this.audio?.pause();
      this.playScene(t, this.sceneIndex() + 1);
    }
  }

  stopTelling() {
    clearTimeout(this.textTimer);
    if (this.audio) {
      this.audio.onended = this.audio.onerror = this.audio.ontimeupdate = null;
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio = undefined;
    }
    if (this.telling()) {
      this.world?.setTalking(false);
      this.sound?.duck(false);
    }
    this.telling.set(false);
    this.paused.set(false);
    this.subtitle.set('');
  }

  private finish(t: Tale) {
    const hadStamp = this.progress.stamps().has(t.region);
    this.stopTelling();
    this.progress.complete(t.slug);
    this.toast.add({
      severity: 'success',
      summary: 'Conte terminé',
      detail: hadStamp ? 'Il est ajouté à votre passeport.' : `Nouveau tampon dans votre passeport : ${this.regionName()}.`,
      life: 4500,
    });
  }

  private dayIndex() {
    const now = new Date();
    return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  }
}
