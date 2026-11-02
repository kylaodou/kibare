import { Injectable, signal } from '@angular/core';
import { Sky } from './models';

/** Gamme pentatonique (ré mineur) jouée par le balafon. */
const SCALE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25, 587.33];

/**
 * Ambiance musicale propre à chaque région : enregistrements historiques libres de droits
 * (Exposition coloniale de 1931, collection Gallica/BnF ; balafon sénoufo CC BY 4.0).
 * Le Liptako et le Soum (ex-Sahel), sans enregistrement libre disponible, garde la synthèse en direct.
 */
const MUSIC_KEY = 'kibare.music';

export const REGION_SOUND: Record<string, { file: string; label: string }> = {
  kadiogo: { file: 'mossi-ouisse', label: 'Flûtes ouissé et percussions mossi (1931)' },
  oubri: { file: 'mossi-konde', label: 'Luth kondé et chant mossi (1931)' },
  yaadga: { file: 'mossi-lounga', label: 'Tambours lounga, chants pour le roi (1931)' },
  kuilse: { file: 'mossi-teko', label: 'Chant de nostalgie avec kondé (1931)' },
  nando: { file: 'labour-tiefo', label: 'Chant de labour, sonnailles et percussions (1931)' },
  nakambe: { file: 'fete-tiefo', label: 'Chant de fête avec sonnailles (1931)' },
  goulmou: { file: 'rituel', label: 'Chant rituel avec sonnailles (1931)' },
  tapoa: { file: 'rituel', label: 'Chant rituel avec sonnailles (1931)' },
  sirba: { file: 'rituel', label: 'Chant rituel avec sonnailles (1931)' },
  nazinon: { file: 'kassena-flute', label: 'Petite flûte kassena (1931)' },
  tannounyan: { file: 'balafon-senoufo', label: 'Balafon sénoufo' },
  guiriko: { file: 'balafon-djembe', label: 'Balafon et djembé' },
  djoro: { file: 'balafon-rythmes', label: 'Rythmes de balafon' },
  bankui: { file: 'balafon-trad', label: 'Balafon traditionnel' },
  sourou: { file: 'balafon-trad', label: 'Balafon traditionnel' },
};

/**
 * Bande sonore d'ambiance : enregistrement de la région du conte quand il existe,
 * sinon balafon pentatonique synthétisé (Web Audio API) ; grillons la nuit, oiseaux le jour.
 */
@Injectable({ providedIn: 'root' })
export class AmbienceService {
  readonly playing = signal(false);
  readonly volume = signal(0.6);

  private ctx?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private timer?: number;
  private nextNote = 0;
  private nextCritter = 0;
  private step = 0;
  private degree = 5;
  private mood: Sky = 'night';
  private region: string | null = null;
  private rec?: HTMLAudioElement;
  private ducked = false;
  /** enregistrement en cours (affiché dans le lecteur) */
  readonly credit = signal<string | null>(null);

  constructor() {
    // musique activée par défaut à chaque visite ; seul un « couper » pendant la visite est retenu
    let wanted = true;
    try {
      wanted = sessionStorage.getItem(MUSIC_KEY) !== 'off';
    } catch {}
    if (!wanted) return;
    this.start();
    // si le navigateur bloque le son avant toute interaction, il démarre au premier geste
    const unlock = () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      if (!this.playing()) return;
      void this.ctx?.resume();
      if (this.rec?.paused) void this.rec.play().then(() => this.fade(this.rec!, this.recVolume(), 1200)).catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('touchstart', unlock, true);
  }

  setMood(sky: Sky) {
    this.mood = sky;
  }

  /** Choisit l'ambiance de la région (null = ambiance générale). */
  setRegion(code: string | null) {
    if (code === this.region) return;
    this.region = code;
    if (this.playing()) this.swapRecording();
  }

  private swapRecording() {
    const old = this.rec;
    if (old) this.fade(old, 0, 800, true);
    this.rec = undefined;
    this.credit.set(null);
    const s = this.region ? REGION_SOUND[this.region] : undefined;
    if (!s || !this.playing()) return;
    const a = new Audio(`audio/ambience/${s.file}.mp3`);
    a.loop = true;
    a.volume = 0;
    void a.play().then(() => this.fade(a, this.recVolume(), 1500)).catch(() => {});
    this.rec = a;
    this.credit.set(s.label);
  }

  private recVolume() {
    return (this.ducked ? 0.12 : 0.5) * this.volume();
  }

