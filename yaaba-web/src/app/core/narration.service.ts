import { Injectable, signal } from '@angular/core';

const LOCALES: Record<string, string[]> = {
  fr: ['fr-FR', 'fr-BF', 'fr-CA', 'fr'],
  en: ['en-GB', 'en-US', 'en'],
};

/** Narration par synthèse vocale (Web Speech API), phrase par phrase, pour pouvoir surligner la phrase lue à l'écran (lecture « karaoké »). */
@Injectable({ providedIn: 'root' })
export class NarrationService {
  readonly speaking = signal(false);
  readonly paused = signal(false);
  /** Index de la phrase en cours de lecture, -1 sinon. */
  readonly current = signal(-1);
  readonly rate = signal(0.95);

  private queue: string[] = [];
  private lang = 'fr';
  private onDone?: () => void;
  private token = 0;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (!this.supported) return;
    const load = () => (this.voices = speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
  }

  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  canSpeak(lang: string) {
    return this.supported && lang in LOCALES;
  }

  static sentences(text: string): string[] {
    // le guillemet fermant, même précédé d'une espace (« … ! »), reste attaché à sa phrase
    return (text.match(/[^.!?…]+[.!?…]+(?:\s*["»”])*\s*|[^.!?…]+$/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
  }

  speak(sentences: string[], lang: string, from = 0, onDone?: () => void) {
    if (!this.canSpeak(lang)) return;
    this.stop();
    this.queue = sentences;
    this.lang = lang;
    this.onDone = onDone;
    this.speaking.set(true);
    this.paused.set(false);
    this.next(from, ++this.token);
  }

  private next(i: number, token: number) {
    if (token !== this.token) return;
    if (i >= this.queue.length) {
      this.speaking.set(false);
      this.current.set(-1);
      const done = this.onDone;
      this.onDone = undefined;
      done?.();
      return;
    }
    this.current.set(i);
    const u = new SpeechSynthesisUtterance(this.queue[i]);
    const voice = this.pickVoice(this.lang);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? LOCALES[this.lang][0];
    u.rate = this.rate();
    u.pitch = 1;
    u.onend = () => this.next(i + 1, token);
    u.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') this.next(i + 1, token);
    };
    speechSynthesis.speak(u);
  }

  pause() {
    if (!this.speaking()) return;
    speechSynthesis.pause();
    this.paused.set(true);
  }

  resume() {
    speechSynthesis.resume();
    this.paused.set(false);
  }

  stop() {
    this.token++;
    this.onDone = undefined;
    if (this.supported) speechSynthesis.cancel();
    this.speaking.set(false);
    this.paused.set(false);
    this.current.set(-1);
  }

  private pickVoice(lang: string): SpeechSynthesisVoice | undefined {
    const locales = LOCALES[lang] ?? [lang];
    const candidates = this.voices.filter((v) => locales.some((l) => v.lang.toLowerCase().startsWith(l.toLowerCase())));
    const score = (v: SpeechSynthesisVoice) =>
      (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
    return candidates.sort((a, b) => score(b) - score(a))[0];
  }
}
