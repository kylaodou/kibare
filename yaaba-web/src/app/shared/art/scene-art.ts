import { Art } from '../../core/models';
import { BASE, H, ITEMS, SKIES, W, backdrop } from './art-items';

/** Personnages et animaux : ils entrent dans le cadre en marchant et projettent une ombre au sol. */
const ACTORS = new Set([
  'man', 'man-talk', 'man-point', 'man-up', 'woman', 'woman-talk', 'woman-up', 'woman-pound',
  'child', 'child-up', 'elder', 'king', 'king-talk', 'hunter', 'shepherd', 'princess', 'old-woman', 'dwarf',
  'rider', 'horse', 'horse-run', 'hare', 'hyena', 'dog', 'cow', 'wild-cow', 'lion', 'elephant', 'ram', 'goat',
  'chicken', 'partridge', 'guinea-fowl', 'tortoise', 'mouse', 'monkey', 'toad', 'hippo', 'crocodile', 'yboumbouni',
]);

/** Mouvements de caméra, un par scène, comme des plans de film. */
const CAMERAS = ['cam-push', 'cam-pan-r', 'cam-pull', 'cam-pan-l', 'cam-rise'];

export interface RenderOptions {
  animate?: boolean;
  enter?: boolean;
  /** mode « film » : numéro de scène → mouvement de caméra, entrée des personnages, particules */
  cinema?: number;
}

/** Construit le SVG complet d'une scène illustrée. */
export function renderArt(art: Art, opts: RenderOptions = {}): string {
  const p = SKIES[art.sky] ?? SKIES.day;
  const { back, front } = backdrop(art.sky, art.ground, p);
  const normal: string[] = [];
  const lights: string[] = [];
  const cinema = opts.cinema !== undefined && opts.animate !== false;

  art.items.forEach((it, i) => {
    const def = ITEMS[it.k];
    if (!def) return;
    const s = it.s ?? 1;
    const x = (it.x / 100) * W;
    const y = BASE - (it.y ?? 0);
    const actor = ACTORS.has(it.k);
    const anim = opts.animate === false ? '' : (it.a ?? def.anim ?? '');
    let enter = '';
    if (cinema && actor) {
      // entrée en marchant depuis le bord le plus proche
      enter = `class="${it.x < 50 ? 'walk-l' : 'walk-r'}" style="animation-delay:${300 + i * 260}ms"`;
    } else if (opts.enter || cinema) {
      enter = `class="enter" style="animation-delay:${120 + i * 70}ms"`;
    }
    const shadow = actor && (it.y ?? 0) <= 20 ? `<ellipse cx="0" cy="1" rx="22" ry="4" fill="#1E1611" opacity="0.14"/>` : '';
    // l'entrée est hors de l'échelle : un personnage retourné marche quand même dans le bon sens
    const svg =
      `<g transform="translate(${x.toFixed(1)},${y})"><g ${enter}><g transform="scale(${it.flip ? -s : s},${s})">` +
      `${shadow}<g class="${anim}" style="animation-delay:${(-(i * 0.7) % 3).toFixed(2)}s">${def.draw(p, it)}</g></g></g></g>`;
    (def.light ? lights : normal).push(svg);
  });

  const tint = p.tint ? `<rect width="${W}" height="${H}" fill="${p.tint.c}" opacity="${p.tint.o}"/>` : '';
  const particles = opts.animate === false ? '' : ambient(art.sky);
  const cam = cinema ? CAMERAS[opts.cinema! % CAMERAS.length] : 'kb';

  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<g class="${cam}">${back}<g class="layer-items">${normal.join('')}</g>${front}${tint}${lights.join('')}${particles}</g></svg>`
  );
}

/** Particules d'atmosphère : poussière dorée le jour, oiseaux au crépuscule, lucioles la nuit. */
function ambient(sky: string): string {
  let out = '';
  if (sky === 'night') {
    for (let i = 0; i < 14; i++) {
      const x = 40 + ((i * 97) % 720);
      const y = 250 + ((i * 53) % 150);
      out += `<circle cx="${x}" cy="${y}" r="2.2" fill="#FBB117" class="p-firefly" style="animation-delay:${((i * 0.83) % 6).toFixed(2)}s;animation-duration:${(5 + (i % 4)).toFixed(1)}s"/>`;
    }
  } else if (sky === 'dusk') {
    for (let i = 0; i < 5; i++) {
      const y = 70 + i * 18;
      out +=
        `<g transform="translate(0 ${y - 90})"><path d="M0 0 Q5 -5 10 0 Q15 -5 20 0" fill="none" stroke="#3B2417" stroke-width="2" ` +
        `stroke-linecap="round" class="p-flock" style="animation-delay:${(i * 0.9).toFixed(1)}s"/></g>`;
    }
  } else {
    for (let i = 0; i < 18; i++) {
      const x = (i * 131) % 800;
      const y = 200 + ((i * 47) % 200);
      out += `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 1.8 : 1.2}" fill="#FFF6DD" class="p-mote" style="animation-delay:${((i * 0.61) % 8).toFixed(2)}s"/>`;
    }
  }
  return `<g class="particles">${out}</g>`;
}
