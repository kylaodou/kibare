import { Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';

/** Lecteur audio HTML5 compact : lecture/pause, temps écoulé et durée, barre de progression liée à « timeupdate » et déplaçable, états de chargement et d'erreur. */
@Component({
  selector: 'app-audio-player',
  template: `
    <div class="ap" [class.err]="error()" [class.playing]="playing()">
      <audio #el [src]="src()" preload="metadata"
        (loadedmetadata)="onMeta()" (durationchange)="onMeta()" (timeupdate)="onTime()"
        (play)="playing.set(true)" (pause)="playing.set(false)" (ended)="onEnded()"
        (waiting)="loading.set(true)" (canplay)="loading.set(false)" (error)="onError()"></audio>
      @if (error()) {
        <span class="msg" role="alert"><i class="fa-solid fa-triangle-exclamation"></i> Fichier audio illisible ou introuvable</span>
      } @else {
        <button type="button" class="pp" (click)="toggle()" [attr.aria-label]="playing() ? 'Mettre en pause' : 'Écouter'" [disabled]="!src()">
          @if (loading() && playing()) {
            <i class="fa-solid fa-spinner fa-spin"></i>
          } @else {
            <i class="fa-solid" [class.fa-play]="!playing()" [class.fa-pause]="playing()"></i>
          }
        </button>
        <span class="t">{{ fmt(current()) }}</span>
        <input type="range" class="bar" min="0" [max]="duration() || 0" step="0.1" [value]="current()"
          [disabled]="!duration()" (input)="seek($any($event.target).valueAsNumber)"
          [style.--p]="duration() ? (current() / duration()) * 100 + '%' : '0%'"
          [attr.aria-label]="'Position de lecture' + (label() ? ' — ' + label() : '')"
          [attr.aria-valuetext]="fmt(current()) + ' sur ' + (duration() ? fmt(duration()) : 'durée inconnue')" />
        <span class="t">{{ duration() ? fmt(duration()) : '--:--' }}</span>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .ap { display: flex; align-items: center; gap: 10px; padding: 6px 10px 6px 6px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); min-width: 0; }
    .ap.err { border-color: var(--y-flag-red, #b3261e); padding: 8px 12px; }
    audio { display: none; }
    .pp { flex: none; width: 34px; height: 34px; border-radius: 50%; border: 0; background: var(--y-red); color: #fff; cursor: pointer; display: grid; place-items: center; font-size: 0.85rem; }
    .pp:disabled { opacity: 0.5; cursor: default; }
    .pp:focus-visible, .bar:focus-visible { outline: 2px solid var(--y-ochre); outline-offset: 2px; }
    .t { flex: none; font-size: 0.78rem; font-variant-numeric: tabular-nums; color: var(--text-2); min-width: 36px; text-align: center; }
    .bar { flex: 1; min-width: 60px; height: 6px; appearance: none; -webkit-appearance: none; border-radius: 3px; cursor: pointer;
      background: linear-gradient(to right, var(--y-red) var(--p), var(--border-strong) var(--p)); }
    .bar:disabled { cursor: default; }
    .bar::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--y-red); border: 2px solid #fff; box-shadow: 0 0 0 1px var(--y-red); }
    .bar::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: var(--y-red); border: 2px solid #fff; }
    .msg { font-size: 0.82rem; color: var(--y-flag-red, #b3261e); font-weight: 600; }
  `,
})
export class AudioPlayerComponent {
  readonly src = input<string>('');
  readonly label = input<string>('');

  readonly playing = signal(false);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly current = signal(0);
  readonly duration = signal(0);

  private el = viewChild.required<ElementRef<HTMLAudioElement>>('el');
  private probing = false;

  constructor() {
    // nouvelle source : on repart de zéro
    effect(() => {
      this.src();
      this.error.set(false);
      this.current.set(0);
      this.duration.set(0);
      this.playing.set(false);
    });
    inject(DestroyRef).onDestroy(() => this.el()?.nativeElement.pause());
  }

  toggle() {
    const a = this.el().nativeElement;
    if (a.paused) {
      // un seul lecteur à la fois sur la page
      document.querySelectorAll('app-audio-player audio').forEach((o) => o !== a && (o as HTMLAudioElement).pause());
      a.play().catch(() => this.onError());
    } else a.pause();
  }

  seek(v: number) {
    if (!Number.isFinite(v)) return;
    this.el().nativeElement.currentTime = v;
    this.current.set(v);
  }

  onMeta() {
    const a = this.el().nativeElement;
    if (Number.isFinite(a.duration) && a.duration > 0) {
      this.duration.set(a.duration);
      if (this.probing) {
        this.probing = false;
        a.currentTime = 0;
        this.current.set(0);
      }
    } else if (a.duration === Infinity && !this.probing) {
      // durée inconnue (WebM enregistré) : un saut très loin force le navigateur à la calculer
      this.probing = true;
      a.currentTime = 1e101;
    }
  }

  onTime() {
    if (this.probing) return;
    this.current.set(this.el().nativeElement.currentTime);
  }

  onEnded() {
    this.playing.set(false);
    this.current.set(this.duration());
  }

  onError() {
    this.error.set(true);
    this.playing.set(false);
    this.loading.set(false);
  }

  fmt(s: number) {
    if (!Number.isFinite(s) || s < 0) return '--:--';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }
}
