/** Paysage sonore de la Veillée, synthétisé sur place (aucun fichier à charger) : crépitement du feu selon la distance, grillons de la nuit, grenouilles près de la mare. */
export class VeilleeSound {
  private ctx = new AudioContext();
  private master = this.ctx.createGain();
  private fire = this.ctx.createGain();
  private crickets = this.ctx.createGain();
  private frogs = this.ctx.createGain();
  private timers: number[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private level = 1;
  private ducked = false;

  constructor() {
    void this.ctx.resume();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    [this.fire, this.crickets, this.frogs].forEach((g) => {
      g.gain.value = 0;
      g.connect(this.master);
    });
    this.buildFire();
    this.buildCrickets();
    this.timers.push(window.setInterval(() => this.crackle(), 170));
    this.timers.push(window.setInterval(() => this.frog(), 700));
    this.crickets.gain.value = 0.05;
    this.apply();
  }

  private noise(seconds: number) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  private buildFire() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise(3);
    src.loop = true;
    const low = this.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 480;
    const g = this.ctx.createGain();
    g.gain.value = 0.34;
    src.connect(low).connect(g).connect(this.fire);
    src.start();
    this.sources.push(src);
  }

  private crackle() {
    if (Math.random() > 0.55 || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise(0.05);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1200 + Math.random() * 3200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25 + Math.random() * 0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hp).connect(g).connect(this.fire);
    src.start(t);
  }

  private buildCrickets() {
    [4300, 4780].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f;
      const trem = this.ctx.createGain();
      trem.gain.value = 0;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 13 + i * 3.7;
      const depth = this.ctx.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth).connect(trem.gain);
      // silences réguliers entre les stridulations
      const slow = this.ctx.createOscillator();
      slow.frequency.value = 0.42 + i * 0.13;
      const slowDepth = this.ctx.createGain();
      slowDepth.gain.value = 0.5;
      const gate = this.ctx.createGain();
      gate.gain.value = 0.5;
      slow.connect(slowDepth).connect(gate.gain);
      osc.connect(trem).connect(gate).connect(this.crickets);
      [osc, lfo, slow].forEach((n) => n.start());
      this.sources.push(osc, lfo, slow);
    });
  }

  private frog() {
    if (Math.random() > 0.45 || this.frogs.gain.value < 0.01 || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const f = 160 + Math.random() * 90;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t + i * 0.13);
      osc.frequency.linearRampToValueAtTime(f * 1.25, t + i * 0.13 + 0.07);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t + i * 0.13);
      g.gain.linearRampToValueAtTime(0.3, t + i * 0.13 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.09);
      osc.connect(g).connect(this.frogs);
      osc.start(t + i * 0.13);
      osc.stop(t + i * 0.13 + 0.1);
    }
  }

  /** Le son suit le visiteur : le feu près du feu, les grenouilles près de la mare. */
  listener(fireDist: number, pondDist: number) {
    const t = this.ctx.currentTime;
    this.fire.gain.setTargetAtTime(Math.min(0.7, 3.2 / Math.max(2.5, fireDist)), t, 0.3);
    this.frogs.gain.setTargetAtTime(Math.max(0, 0.32 * (1 - pondDist / 15)), t, 0.4);
    this.crickets.gain.setTargetAtTime(0.03 + Math.min(0.05, fireDist * 0.003), t, 0.5);
  }

  setMuted(m: boolean) {
    this.level = m ? 0 : 1;
    this.apply();
  }

  /** Baisse le décor sonore pendant que le griot raconte. */
  duck(on: boolean) {
    this.ducked = on;
    this.apply();
  }

  private apply() {
    this.master.gain.setTargetAtTime(this.level * (this.ducked ? 0.28 : 0.85), this.ctx.currentTime, 0.4);
  }

  dispose() {
    this.timers.forEach((t) => clearInterval(t));
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    void this.ctx.close();
  }
}