  private fade(a: HTMLAudioElement, to: number, ms: number, stopAfter = false) {
    const from = a.volume;
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(tick);
      else if (stopAfter) a.pause();
    };
    tick();
  }

  toggle() {
    const on = !this.playing();
    try {
      sessionStorage.setItem(MUSIC_KEY, on ? 'on' : 'off');
    } catch {}
    on ? this.start() : this.stop();
  }

  start() {
    if (this.playing()) return;
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.22 * this.volume(), ctx.currentTime + 1.5);
    this.noise ??= this.makeNoise(ctx);
    this.nextNote = ctx.currentTime + 0.3;
    this.nextCritter = ctx.currentTime + 0.5;
    this.timer = window.setInterval(() => this.schedule(), 90);
    this.playing.set(true);
    this.swapRecording();
  }

  stop() {
    if (!this.ctx || !this.master) return;
    const m = this.master;
    m.gain.cancelScheduledValues(this.ctx.currentTime);
    m.gain.setValueAtTime(m.gain.value, this.ctx.currentTime);
    m.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
    setTimeout(() => m.disconnect(), 700);
    clearInterval(this.timer);
    if (this.rec) this.fade(this.rec, 0, 600, true);
    this.rec = undefined;
    this.credit.set(null);
    this.playing.set(false);
  }

  setVolume(v: number) {
    this.volume.set(v);
    if (this.ctx && this.master && this.playing()) {
      this.master.gain.setTargetAtTime(0.22 * v, this.ctx.currentTime, 0.2);
    }
  }

  /** Atténue l'ambiance pendant que la narration parle. */
  duck(on: boolean) {
    this.ducked = on;
    if (this.rec) this.fade(this.rec, this.recVolume(), 400);
    if (!this.ctx || !this.master || !this.playing()) return;
    this.master.gain.setTargetAtTime((on ? 0.08 : 0.22) * this.volume(), this.ctx.currentTime, 0.4);
  }

  private schedule() {
    const ctx = this.ctx!;
    const horizon = ctx.currentTime + 0.4;
    const beat = 60 / 84 / 2;
    while (this.nextNote < horizon) {
      const phrase = this.step % 16;
      // phrases de 12 croches puis un silence de 4 croches
      if (!this.rec && phrase < 12 && Math.random() > 0.22) {
        this.degree = Math.min(SCALE.length - 1, Math.max(0, this.degree + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
        this.balafon(SCALE[this.degree], this.nextNote, phrase % 4 === 0 ? 1 : 0.7);
        if (phrase === 0) this.balafon(SCALE[Math.max(0, this.degree - 5)], this.nextNote, 0.5);
      }
      this.nextNote += beat * (Math.random() < 0.08 ? 0.5 : 1);
      this.step++;
    }
    while (this.nextCritter < horizon) {
      if (this.mood === 'night' || this.mood === 'dusk') {
        this.cricket(this.nextCritter, Math.random() < 0.5 ? -0.6 : 0.6);
        this.nextCritter += 0.45 + Math.random() * 0.9;
      } else {
        if (Math.random() < 0.35) this.bird(this.nextCritter);
        this.nextCritter += 1.5 + Math.random() * 3;
      }
    }
  }

  private balafon(freq: number, t: number, vel: number) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.connect(this.master!);
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.5;
    pan.connect(out);

    // fondamentale + partiel inharmonique typique des lames en bois
    for (const [mult, amp, decay] of [
      [1, 0.55, 0.9],
      [3.93, 0.16, 0.18],
      [9.2, 0.05, 0.05],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * vel, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
    // attaque de la mailloche
    const n = ctx.createBufferSource();
    n.buffer = this.noise!;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 4;
    bp.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.18 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(bp).connect(ng).connect(pan);
    n.start(t, Math.random());
    n.stop(t + 0.05);
  }

  private cricket(t: number, panValue: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.value = 4300 + Math.random() * 400;
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createStereoPanner();
    pan.pan.value = panValue;
    o.connect(g).connect(pan).connect(this.master!);
    const pulses = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < pulses; i++) {
      const s = t + i * 0.055;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.035, s + 0.012);
      g.gain.linearRampToValueAtTime(0, s + 0.035);
    }
    o.start(t);
    o.stop(t + pulses * 0.055 + 0.05);
  }

  private bird(t: number) {
    const ctx = this.ctx!;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const s = t + i * 0.14;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const base = 2400 + Math.random() * 900;
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * 1.35, s + 0.08);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.03, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.11);
      o.connect(g).connect(this.master!);
      o.start(s);
      o.stop(s + 0.13);
    }
  }

  private makeNoise(ctx: AudioContext) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
}
