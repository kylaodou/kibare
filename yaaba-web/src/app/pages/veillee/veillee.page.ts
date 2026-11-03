import { Component, ElementRef, HostListener, NgZone, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
import { Hotspot, VillagePlan, regionPlan, showcasePlan } from './veillee-plan';
import { VeilleeSound } from './veillee-sound';
import { VeilleeWorld } from './veillee-world';

const LANGS = ['fr', 'en', 'moore', 'dioula', 'fulfulde'];

/** La Veillée : village 3D où le griot raconte. ?region= et ?lieu= choisissent le village. */
@Component({
  selector: 'app-veillee',
  imports: [RouterLink, FormsModule, SceneArtComponent],
  templateUrl: './veillee.page.html',
  styleUrl: './veillee.page.scss',
})
export class VeilleePage implements OnDestroy {
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  private zone = inject(NgZone);
  private ambience = inject(AmbienceService);
  private progress = inject(ProgressService);
  private toast = inject(MessageService);
  private router = inject(Router);

  /* paramètres d'URL */
  readonly region = input<string>();
  readonly lieu = input<string>();
  readonly conte = input<string>();

  private stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private canvasHost = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private labelEls = viewChildren<ElementRef<HTMLElement>>('label');

  readonly state = signal<'loading' | 'ready' | 'in' | 'nogl' | 'lost'>('loading');
  /** changement de village en cours */
  readonly traveling = signal(false);
  readonly muted = signal(false);
  readonly listOpen = signal(false);
  readonly query = signal('');
  readonly showArt = signal(true);
  readonly fullscreen = signal(false);
  readonly coarse = matchMedia('(pointer: coarse)').matches;

  /** Le village à afficher, d'après l'URL. */
  readonly plan = computed<VillagePlan | null>(() => {
    const tales = this.data.tales();
    if (!tales.length) return null;
    const code = this.region();
    const r = code ? this.data.regionMap().get(code) : undefined;
    if (r) {
      const here = tales.filter((t) => t.region === r.code);
      if (here.length) return regionPlan(r, here, this.lieu());
    }
    return showcasePlan((s) => this.data.tale(s));
  });
  readonly hotspots = computed(() => this.plan()?.spots ?? []);
  /** Bouton de retour à la carte, sur cette région. */
  readonly backQuery = computed(() => (this.region() ? { region: this.region() } : {}));

  /* conte ouvert */
  readonly spot = signal<Hotspot | null>(null);
  /** objet tout proche : touche Entrée */
  readonly nearId = signal<string | null>(null);
  readonly nearSpot = computed(() => this.hotspots().find((h) => h.id === this.nearId()) ?? null);
  private griotIndex = signal(this.dayIndex());
  readonly lang = signal('fr');
  readonly telling = signal(false);
  readonly paused = signal(false);
  readonly sceneIndex = signal(0);
  readonly subtitle = signal('');

  /** Contes que le griot propose : ceux du village. */
  private griotTales = computed(() => {
    const local = this.hotspots().flatMap((h) => (h.slug ? [this.data.tale(h.slug)] : [])).filter((t): t is Tale => !!t);
    return local.length ? local : this.data.tales().filter((t) => t.featured);
  });
  readonly tale = computed<Tale | undefined>(() => {
    const s = this.spot();
    if (!s) return undefined;
    if (s.slug) return this.data.tale(s.slug);
    const l = this.griotTales();
    return l.length ? l[this.griotIndex() % l.length] : undefined;
  });
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

  /** Les contes des autres régions : les choisir, c'est partir dans leur village. */
  readonly elsewhere = computed(() => {
    const q = this.fold(this.query().trim());
    const regions = this.data.regionMap();
    const here = new Set(this.hotspots().map((h) => h.slug));
    return this.data
      .tales()
      .filter((t) => !here.has(t.slug))
      .map((t) => ({ slug: t.slug, code: t.region, title: taleText(t, 'fr').title, place: t.place, region: regions.get(t.region)?.name ?? '' }))
      .filter((t) => !q || this.fold(`${t.title} ${t.place} ${t.region}`).includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  });
  readonly localTales = computed(() => {
    const q = this.fold(this.query().trim());
    return this.hotspots().filter((h) => !q || this.fold(h.label).includes(q));
  });
  readonly scene = computed(() => (this.telling() ? this.tale()?.scenes[this.sceneIndex()] : undefined));
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
  private builtKey = '';

  constructor() {
    // le village suit l'URL : arrivée depuis la carte, ou voyage vers un autre conte
    effect(() => {
      const plan = this.plan();
      const conte = this.conte();
      if (!plan) return;
      untracked(() => {
        if (plan.key !== this.builtKey) this.build(plan, conte);
        else if (conte) this.focusTale(conte);
      });
    });
    effect(() => {
      const els = new Map(this.labelEls().map((e) => [e.nativeElement.dataset['id']!, e.nativeElement]));
      this.world?.setLabels(els);
    });
    effect(() => {
      const list = this.langs();
      if (list.length && !list.some((l) => l.code === this.lang())) this.lang.set(list[0].code);
    });
    this.lostCheck = window.setInterval(() => {
      if (this.world?.lost) {
        clearInterval(this.lostCheck);
        this.stopTelling();
        this.state.set('lost');
      }
    }, 1000);
  }

  private fold(x: string) {
    return x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  }

  private build(plan: VillagePlan, conte?: string) {
    const entered = this.state() === 'in';
    this.traveling.set(entered);
    this.stopTelling();
    this.spot.set(null);
    this.nearId.set(null);
    this.listOpen.set(false);
    this.query.set('');
    this.builtKey = plan.key;
    // laisse l'écran de chargement s'afficher avant de construire la scène
    setTimeout(() => {
      try {
        this.world?.dispose();
        this.world = undefined;
        const world = this.zone.runOutsideAngular(
          () =>
            new VeilleeWorld(
              this.canvasHost().nativeElement,
              {
                select: (id) => this.zone.run(() => this.open(id)),
                listener: (f, p) => this.sound?.listener(f, p),
                near: (id) => this.zone.run(() => this.nearId.set(id)),
              },
              plan,
            ),
        );
        this.world = world;
        world.setLabels(new Map(this.labelEls().map((e) => [e.nativeElement.dataset['id']!, e.nativeElement])));
        if (!entered) this.state.set('ready');
        this.traveling.set(false);
        if (conte) this.focusTale(conte);
      } catch {
        this.traveling.set(false);
        this.state.set('nogl');
      }
    }, 60);
  }

  private focusTale(slug: string) {
    const h = this.hotspots().find((x) => x.slug === slug);
    if (!h) return;
    this.world?.walkTo(h.id);
    this.spot.set(h);
  }

  ngOnDestroy() {
    clearInterval(this.lostCheck);
    this.stopTelling();
    this.world?.dispose();
    this.sound?.dispose();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    if (this.musicWasOn) this.ambience.start();
  }

  enter() {
    this.musicWasOn = this.ambience.playing();
    if (this.musicWasOn) this.ambience.stop();
    this.zone.runOutsideAngular(() => (this.sound = new VeilleeSound()));
    this.state.set('in');
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

  /* commandes à l'écran */

  press(code: string, on: boolean) {
    this.world?.press(code, on);
  }

  zoom(factor: number) {
    this.world?.zoomBy(factor);
  }

  /** Touche Entrée près d'un objet : ouvre son histoire, puis lance le récit. */
  @HostListener('document:keydown.enter', ['$event'])
  onEnter(e: Event) {
    const t = e.target as HTMLElement;
    if (this.state() !== 'in' || t?.matches?.('button, a, input, select, textarea')) return;
    e.preventDefault();
    this.interact();
  }

  interact() {
    const near = this.nearSpot();
    if (this.telling()) return;
    if (this.spot() && (!near || this.spot()!.id === near.id)) {
      this.tell();
      return;
    }
    if (near) this.open(near.id);
  }

  /* contes */

  visit(h: Hotspot) {
    this.listOpen.set(false);
    this.world?.walkTo(h.id);
    this.open(h.id);
  }

  /** Un conte d'une autre région : on part dans son village, où il a sa représentation. */
  travel(t: { slug: string; code: string }) {
    this.listOpen.set(false);
    void this.router.navigate(['/veillee'], { queryParams: { region: t.code, conte: t.slug } });
  }

  private open(id: string) {
    const h = this.hotspots().find((x) => x.id === id) ?? null;
    if (this.telling() && h?.id !== this.spot()?.id) this.stopTelling();
    this.spot.set(h);
  }

  close() {
    this.stopTelling();
    this.spot.set(null);
  }

  otherTale() {
    this.stopTelling();
    this.griotIndex.update((i) => i + 1);
  }

  tell() {
    const t = this.tale();
    if (!t) return;
    this.stopTelling();
    // un seul élément audio, créé pendant le geste : les téléphones refusent sinon d'enchaîner
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

  /** Change la langue en plein récit : le paragraphe en cours reprend dans la nouvelle langue. */
  changeLang(code: string) {
    this.lang.set(code);
    const t = this.tale();
    if (t && this.telling()) {
      this.paused.set(false);
      this.world?.setTalking(true);
      this.playScene(t, this.sceneIndex());
    }
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
