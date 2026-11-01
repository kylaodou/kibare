import { Component, DestroyRef, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '../../core/i18n.service';

type State = 'idle' | 'recording' | 'done' | 'denied';

/** Enregistreur vocal (MediaRecorder) avec vumètre en direct. */
@Component({
  selector: 'app-recorder',
  imports: [TranslatePipe],
  template: `
    <div class="rec" [class.live]="state() === 'recording'" [class.compact]="compact()">
      @switch (state()) {
        @case ('idle') {
          <button type="button" class="mic" (click)="start()" [attr.aria-label]="'rec.start' | t">
            <i class="fa-solid fa-microphone"></i>
          </button>
          <p class="hint">{{ 'rec.idle' | t }}</p>
          <label class="upload">
            <input type="file" accept="audio/*" (change)="upload($event)" />
            <i class="fa-solid fa-upload"></i> {{ 'rec.upload' | t }}
          </label>
        }
        @case ('recording') {
          <canvas #meter width="320" height="64" aria-hidden="true"></canvas>
          <div class="time"><span class="dot"></span> {{ clock() }}</div>
          <button type="button" class="mic stop" (click)="stop()" [attr.aria-label]="'rec.stop' | t">
            <i class="fa-solid fa-stop"></i>
          </button>
          <p class="hint">{{ 'rec.recording' | t }}</p>
        }
        @case ('done') {
          <div class="done-ico"><i class="fa-solid fa-circle-check"></i></div>
          <p class="hint"><strong>{{ 'rec.done' | t }}</strong> · {{ clock() }}</p>
          <audio [src]="url()" controls></audio>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reset()"><i class="fa-solid fa-rotate-left"></i> {{ 'rec.again' | t }}</button>
        }
        @case ('denied') {
          <div class="done-ico bad"><i class="fa-solid fa-microphone-slash"></i></div>
          <p class="hint">{{ 'rec.denied' | t }}</p>
          <label class="upload">
            <input type="file" accept="audio/*" (change)="upload($event)" />
            <i class="fa-solid fa-upload"></i> {{ 'rec.upload' | t }}
          </label>
        }
      }
    </div>
  `,
  styles: `
    .rec {
      display: flex; flex-direction: column; align-items: center; gap: 14px;
      padding: 32px 20px; border: 2px dashed var(--border-strong); border-radius: var(--radius-l);
      background: var(--surface-2); text-align: center; transition: border-color 0.3s, background-color 0.3s;
    }
    .rec.live { border-color: var(--y-red); border-style: solid; background: var(--y-red-soft); }
    /* version compacte : un enregistreur par paragraphe */
    .rec.compact { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 12px; padding: 12px 14px; }
    .rec.compact .mic { width: 52px; height: 52px; font-size: 1.2rem; box-shadow: 0 0 0 5px var(--y-red-soft); }
    .rec.compact .hint, .rec.compact canvas, .rec.compact .done-ico { display: none; }
    .rec.compact .time { font-size: 1.1rem; }
    .rec.compact audio { max-width: 260px; height: 40px; }
    .mic {
      width: 84px; height: 84px; border-radius: 50%; border: 0; cursor: pointer;
      background: var(--y-red); color: #fff; font-size: 1.9rem; box-shadow: 0 0 0 8px var(--y-red-soft);
      transition: transform 0.2s;
    }
    .mic:hover { transform: scale(1.06); }
    .mic.stop { background: var(--text); color: var(--bg); box-shadow: 0 0 0 8px rgb(0 0 0 / 0.08); animation: pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 16px rgb(214 40 40 / 0.15); } }
    .hint { margin: 0; color: var(--text-2); font-size: 0.92rem; max-width: 40ch; }
    .time { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-size: 1.6rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--y-red); animation: blink 1s steps(2) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    canvas { width: 100%; max-width: 320px; height: 64px; }
    audio { width: 100%; max-width: 380px; }
    .done-ico { font-size: 2.6rem; color: var(--y-green); }
    .done-ico.bad { color: var(--y-red); }
    .upload { display: inline-flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 600; color: var(--text-2); cursor: pointer; }
    .upload:hover { color: var(--text); }
    .upload input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  `,
})
export class RecorderComponent {
  readonly recorded = output<Blob | null>();
  readonly compact = input(false);
  readonly state = signal<State>('idle');
  readonly seconds = signal(0);
  readonly url = signal<string>('');

  private meter = viewChild<ElementRef<HTMLCanvasElement>>('meter');
  private rec?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private timer?: number;
  private raf = 0;
  private ctx?: AudioContext;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cleanup());
  }

  clock() {
    const s = this.seconds();
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      this.state.set('denied');
      return;
    }
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.onstop = () => {
      const blob = new Blob(this.chunks, { type: this.rec?.mimeType || 'audio/webm' });
      this.url.set(URL.createObjectURL(blob));
      this.state.set('done');
      this.recorded.emit(blob);
      this.cleanup();
    };
    this.rec.start(250);
    this.seconds.set(0);
    this.state.set('recording');
    this.timer = window.setInterval(() => {
      this.seconds.update((s) => s + 1);
      if (this.seconds() >= 600) this.stop();
    }, 1000);
    setTimeout(() => this.drawMeter(), 30);
  }

  stop() {
    this.rec?.state === 'recording' && this.rec.stop();
  }

  reset() {
    if (this.url()) URL.revokeObjectURL(this.url());
    this.url.set('');
    this.state.set('idle');
    this.recorded.emit(null);
  }

  upload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.url.set(URL.createObjectURL(file));
    const a = new Audio(this.url());
    a.onloadedmetadata = () => this.seconds.set(Math.round(a.duration || 0));
    this.state.set('done');
    this.recorded.emit(file);
  }

  private drawMeter() {
    const canvas = this.meter()?.nativeElement;
    if (!canvas || !this.stream) return;
    this.ctx = new AudioContext();
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 64;
    this.ctx.createMediaStreamSource(this.stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const g = canvas.getContext('2d')!;
    const red = getComputedStyle(document.documentElement).getPropertyValue('--y-red').trim() || '#d62828';
    const draw = () => {
      this.raf = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      g.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 24;
      const w = canvas.width / bars;
      for (let i = 0; i < bars; i++) {
        const v = data[i] / 255;
        const h = Math.max(4, v * canvas.height);
        g.fillStyle = red;
        g.beginPath();
        g.roundRect(i * w + 2, (canvas.height - h) / 2, w - 4, h, 3);
        g.fill();
      }
    };
    draw();
  }

  private cleanup() {
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = undefined;
  }
}
