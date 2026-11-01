import { Tale } from '../../core/models';
import { TYPE_ICON } from '../../shared/tale-card/tale-card.component';

/** Teintes « terre et savane » pour distinguer les régions sans couleurs criardes. */
export const REGION_TONES_LIGHT = ['#E8D9BC', '#DCC7A1', '#E3CFAE', '#D6BE94', '#E9DDC4', '#DDC9A6', '#D3BA8E', '#E6D5B5', '#D9C39C', '#E1CCA8', '#D0B588', '#E4D2B0', '#DAC5A0'];
export const REGION_TONES_DARK = ['#5A4F40', '#625645', '#574C3E', '#675A48', '#5D5242', '#615544', '#54493B', '#665947', '#5B5041', '#5F5443', '#52473A', '#645846', '#594E3F'];

/** Couleurs des bandes tissées Faso Dan Fani. */
export const COLORS = {
  red: '#E69135', // sélection : ocre
  yellow: '#FBB117',
  green: '#009E49',
  brown: '#7C3109',
  ochre: '#E69135',
};

export const TYPE_COLOR: Record<string, string> = {
  legende: COLORS.brown,
  conte: COLORS.green,
  recit: COLORS.ochre,
};

export function pinHtml(t: Tale, title: string, active: boolean) {
  return `<span class="y-pin y-pin-${t.type}${active ? ' active' : ''}" role="button" tabindex="0" aria-label="${title.replace(/"/g, '&quot;')}"><i class="fa-solid ${TYPE_ICON[t.type]}"></i></span>`;
}

/* ---------- placement (unités : 1° = 10) ---------- */

export function inside(x: number, y: number, ring: [number, number][]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function segDist(x: number, y: number, [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** Point de la région le plus éloigné à la fois de ses bords et des épingles : l'étiquette y reste lisible. */
export function labelSpot(ring: [number, number][], pins: [number, number][]): [number, number] {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2];
  let bestScore = -Infinity;
  for (let i = 1; i < 18; i++) {
    for (let j = 1; j < 18; j++) {
      const x = x0 + ((x1 - x0) * i) / 18;
      const y = y0 + ((y1 - y0) * j) / 18;
      if (!inside(x, y, ring)) continue;
      let edge = Infinity;
      for (let k = 0, l = ring.length - 1; k < ring.length; l = k++) edge = Math.min(edge, segDist(x, y, ring[l], ring[k]));
      const pin = pins.length ? Math.min(...pins.map(([px, py]) => Math.hypot(x - px, y - py - 0.8))) : 6;
      const score = Math.min(edge, 3) + Math.min(pin, 4) * 1.2;
      if (score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
  }
  return best;
}

/** Écarte en couronne les épingles trop proches (plusieurs contes autour d'un même lieu). */
export function spread(points: [number, number][], radius = 2): [number, number][] {
  const groups: { c: [number, number]; idx: number[] }[] = [];
  points.forEach((p, i) => {
    const g = groups.find((o) => Math.hypot(o.c[0] - p[0], o.c[1] - p[1]) < radius);
    if (g) g.idx.push(i);
    else groups.push({ c: [...p], idx: [i] });
  });
  const out = [...points];
  for (const g of groups) {
    if (g.idx.length < 2) continue;
    const r = 0.9 + 0.25 * g.idx.length;
    g.idx.forEach((i, k) => {
      const a = (k / g.idx.length) * Math.PI * 2 - Math.PI / 2;
      out[i] = [g.c[0] + Math.cos(a) * r, g.c[1] + Math.sin(a) * r];
    });
  }
  return out;
}
