/* ==========================================================================
   Bibliothèque d'éléments d'illustration (SVG, aplats de couleurs).
   Chaque élément est dessiné autour de son point d'ancrage (0,0) = pied de l'objet.
   ========================================================================== */

import { ArtItem, Ground, Sky } from '../../core/models';

export const W = 800;
export const H = 450;
export const BASE = 395;

export interface Palette {
  sky: string;
  far: string;
  near: string;
  ground: string;
  ground2: string;
  grass: string;
  water: string;
  water2: string;
  tint?: { c: string; o: number };
}

export const SKIES: Record<Sky, Palette> = {
  day: { sky: '#EEDFC2', far: '#DCC69B', near: '#CDAE78', ground: '#D6AE74', ground2: '#C89D62', grass: '#7B8F40', water: '#5F9CAE', water2: '#8CBBC7' },
  dawn: { sky: '#F5D9BA', far: '#E3BC93', near: '#D3A578', ground: '#D2A06C', ground2: '#C08E5B', grass: '#7B8A42', water: '#6E9FB0', water2: '#9AC0C9', tint: { c: '#F2A65A', o: 0.06 } },
  dusk: { sky: '#E7A672', far: '#C98159', near: '#B46B48', ground: '#A86A43', ground2: '#965B38', grass: '#5F6B35', water: '#5D7F92', water2: '#86A2AF', tint: { c: '#7A3418', o: 0.16 } },
  night: { sky: '#1C2337', far: '#262E47', near: '#20283D', ground: '#2A2832', ground2: '#24222B', grass: '#2F3A2E', water: '#26354F', water2: '#3B5078', tint: { c: '#10162B', o: 0.34 } },
};

/* Couleurs fixes des objets (la teinte de nuit/crépuscule est appliquée par-dessus). */
export const C = {
  red: '#D62828',
  green: '#00894A',
  yellow: '#FCD116',
  indigo: '#2F3E6B',
  white: '#F4EFE6',
  ink: '#2A221B',
  skin: '#6B4428',
  skinDark: '#4E3019',
  trunk: '#8B5E3C',
  baobab: '#9B7660',
  baobabDark: '#7E5C48',
  leaf: '#5C7F3B',
  leafDark: '#4A6B30',
  banco: '#C48A55',
  bancoDark: '#A8703F',
  straw: '#D8B66C',
  strawDark: '#B8944C',
  stone: '#A88A6A',
  stoneDark: '#8A6E52',
  laterite: '#A65E3E',
  lateriteDark: '#87482E',
  ochre: '#C9822B',
  wood: '#7A4E2D',
  croc: '#66713F',
  crocDark: '#4F5A30',
  moon: '#F3EAD3',
};

type Draw = (p: Palette, it: ArtItem) => string;

export interface ItemDef {
  draw: Draw;
  /** animation « au repos » appliquée à l'élément */
  anim?: string;
  /** dessiné au-dessus du voile de nuit (sources de lumière) */
  light?: boolean;
}

/* ---------- helpers ---------- */

const g = (inner: string, attrs = '') => `<g ${attrs}>${inner}</g>`;
const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const circle = (cx: number, cy: number, r: number, fill: string, extra = '') =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const stroke = (d: string, color: string, w: number, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

export function starPath(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}

/* ---------- personnages ---------- */

type Head = 'wrap' | 'bonnet' | 'cone' | 'hair' | 'cap' | 'none';
type Arms = 'down' | 'talk' | 'up' | 'hold' | 'cane' | 'bow' | 'point';

interface PersonOpt {
  robe: string;
  belt?: string;
  head?: Head;
  headColor?: string;
  arms?: Arms;
  beard?: boolean;
  extra?: string;
}

function person(o: PersonOpt): string {
  const skin = C.skin;
  const robe = o.robe;
  const parts: string[] = [];
  // pieds
  parts.push(`<ellipse cx="-7" cy="-2" rx="6.5" ry="3" fill="${C.skinDark}"/><ellipse cx="7" cy="-2" rx="6.5" ry="3" fill="${C.skinDark}"/>`);
  // bras arrière (derrière la robe) pour certaines poses
  const arm = (d: string) => stroke(d, robe, 8);
  const hand = (x: number, y: number) => circle(x, y, 4.2, skin);
  let arms = '';
  switch (o.arms ?? 'down') {
    case 'down':
      arms = arm('M-12,-78 Q-21,-58 -19,-40') + arm('M12,-78 Q21,-58 19,-40') + hand(-19, -38) + hand(19, -38);
      break;
    case 'talk':
      arms = arm('M-12,-78 Q-21,-58 -19,-40') + arm('M12,-78 Q28,-84 32,-102') + hand(-19, -38) + hand(33, -105);
      break;
    case 'up':
      arms = arm('M-12,-78 Q-26,-92 -30,-114') + arm('M12,-78 Q26,-92 30,-114') + hand(-31, -117) + hand(31, -117);
      break;
    case 'hold':
      arms = arm('M-12,-78 Q-21,-58 -19,-40') + arm('M12,-78 Q24,-68 34,-66') + hand(-19, -38) + hand(37, -66);
      break;
    case 'point':
      arms = arm('M-12,-78 Q-21,-58 -19,-40') + arm('M12,-78 Q30,-82 44,-88') + hand(-19, -38) + hand(47, -89);
      break;
    case 'cane':
      arms = arm('M-12,-78 Q-21,-58 -19,-40') + arm('M12,-78 Q24,-62 24,-46') + stroke('M26,-48 L30,0', C.wood, 3.5) + hand(-19, -38) + hand(25, -46);
      break;
    case 'bow':
      arms =
        arm('M-12,-78 Q-21,-58 -19,-40') +
        hand(-19, -38) +
        stroke('M26,-120 Q46,-80 26,-40', C.wood, 3.5) +
        stroke('M26,-120 L26,-40', '#EDE3D0', 1.2) +
        arm('M12,-78 Q22,-80 26,-82') +
        hand(27, -82);
      break;
  }
  // robe
  parts.push(path('M-13,-84 L13,-84 L23,-6 Q0,-1 -23,-6 Z', robe));
  // bandes tissées façon Faso Dan Fani en bas du vêtement
  parts.push(path('M-21.4,-20 L21.4,-20 L21.8,-17 L-21.8,-17Z', o.belt ?? C.white, 'opacity="0.9"'));
  parts.push(path('M-22.2,-13 L22.2,-13 L22.5,-11 L-22.5,-11Z', C.ink, 'opacity="0.35"'));
  parts.push(path('M-1.2,-84 L1.2,-84 L1.2,-56 L-1.2,-56Z', C.ink, 'opacity="0.18"'));
  if (o.belt) parts.push(path('M-16,-52 L16,-52 L17,-45 L-17,-45 Z', o.belt));
  parts.push(arms);
  // cou + tête (visage : yeux, nez, bouche discrets)
  parts.push(`<rect x="-4" y="-92" width="8" height="10" fill="${skin}"/>`);
  parts.push(circle(0, -101, 11, skin));
  parts.push(`<ellipse cx="-11" cy="-100" rx="1.8" ry="2.6" fill="${C.skinDark}"/><ellipse cx="11" cy="-100" rx="1.8" ry="2.6" fill="${C.skinDark}"/>`);
  parts.push(circle(-3.8, -102, 1.25, C.ink) + circle(3.8, -102, 1.25, C.ink));
  parts.push(stroke('M-2.6,-95.6 Q0,-94 2.6,-95.6', C.skinDark, 1.2));
  if (o.beard) parts.push(path('M-8,-96 Q0,-80 8,-96 Q0,-92 -8,-96Z', '#E9E2D6'));
  const hc = o.headColor ?? C.ink;
  switch (o.head ?? 'hair') {
    case 'wrap':
      parts.push(path('M-12,-104 Q-12,-122 0,-124 Q14,-124 13,-104 Q0,-108 -12,-104Z', hc));
      parts.push(`<ellipse cx="9" cy="-121" rx="7" ry="4" fill="${hc}"/>`);
      break;
    case 'bonnet':
      parts.push(path('M-11.5,-104 Q-12,-121 0,-121 Q12,-121 11.5,-104 Q0,-107 -11.5,-104Z', hc));
      break;
    case 'cone':
      parts.push(path('M-22,-105 L0,-132 L22,-105 Q0,-100 -22,-105Z', C.straw));
      parts.push(path('M-5,-126 L0,-136 L5,-126Z', C.wood));
      break;
    case 'cap':
      parts.push(path('M-11.5,-105 Q-11,-117 0,-117 Q11,-117 11.5,-105Z', hc));
      break;
    case 'hair':
      parts.push(path('M-11,-102 A11,11 0 0 1 11,-102 Q0,-106 -11,-102Z', hc));
      break;
  }
  if (o.extra) parts.push(o.extra);
  return parts.join('');
}

function seated(o: PersonOpt & { stool?: boolean }): string {
  const skin = C.skin;
  const r = o.robe;
  return [
    o.stool !== false ? `<rect x="-20" y="-26" width="40" height="7" rx="2" fill="${C.wood}"/><rect x="-16" y="-20" width="5" height="20" fill="${C.wood}"/><rect x="11" y="-20" width="5" height="20" fill="${C.wood}"/>` : '',
    path('M-14,-76 L12,-76 L18,-24 L-18,-24Z', r),
    path('M-4,-30 L30,-30 L30,-2 L18,-2 L18,-18 L-4,-18Z', r),
    `<ellipse cx="26" cy="-2" rx="7" ry="3" fill="${C.skinDark}"/>`,
    o.arms === 'talk'
      ? stroke('M10,-70 Q30,-70 36,-92', r, 8) + circle(37, -95, 4.2, skin)
      : stroke('M10,-70 Q24,-56 30,-44', r, 8) + circle(31, -42, 4.2, skin),
    o.arms === 'cane' ? stroke('M34,-60 L40,0', C.wood, 3.5) : '',
    `<rect x="-4" y="-84" width="8" height="10" fill="${skin}"/>`,
    circle(0, -93, 11, skin),
    o.beard ? path('M-8,-88 Q0,-72 8,-88 Q0,-84 -8,-88Z', '#E9E2D6') : '',
    o.head === 'wrap'
      ? path('M-12,-96 Q-12,-114 0,-116 Q14,-116 13,-96 Q0,-100 -12,-96Z', o.headColor ?? C.ink)
      : o.head === 'bonnet'
        ? path('M-11.5,-96 Q-12,-113 0,-113 Q12,-113 11.5,-96 Q0,-99 -11.5,-96Z', o.headColor ?? C.red)
        : path('M-11,-94 A11,11 0 0 1 11,-94 Q0,-98 -11,-94Z', o.beard ? '#D9D2C6' : C.ink),
  ].join('');
}

/* ---------- animaux ---------- */

function horse(color = '#EFEAE0', mane = '#C9BFAE'): string {
  return [
    path('M-40,-50 L-32,-50 L-35,-4 L-42,-4Z', color),
    path('M-28,-50 L-20,-50 L-20,-4 L-27,-4Z', color),
    path('M22,-50 L30,-50 L30,-4 L23,-4Z', color),
    path('M34,-52 L42,-52 L44,-4 L37,-4Z', color),
    `<rect x="-43" y="-6" width="9" height="6" rx="1" fill="${C.ink}"/><rect x="-28" y="-6" width="9" height="6" rx="1" fill="${C.ink}"/><rect x="22" y="-6" width="9" height="6" rx="1" fill="${C.ink}"/><rect x="36" y="-6" width="9" height="6" rx="1" fill="${C.ink}"/>`,
    path('M-46,-68 Q-62,-56 -60,-24 Q-52,-44 -42,-58Z', mane),
    path('M-46,-70 Q-48,-46 -32,-44 L30,-44 Q48,-46 46,-66 Q42,-80 22,-80 L-26,-80 Q-44,-80 -46,-70Z', color),
    path('M26,-76 L44,-112 L60,-106 L46,-62Z', color),
    path('M44,-114 Q52,-122 60,-116 L78,-94 Q80,-87 73,-85 L62,-87 L50,-100Z', color),
    path('M50,-115 L52,-127 L57,-115Z', color),
    path('M24,-80 L42,-114 L36,-114 L18,-80Z', mane),
    circle(66, -101, 1.8, C.ink),
  ].join('');
}

function crocodile(): string {
  let scutes = '';
  for (let x = -62; x <= 40; x += 11) {
    const top = -15 - Math.max(0, 9 - Math.abs(x + 10) / 8);
    scutes += path(`M${x - 4},${top + 5} L${x},${top - 2} L${x + 4},${top + 5}Z`, C.crocDark);
  }
  return [
    path('M-34,-6 l-9,7 h11 z', C.crocDark),
    path('M26,-6 l-6,7 h11 z', C.crocDark),
    path('M-88,-5 Q-44,-12 -12,-21 Q30,-28 56,-20 L88,-12 Q93,-8 86,-5 L56,-4 Q18,0 -22,-2 Q-62,-2 -88,-5Z', C.croc),
    path('M-62,-3.5 Q0,-1 52,-5 L54,-3 Q0,1 -62,-2Z', '#9AA066'),
    scutes,
    stroke('M58,-11 L86,-9', C.crocDark, 1.5),
    circle(50, -25, 4.5, C.croc),
    circle(51, -26, 1.6, C.ink),
  ].join('');
}

function hare(): string {
  const c = '#B48A5A';
  return [
    `<ellipse cx="11" cy="-55" rx="3.8" ry="14" fill="${c}" transform="rotate(-14 11 -55)"/>`,
    `<ellipse cx="18" cy="-55" rx="3.8" ry="14" fill="${c}" transform="rotate(10 18 -55)"/>`,
    `<ellipse cx="18" cy="-55" rx="1.6" ry="10" fill="#D9B48B" transform="rotate(10 18 -55)"/>`,
    `<ellipse cx="0" cy="-17" rx="20" ry="16" fill="${c}"/>`,
    circle(-9, -14, 13, c),
    circle(16, -33, 9.5, c),
    circle(-21, -16, 5, '#F1E9DC'),
    `<ellipse cx="14" cy="-2" rx="6" ry="3" fill="${c}"/>`,
    circle(20, -35, 1.6, C.ink),
    circle(25, -31, 1.4, '#7A5A3C'),
  ].join('');
}

function hyena(): string {
  const c = '#A08A5E';
  const d = '#6B5A3D';
  return [
    path('M-38,-36 L-31,-36 L-33,0 L-39,0Z', d),
    path('M-26,-38 L-19,-38 L-20,0 L-26,0Z', c),
    path('M24,-40 L31,-40 L31,0 L25,0Z', d),
    path('M34,-42 L41,-42 L42,0 L36,0Z', c),
    stroke('M-44,-42 Q-56,-36 -56,-24', d, 4),
    path('M-46,-42 Q-48,-30 -36,-30 L28,-32 Q44,-34 44,-50 Q40,-66 20,-64 L-30,-50 Q-44,-48 -46,-42Z', c),
    path('M-20,-52 L20,-64 L22,-58 L-18,-46Z', d),
    path('M30,-58 L50,-68 Q62,-66 68,-56 L70,-48 L54,-44 L36,-42Z', c),
    path('M62,-54 L70,-48 L66,-44 L58,-46Z', '#3D3326'),
    circle(46, -70, 5.5, c),
    circle(46, -70, 2.5, d),
    circle(56, -59, 1.6, C.ink),
    circle(-20, -42, 3, d),
    circle(-6, -46, 3.5, d),
    circle(8, -40, 3, d),
    circle(-30, -40, 2.5, d),
  ].join('');
}

function dog(): string {
  const c = '#C9935A';
  const d = '#9C6C3D';
  return [
    path('M-30,-28 L-24,-28 L-25,0 L-31,0Z', d),
    path('M-20,-28 L-14,-28 L-14,0 L-20,0Z', c),
    path('M16,-28 L22,-28 L22,0 L16,0Z', d),
    path('M26,-28 L32,-28 L33,0 L27,0Z', c),
    stroke('M-32,-38 Q-46,-46 -42,-62', c, 5),
    path('M-34,-36 Q-36,-24 -24,-24 L26,-24 Q36,-26 36,-36 Q34,-46 22,-46 L-24,-46 Q-34,-46 -34,-36Z', c),
    path('M26,-44 Q30,-62 44,-62 Q54,-60 58,-52 L60,-46 L46,-42 L32,-36Z', c),
    path('M36,-60 L34,-72 L44,-62Z', d),
    circle(48, -54, 1.6, C.ink),
    circle(60, -47, 2, C.ink),
  ].join('');
}

function catfish(): string {
  const c = '#59636B';
  return [
    path('M-52,0 Q-22,-16 30,-11 Q50,-7 56,0 Q50,7 30,10 Q-22,14 -52,0Z', c),
    path('M-52,0 L-68,-13 L-63,0 L-68,13Z', c),
    path('M-12,-12 Q0,-22 14,-12Z', '#47515A'),
    stroke('M54,2 Q66,8 72,20', '#47515A', 1.4),
    stroke('M54,-1 Q68,-4 76,4', '#47515A', 1.4),
    stroke('M52,4 Q58,14 58,24', '#47515A', 1.2),
    circle(44, -3, 2, '#E8E0D2'),
    path('M-40,2 Q0,8 40,4 Q0,12 -40,2Z', '#7B858C'),
  ].join('');
}

function hippo(p: Palette): string {
  const c = '#7A6670';
  return [
    path('M-56,6 Q-54,-30 -14,-36 Q18,-38 32,-30 Q50,-34 62,-20 Q68,-6 62,6Z', c),
    circle(28, -36, 4.5, c),
    circle(38, -35, 4, c),
    circle(42, -30, 4, c),
    circle(43, -31, 1.6, C.ink),
    `<ellipse cx="60" cy="-16" rx="2" ry="1.4" fill="${C.ink}"/>`,
    path(`M-66,-2 Q-30,-6 0,-3 Q36,0 72,-3 L72,10 L-66,10Z`, p.water),
    stroke('M-50,-1 Q-36,-4 -22,-1', p.water2, 2),
    stroke('M20,0 Q36,-3 52,0', p.water2, 2),
  ].join('');
}

function cow(): string {
  const c = '#EDE6D8';
  const s = '#8C5A3A';
  return [
    path('M-38,-38 L-31,-38 L-32,0 L-38,0Z', c),
    path('M-26,-38 L-19,-38 L-19,0 L-25,0Z', c),
    path('M20,-38 L27,-38 L27,0 L21,0Z', c),
    path('M30,-38 L37,-38 L38,0 L32,0Z', c),
    stroke('M-44,-56 Q-52,-40 -48,-22', c, 3),
    path('M-46,-58 Q-48,-34 -36,-32 L30,-34 Q40,-36 40,-54 Q36,-64 20,-64 L-30,-64 Q-44,-64 -46,-58Z', c),
    path('M8,-64 Q18,-82 30,-62Z', c),
    path('M-28,-60 Q-16,-62 -12,-50 Q-20,-40 -32,-44Z', s),
    path('M4,-52 Q14,-56 18,-46 Q10,-38 2,-42Z', s),
    path('M34,-60 L54,-70 Q64,-68 62,-52 L44,-46Z', c),
    path('M36,-48 Q40,-36 46,-46Z', c),
    stroke('M50,-68 Q40,-94 56,-106', '#E5DCC8', 3.5),
    stroke('M56,-68 Q68,-90 80,-96', '#E5DCC8', 3.5),
    circle(54, -61, 1.6, C.ink),
  ].join('');
}

function bird(): string {
  return stroke('M-14,0 Q-7,-9 0,0 Q7,-9 14,0', '#3A3027', 2.6);
}

function chicken(): string {
  return [
    path('M-12,-10 Q-14,-24 -2,-26 Q10,-26 12,-14 Q12,-4 0,-4 Q-10,-4 -12,-10Z', C.white),
    path('M-12,-14 L-22,-24 L-20,-10Z', '#E5DCCB'),
    circle(8, -26, 6, C.white),
    path('M6,-33 L8,-37 L10,-33 L12,-36 L13,-31Z', C.red),
    path('M13,-27 L18,-25 L13,-23Z', C.ochre),
    stroke('M-2,-4 L-3,0 M4,-4 L5,0', C.ochre, 1.6),
    circle(9, -27, 1.1, C.ink),
  ].join('');
}

/* ---------- arbres et végétation ---------- */

function baobab(it: ArtItem): string {
  const leaves = it.c === 'bare' ? '' :
    [[-82, -170, 18], [-64, -178, 14], [-22, -196, 16], [-6, -204, 12], [30, -200, 16], [48, -192, 12], [86, -176, 18], [68, -182, 13], [-44, -162, 11], [100, -168, 11]]
      .map(([x, y, r]) => circle(x, y, r, C.leaf)).join('');
  return [
    leaves,
    stroke('M-16,-136 Q-48,-160 -84,-170', C.baobab, 11),
    stroke('M-40,-155 Q-48,-170 -64,-178', C.baobab, 6),
    stroke('M-6,-140 Q-14,-176 -22,-198', C.baobab, 9),
    stroke('M8,-140 Q20,-172 30,-200', C.baobab, 9),
    stroke('M18,-134 Q52,-156 88,-176', C.baobab, 11),
    stroke('M56,-160 Q62,-176 70,-182', C.baobab, 6),
    path('M-42,0 Q-50,-64 -32,-112 L-24,-142 L24,-142 L32,-112 Q50,-64 42,0Z', C.baobab),
    path('M10,0 Q16,-60 10,-112 L22,-142 L24,-142 L32,-112 Q50,-64 42,0Z', C.baobabDark, 'opacity="0.55"'),
    stroke('M-22,-30 Q-26,-60 -18,-96', C.baobabDark, 2, 'opacity="0.6"'),
    stroke('M-6,-12 Q-4,-50 -8,-80', C.baobabDark, 2, 'opacity="0.5"'),
  ].join('');
}

function acacia(): string {
  return [
    stroke('M0,0 Q-2,-50 -4,-80 Q-22,-96 -46,-104', C.trunk, 6),
    stroke('M-3,-70 Q14,-88 38,-102', C.trunk, 4.5),
    path('M-86,-104 Q-62,-128 0,-130 Q62,-128 86,-104 Q44,-96 0,-98 Q-44,-96 -86,-104Z', C.leaf),
    path('M-40,-118 Q0,-124 44,-118 Q0,-114 -40,-118Z', C.leafDark),
  ].join('');
}

function karite(): string {
  return [
    path('M-7,0 L-5,-52 L5,-52 L7,0Z', C.trunk),
    stroke('M-2,-48 L-18,-66 M2,-50 L16,-70', C.trunk, 4),
    circle(-30, -78, 30, C.leafDark),
    circle(30, -78, 30, C.leafDark),
    circle(0, -96, 40, C.leaf),
    circle(-22, -110, 20, C.leaf),
    circle(24, -106, 22, C.leaf),
  ].join('');
}

function palm(): string {
  let fronds = '';
  for (let i = 0; i < 9; i++) {
    const a = (-170 + i * 20) * (Math.PI / 180);
    const x = Math.cos(a) * 52;
    const y = -176 + Math.sin(a) * 40;
    fronds += stroke(`M0,-176 Q${x * 0.5},${-176 + Math.sin(a) * 30 - 10} ${x.toFixed(1)},${y.toFixed(1)}`, i % 2 ? C.leafDark : C.leaf, 7);
  }
  return [path('M-6,0 Q-9,-80 -3,-176 L3,-176 Q2,-80 6,0Z', C.trunk), fronds, circle(0, -176, 6, C.leafDark)].join('');
}

function bush(): string {
  return [circle(-18, -12, 14, C.leafDark), circle(14, -14, 16, C.leafDark), circle(-2, -22, 18, C.leaf)].join('');
}

function grass(p: Palette): string {
  return stroke('M-10,0 L-14,-16 M-4,0 L-5,-20 M2,0 L4,-22 M8,0 L14,-15 M-1,0 L-9,-12', p.grass, 2.4);
}

/* ---------- architecture ---------- */

function hut(it: ArtItem): string {
  const roof = it.c === 'dark' ? C.strawDark : C.straw;
  return [
    path('M-40,0 L-40,-52 Q0,-58 40,-52 L40,0Z', C.banco),
    path('M12,0 L12,-56 Q30,-55 40,-52 L40,0Z', C.bancoDark),
    path('M-12,0 L-12,-28 Q0,-40 12,-28 L12,0Z', '#3A2A20'),
    path('M-56,-46 L0,-120 L56,-46 Q0,-40 -56,-46Z', roof),
    path('M0,-120 L56,-46 Q30,-43 6,-42Z', C.strawDark, 'opacity="0.55"'),
    stroke('M-20,-80 L-34,-50 M-6,-96 L-14,-46 M20,-82 L30,-48', C.strawDark, 1.6, 'opacity="0.7"'),
    stroke('M0,-120 L0,-128', C.wood, 3),
  ].join('');
}

function granary(): string {
  return [
    circle(-14, -4, 5, C.stone),
    circle(0, -3, 5, C.stone),
    circle(14, -4, 5, C.stone),
    path('M-24,-10 Q-30,-46 0,-52 Q30,-46 24,-10Z', C.banco),
    path('M8,-10 Q14,-30 8,-50 Q30,-46 24,-10Z', C.bancoDark),
    path('M-32,-44 L0,-84 L32,-44 Q0,-40 -32,-44Z', C.straw),
    path('M0,-84 L32,-44 Q16,-42 4,-41Z', C.strawDark, 'opacity="0.55"'),
  ].join('');
}

function palace(): string {
  let pins = '';
  for (let x = -136; x <= 136; x += 17) pins += path(`M${x - 5},-84 L${x},-98 L${x + 5},-84Z`, C.bancoDark);
  return [
    pins,
    path('M-140,0 L-140,-84 L140,-84 L140,0Z', C.banco),
    path('M-150,0 L-150,-118 L-112,-118 L-112,0Z', C.banco),
    path('M112,0 L112,-118 L150,-118 L150,0Z', C.banco),
    path('M-150,-118 L-131,-134 L-112,-118Z', C.bancoDark),
    path('M112,-118 L131,-134 L150,-118Z', C.bancoDark),
    path('M-36,0 L-36,-118 L36,-118 L36,0Z', C.banco),
    path('M-36,-118 L-24,-132 L-12,-118 L0,-134 L12,-118 L24,-132 L36,-118Z', C.bancoDark),
    path('M-18,0 L-18,-56 Q0,-76 18,-56 L18,0Z', '#3A2A20'),
    path('M112,0 L112,-118 L150,-118 L150,0Z', C.bancoDark, 'opacity="0.5"'),
    path('M36,0 L36,-84 L112,-84 L112,0Z', C.bancoDark, 'opacity="0.25"'),
    `<rect x="-90" y="-60" width="12" height="18" rx="6" fill="#3A2A20"/><rect x="-66" y="-60" width="12" height="18" rx="6" fill="#3A2A20"/><rect x="60" y="-60" width="12" height="18" rx="6" fill="#3A2A20"/><rect x="84" y="-60" width="12" height="18" rx="6" fill="#3A2A20"/>`,
    `<rect x="-136" y="-90" width="10" height="16" rx="5" fill="#3A2A20"/><rect x="126" y="-90" width="10" height="16" rx="5" fill="#3A2A20"/>`,
    stroke('M0,-134 L0,-160', C.wood, 2.5),
    path('M1,-160 L22,-154 L1,-148Z', C.red),
  ].join('');
}

function mosque(): string {
  const wall = '#E2D2B2';
  const shade = '#C9B48E';
  let pickets = '';
  for (const [x0, y0, y1] of [[-120, -70, -10], [-80, -70, -10], [80, -70, -10], [120, -70, -10]]) {
    for (let y = y0; y <= y1; y += 18) pickets += stroke(`M${x0 - 6},${y} L${x0 + 6},${y}`, C.wood, 2.4);
  }
  for (let y = -170; y <= -40; y += 18) pickets += stroke(`M-26,${y} L26,${y}`, C.wood, 2.4);
  return [
    path('M-150,0 L-150,-76 L150,-76 L150,0Z', wall),
    path('M60,0 L60,-76 L150,-76 L150,0Z', shade, 'opacity="0.6"'),
    path('M-132,-76 L-120,-110 L-108,-76Z', wall),
    path('M-92,-76 L-80,-110 L-68,-76Z', wall),
    path('M68,-76 L80,-110 L92,-76Z', wall),
    path('M108,-76 L120,-110 L132,-76Z', shade),
    path('M-24,0 L-18,-186 L0,-206 L18,-186 L24,0Z', wall),
    path('M2,0 L4,-200 L18,-186 L24,0Z', shade, 'opacity="0.7"'),
    pickets,
    path('M-12,0 L-12,-34 Q0,-48 12,-34 L12,0Z', '#3A2A20'),
    `<rect x="-112" y="-48" width="10" height="16" rx="5" fill="#3A2A20"/><rect x="-60" y="-48" width="10" height="16" rx="5" fill="#3A2A20"/><rect x="50" y="-48" width="10" height="16" rx="5" fill="#3A2A20"/><rect x="100" y="-48" width="10" height="16" rx="5" fill="#3A2A20"/>`,
  ].join('');
}

function paintedHouse(): string {
  const base = '#B5653F';
  let tri = '';
  for (let x = -70; x < 70; x += 14) {
    tri += path(`M${x},-46 L${x + 7},-60 L${x + 14},-46Z`, C.ink);
    tri += path(`M${x + 7},-60 L${x + 14},-46 L${x + 21},-60Z`, C.white);
  }
  let loz = '';
  for (let x = -60; x <= 60; x += 24) loz += path(`M${x},-30 L${x + 8},-20 L${x},-10 L${x - 8},-20Z`, C.white) + circle(x, -20, 2.5, C.ink);
  return [
    `<clipPath id="ph"><path d="M-70,0 L-70,-60 L70,-60 L70,0Z"/></clipPath>`,
    path('M-76,0 L-76,-72 Q-76,-80 -68,-80 L68,-80 Q76,-80 76,-72 L76,0Z', base),
    `<g clip-path="url(#ph)">${tri}</g>`,
    path('M-76,-62 L76,-62 L76,-58 L-76,-58Z', C.ink),
    path('M-76,-46 L76,-46 L76,-42 L-76,-42Z', C.ink),
    loz,
    path('M30,0 L30,-26 Q40,-34 50,-26 L50,0Z', '#2A1C14'),
    path('M-80,-80 L80,-80 L80,-86 L-80,-86Z', '#8E4B2E'),
  ].join('');
}

function ruins(): string {
  const parts: string[] = [];
  parts.push(path('M-130,0 L-130,-70 L-112,-82 L-96,-66 L-70,-90 L-50,-74 L-50,0Z', C.laterite));
  parts.push(path('M-30,0 L-30,-54 L-12,-62 L4,-48 L4,0Z', C.laterite));
  parts.push(path('M24,0 L24,-96 L46,-104 L62,-86 L90,-98 L118,-80 L130,-88 L130,0Z', C.laterite));
  let stones = '';
  for (const [x0, x1, top] of [[-130, -50, -66], [-30, 4, -46], [24, 130, -78]]) {
    for (let y = -10; y > top; y -= 14) {
      for (let x = x0 + ((y / 14) % 2 ? 0 : 8); x < x1 - 8; x += 18) {
        stones += `<rect x="${x + 2}" y="${y - 10}" width="14" height="10" rx="2" fill="${C.lateriteDark}" opacity="0.55"/>`;
      }
    }
  }
  parts.push(stones);
  parts.push(path('M-30,0 L-30,-6 L4,-6 L4,0Z', C.lateriteDark));
  parts.push(circle(-150, -6, 9, C.stone) + circle(-138, -4, 6, C.stoneDark) + circle(150, -6, 8, C.stone));
  return parts.join('');
}

function peaks(): string {
  const col = (x: number, w: number, h: number, c: string) =>
    path(`M${x - w / 2},0 L${x - w / 2 + 4},${-h + w / 2} Q${x},${-h - w / 4} ${x + w / 2 - 4},${-h + w / 2} L${x + w / 2},0Z`, c);
  const strata = (x: number, w: number, h: number) => {
    let s = '';
    for (let y = -24; y > -h + 30; y -= 26) s += stroke(`M${x - w / 2 + 6},${y} Q${x},${y + 4} ${x + w / 2 - 6},${y}`, C.stoneDark, 1.6, 'opacity="0.5"');
    return s;
  };
  const cols: [number, number, number, string][] = [
    [-110, 44, 150, '#B98656'],
    [-70, 52, 218, '#C79563'],
    [-24, 40, 176, '#B98656'],
    [16, 56, 240, '#C79563'],
    [62, 42, 164, '#B98656'],
    [104, 50, 200, '#C79563'],
    [140, 36, 120, '#B98656'],
  ];
  return cols.map(([x, w, h, c]) => col(x, w, h, c) + strata(x, w, h) + path(`M${x + 4},0 L${x + 4},${-h + w / 2} Q${x + w / 4},${-h} ${x + w / 2 - 4},${-h + w / 2} L${x + w / 2},0Z`, '#9E6E45', 'opacity="0.45"')).join('');
}

function rock(): string {
  return [
    path('M-44,0 Q-48,-30 -12,-42 Q30,-46 44,-16 L46,0Z', C.stone),
    path('M8,-44 Q34,-38 44,-16 L46,0 L16,0 Q24,-22 8,-44Z', C.stoneDark),
  ].join('');
}

function well(): string {
  return [
    stroke('M-30,-34 L-30,-84 M30,-34 L30,-84', C.wood, 5),
    stroke('M-36,-84 L36,-84', C.wood, 5),
    stroke('M4,-84 L4,-52', '#D9C9A8', 1.6),
    path('M-4,-52 L12,-52 L10,-40 L-2,-40Z', C.wood),
    path('M-34,0 L-34,-30 L34,-30 L34,0Z', C.stone),
    `<ellipse cx="0" cy="-30" rx="34" ry="7" fill="${C.stoneDark}"/>`,
    `<ellipse cx="0" cy="-30" rx="26" ry="4.5" fill="#1E2A33"/>`,
    stroke('M-34,-16 L34,-16', C.stoneDark, 1.6, 'opacity="0.6"'),
  ].join('');
}

function field(it: ArtItem): string {
  const dry = it.c === 'dry';
  let s = '';
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 7; i++) {
      const x = -120 + i * 40 + r * 14;
      const y = -r * 14;
      const c = dry ? (i % 2 ? '#9E7B4A' : '#8A6A3E') : i % 2 ? C.leaf : C.leafDark;
      s += dry
        ? stroke(`M${x},${y} L${x + 2},${y - 22} M${x + 2},${y - 14} Q${x + 10},${y - 12} ${x + 12},${y - 6} M${x},${y - 10} Q${x - 8},${y - 8} ${x - 10},${y - 2}`, c, 2.2)
        : stroke(`M${x},${y} L${x},${y - 28}`, C.leafDark, 2.4) + `<ellipse cx="${x - 7}" cy="${y - 18}" rx="8" ry="4" fill="${c}" transform="rotate(-25 ${x - 7} ${y - 18})"/><ellipse cx="${x + 7}" cy="${y - 24}" rx="8" ry="4" fill="${c}" transform="rotate(25 ${x + 7} ${y - 24})"/>`;
    }
  }
  return s;
}

/* ---------- objets ---------- */

function fire(): string {
  return [
    circle(0, -20, 46, '#F08A24', 'opacity="0.10"'),
    circle(0, -18, 28, C.yellow, 'opacity="0.12"'),
    `<rect x="-26" y="-7" width="52" height="8" rx="4" fill="${C.wood}" transform="rotate(-12)"/>`,
    `<rect x="-26" y="-7" width="52" height="8" rx="4" fill="#5E3B22" transform="rotate(12)"/>`,
    `<g class="a-flicker">`,
    path('M-17,-4 Q-22,-28 -7,-42 Q-7,-30 0,-26 Q2,-48 11,-56 Q13,-36 21,-26 Q23,-8 15,-4Z', C.red),
    path('M-10,-4 Q-13,-20 -3,-30 Q-1,-22 3,-20 Q5,-34 10,-40 Q13,-24 15,-14 Q15,-5 9,-4Z', '#F08A24'),
    path('M-4,-4 Q-6,-14 0,-20 Q3,-14 5,-12 Q8,-18 9,-20 Q11,-10 7,-4Z', C.yellow),
    `</g>`,
  ].join('');
}

function mortar(): string {
  return [
    path('M-15,-34 L15,-34 L11,-14 L15,0 L-15,0 L-11,-14Z', C.wood),
    `<ellipse cx="0" cy="-34" rx="15" ry="4" fill="#5E3B22"/>`,
    `<g class="a-pound">${stroke('M0,-118 L0,-34', '#9C7448', 5)}</g>`,
  ].join('');
}

function drum(): string {
  return [
    path('M-16,-50 L16,-50 L8,-26 L13,0 L-13,0 L-8,-26Z', C.wood),
    `<ellipse cx="0" cy="-50" rx="16" ry="4.5" fill="#E9DCC0"/>`,
    stroke('M-14,-46 L-6,-26 M-6,-48 L0,-26 M6,-48 L0,-26 M14,-46 L6,-26', '#E9DCC0', 1.2),
    path('M-9,-28 L9,-28 L9,-24 L-9,-24Z', C.red),
  ].join('');
}

function calabash(): string {
  return [
    path('M-22,-18 Q-20,0 0,0 Q20,0 22,-18Z', '#D9A441'),
    `<ellipse cx="0" cy="-18" rx="22" ry="5" fill="#B8862E"/>`,
    stroke('M-16,-10 Q0,-6 16,-10', '#A97624', 1.5),
  ].join('');
}

function jar(): string {
  return [
    path('M-15,0 Q-27,-20 -13,-36 L-9,-42 L9,-42 L13,-36 Q27,-20 15,0Z', C.laterite),
    `<ellipse cx="0" cy="-42" rx="10" ry="3" fill="${C.lateriteDark}"/>`,
    stroke('M-18,-20 Q0,-15 18,-20', C.lateriteDark, 1.8),
  ].join('');
}

function spear(): string {
  return stroke('M0,0 L0,-150', C.wood, 3) + path('M-5,-148 L0,-172 L5,-148Z', '#8D8F92');
}

function gold(): string {
  return [
    path('M-26,0 Q-24,-14 -8,-16 Q8,-18 24,-6 L26,0Z', C.ochre),
    circle(-12, -10, 6, C.yellow),
    circle(2, -13, 7, '#F2BE0E'),
    circle(14, -7, 5, C.yellow),
    circle(-2, -4, 5, '#F2BE0E'),
  ].join('');
}

function leafMask(): string {
  const layers: string[] = [];
  const colors = ['#5F7E34', '#4E6B2A', '#6F8F3C', '#55742E', '#7B9844'];
  for (let i = 0; i < 6; i++) {
    const y = -i * 24;
    const w = 46 - i * 6;
    let d = `M${-w},${y}`;
    const teeth = 7;
    for (let k = 0; k <= teeth; k++) {
      const x = -w + (2 * w * k) / teeth;
      d += ` L${x.toFixed(1)},${y} L${(x + w / teeth).toFixed(1)},${y - 34}`;
    }
    d += ` L${w},${y}Z`;
    layers.push(path(d, colors[i % colors.length]));
  }
  return [
    layers.join(''),
    stroke('M-6,-150 L-10,-176 M0,-152 L0,-182 M6,-150 L10,-176', '#4E6B2A', 3),
    circle(0, -184, 4, C.red),
  ].join('');
}

function plankMask(): string {
  let checks = '';
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 2; c++) {
      checks += `<rect x="${-12 + c * 12}" y="${-210 + r * 12}" width="12" height="12" fill="${(r + c) % 2 ? C.ink : C.white}"/>`;
    }
  }
  return [
    path('M-34,0 L-26,-80 L26,-80 L34,0Z', C.strawDark),
    stroke('M-24,0 L-18,-76 M-10,0 L-8,-78 M4,0 L4,-78 M18,0 L16,-76', C.straw, 2.4),
    path('M-24,-78 L24,-78 L18,-96 L-18,-96Z', C.strawDark),
    `<rect x="-14" y="-216" width="28" height="122" rx="3" fill="${C.red}"/>`,
    checks,
    path('M-14,-136 L14,-136 L0,-150Z', C.white),
    circle(0, -118, 16, C.white),
    circle(-7, -120, 5, C.red),
    circle(7, -120, 5, C.red),
    circle(-7, -120, 2, C.ink),
    circle(7, -120, 2, C.ink),
    path('M-3,-110 L3,-110 L0,-96Z', C.ink),
    path('M-14,-220 L0,-232 L14,-220Z', C.white),
  ].join('');
}

function bigStar(): string {
  return circle(0, -40, 46, C.yellow, 'opacity="0.14"') + path(starPath(0, -40, 32, 13), C.yellow);
}

function rays(): string {
  return [
    path('M-30,-420 L30,-420 L120,0 L-120,0Z', C.yellow, 'opacity="0.13"'),
    path('M-14,-420 L14,-420 L60,0 L-60,0Z', C.yellow, 'opacity="0.16"'),
  ].join('');
}

function sun(): string {
  return circle(0, 0, 56, C.yellow, 'opacity="0.18"') + circle(0, 0, 36, C.yellow);
}

function moon(): string {
  return path('M4,-26 A26,26 0 1,0 4,26 A17,22 0 1,1 4,-26Z', C.moon);
}

function cloud(): string {
  return path('M-52,0 Q-52,-18 -32,-18 Q-28,-36 -6,-34 Q6,-50 28,-36 Q50,-38 50,-18 Q62,-16 60,0Z', '#FBF6EC', 'opacity="0.92"');
}

function birds(): string {
  return g(bird(), 'transform="translate(0,0)"') + g(bird(), 'transform="translate(30,-14) scale(0.8)"') + g(bird(), 'transform="translate(-26,-22) scale(0.7)"');
}

/* ---------- éléments ajoutés (nouveaux contes) ---------- */

function milletBall(): string {
  return [
    `<ellipse cx="0" cy="-2" rx="16" ry="4" fill="${C.ink}" opacity="0.15"/>`,
    circle(0, -15, 14, '#E8D3A2'),
    circle(-5, -19, 3, '#D9BE85'),
    circle(5, -12, 2.5, '#D9BE85'),
    circle(3, -21, 2, '#F4E6C4'),
    circle(-4, -16, 1.5, C.ink),
    circle(4, -16, 1.5, C.ink),
    stroke('M-3,-10 Q0,-8 3,-10', C.ink, 1.2),
  ].join('');
}

function termiteMound(): string {
  return [
    path('M-34,0 Q-30,-40 -16,-70 Q-10,-96 -2,-104 Q6,-92 10,-74 Q20,-60 24,-44 Q34,-22 36,0Z', C.laterite),
    path('M8,0 Q12,-40 10,-74 Q20,-60 24,-44 Q34,-22 36,0Z', C.lateriteDark, 'opacity="0.6"'),
    path('M-24,-30 Q-30,-46 -22,-52 Q-18,-40 -24,-30Z', C.lateriteDark),
    stroke('M-14,-20 Q-10,-40 -8,-60', C.lateriteDark, 1.6, 'opacity="0.5"'),
  ].join('');
}

function whip(): string {
  return [
    `<rect x="-3" y="-34" width="6" height="34" rx="2" fill="${C.wood}"/>`,
    stroke('M0,-34 Q-14,-56 6,-74 Q22,-88 10,-104', '#5E3B22', 3),
  ].join('');
}

function dwarf(): string {
  // petit génie de brousse : grosse tête, pieds tournés, coiffe pointue
  const c = '#3F4A2E';
  return [
    `<ellipse cx="-6" cy="-2" rx="6" ry="3" fill="${C.ink}"/><ellipse cx="6" cy="-2" rx="6" ry="3" fill="${C.ink}"/>`,
    path('M-9,-30 L9,-30 L13,-4 L-13,-4Z', c),
    stroke('M-9,-28 Q-16,-20 -14,-10 M9,-28 Q16,-20 14,-10', c, 5),
    circle(0, -42, 13, '#5A3A22'),
    path('M-12,-48 L0,-74 L12,-48 Q0,-52 -12,-48Z', C.red),
    circle(-5, -42, 3.2, '#F4EFE6') + circle(5, -42, 3.2, '#F4EFE6'),
    circle(-5, -42, 1.5, C.ink) + circle(5, -42, 1.5, C.ink),
    stroke('M-4,-34 Q0,-31 4,-34', C.ink, 1.4),
  ].join('');
}

function beehive(): string {
  return [
    stroke('M0,-60 L0,-48', C.wood, 3),
    path('M-18,-48 Q-24,-24 -12,-6 Q0,2 12,-6 Q24,-24 18,-48 Q0,-56 -18,-48Z', '#C89B3C'),
    stroke('M-20,-38 Q0,-32 20,-38 M-22,-24 Q0,-18 22,-24 M-16,-12 Q0,-6 16,-12', '#A57A22', 2),
    `<ellipse cx="0" cy="-10" rx="5" ry="3.5" fill="${C.ink}"/>`,
  ].join('');
}

function bees(): string {
  let s = '';
  const pos = [[-30, -10], [-12, -30], [8, -6], [26, -28], [40, -2], [-40, -34], [16, -44]];
  pos.forEach(([x, y], i) => {
    s += `<g transform="translate(${x},${y})"><ellipse cx="0" cy="0" rx="4" ry="2.6" fill="${C.yellow}"/>` +
      stroke('M-1,-2.4 L-1,2.4 M1.6,-2.2 L1.6,2.2', C.ink, 1) +
      `<ellipse cx="-1" cy="-3.4" rx="2.6" ry="1.6" fill="#FFFFFF" opacity="0.8"/></g>`;
    if (i % 2) s += stroke(`M${x - 4},${y + 2} q-6,4 -12,0`, C.ink, 0.8, 'opacity="0.35"');
  });
  return s;
}

function birdSmall(): string {
  // tourterelle posée
  return [
    path('M-14,-10 Q-12,-22 2,-22 Q12,-22 14,-14 Q10,-4 -2,-4 Q-10,-4 -14,-10Z', '#B9A58F'),
    path('M-14,-12 L-26,-16 L-22,-8Z', '#8E7B66'),
    circle(10, -22, 6, '#C9B7A2'),
    path('M15,-23 L21,-21 L15,-19Z', C.ochre),
    circle(11, -23, 1.2, C.ink),
    path('M6,-18 Q8,-14 12,-16', 'none', `stroke="${C.ink}" stroke-width="1" opacity="0.6"`),
    stroke('M-2,-4 L-3,0 M3,-4 L4,0', C.ochre, 1.4),
  ].join('');
}

function yboumbouni(): string {
  // bête fabuleuse : grand cheval-antilope blanc à longue queue ornée de cauris et de perles d'or
  const c = '#F2EADB';
  const d = '#CFC2AA';
  let tail = '';
  for (let i = 0; i < 6; i++) tail += circle(-74 - i * 6, -56 + i * 9, 3, i % 2 ? C.yellow : '#FFFFFF');
  return [
    path('M-46,-60 Q-74,-60 -86,-6 Q-70,-40 -54,-50Z', d),
    tail,
    path('M-40,-58 L-32,-58 L-36,0 L-43,0Z', c),
    path('M-26,-58 L-18,-58 L-19,0 L-26,0Z', c),
    path('M28,-58 L36,-58 L36,0 L29,0Z', c),
    path('M40,-60 L48,-60 L50,0 L43,0Z', c),
    path('M-50,-80 Q-52,-52 -34,-52 L36,-52 Q54,-54 52,-76 Q48,-92 26,-92 L-30,-92 Q-48,-92 -50,-80Z', c),
    path('M30,-88 L50,-132 L66,-126 L50,-74Z', c),
    path('M50,-134 Q60,-142 68,-134 L84,-110 Q86,-102 78,-100 L66,-102 L54,-116Z', c),
    path('M52,-136 L48,-158 L58,-138Z M60,-136 L64,-158 L66,-136Z', C.ochre),
    path('M28,-90 L48,-134 L42,-134 L22,-90Z', C.yellow),
    circle(70, -118, 2, C.ink),
    `<rect x="-36" y="-80" width="60" height="6" fill="${C.red}" opacity="0.85"/>`,
    `<rect x="-36" y="-74" width="60" height="3" fill="${C.yellow}"/>`,
  ].join('');
}

function wildCow(): string {
  const c = '#6E4A32';
  const d = '#4E3322';
  return [
    path('M-38,-38 L-31,-38 L-32,0 L-38,0Z', d),
    path('M-26,-38 L-19,-38 L-19,0 L-25,0Z', c),
    path('M20,-38 L27,-38 L27,0 L21,0Z', d),
    path('M30,-38 L37,-38 L38,0 L32,0Z', c),
    stroke('M-44,-56 Q-52,-40 -48,-22', c, 3),
    path('M-46,-58 Q-48,-34 -36,-32 L30,-34 Q40,-36 40,-54 Q36,-68 20,-68 L-30,-64 Q-44,-64 -46,-58Z', c),
    path('M4,-66 Q16,-84 30,-62Z', d),
    path('M34,-60 L56,-70 Q66,-68 64,-52 L44,-46Z', c),
    stroke('M48,-68 Q30,-84 34,-96', '#E5DCC8', 4),
    stroke('M56,-68 Q72,-80 70,-94', '#E5DCC8', 4),
    circle(56, -61, 1.8, C.ink),
    `<ellipse cx="30" cy="-10" rx="10" ry="6" fill="${c}"/>`,
  ].join('');
}

function lion(): string {
  const c = '#C9934A';
  const m = '#8A5A28';
  return [
    path('M-40,-36 L-32,-36 L-33,0 L-40,0Z', c),
    path('M-28,-36 L-20,-36 L-21,0 L-28,0Z', c),
    path('M22,-36 L30,-36 L30,0 L23,0Z', c),
    path('M32,-36 L40,-36 L41,0 L34,0Z', c),
    stroke('M-44,-46 Q-62,-40 -60,-62', c, 4),
    circle(-61, -64, 5, m),
    path('M-46,-50 Q-48,-30 -34,-30 L30,-32 Q42,-34 42,-50 Q40,-62 24,-62 L-32,-60 Q-46,-60 -46,-50Z', c),
    circle(44, -62, 22, m),
    circle(50, -60, 14, c),
    circle(55, -63, 1.8, C.ink),
    path('M62,-56 L66,-54 L62,-52Z', C.ink),
    circle(42, -72, 4, c),
  ].join('');
}

function elephant(): string {
  const c = '#8E8A86';
  const d = '#6E6A66';
  return [
    `<rect x="-46" y="-50" width="16" height="50" rx="4" fill="${d}"/>`,
    `<rect x="-24" y="-50" width="16" height="50" rx="4" fill="${c}"/>`,
    `<rect x="18" y="-50" width="16" height="50" rx="4" fill="${d}"/>`,
    `<rect x="38" y="-50" width="16" height="50" rx="4" fill="${c}"/>`,
    path('M-54,-60 Q-58,-110 -10,-116 Q40,-118 58,-90 Q64,-66 56,-48 L-50,-46Z', c),
    stroke('M-54,-76 Q-64,-70 -62,-56', d, 3),
    circle(66, -96, 26, c),
    path('M48,-110 Q30,-112 30,-88 Q32,-68 52,-74Z', d),
    path('M84,-90 Q96,-60 88,-28 Q86,-18 94,-14 Q80,-12 80,-28 Q84,-56 74,-80Z', c),
    path('M78,-80 Q90,-74 96,-78 Q88,-70 78,-72Z', '#F4EFE6'),
    circle(74, -100, 2.2, C.ink),
  ].join('');
}

function clothBundle(): string {
  return [
    path('M-24,0 L-26,-26 Q-24,-34 -14,-34 L14,-34 Q24,-34 26,-26 L24,0Z', C.indigo),
    path('M-26,-22 L26,-22 L26,-17 L-26,-17Z', '#FFFFFF', 'opacity="0.75"'),
    path('M-25,-11 L25,-11 L25,-7 L-25,-7Z', C.yellow, 'opacity="0.85"'),
    path('M-6,-34 Q0,-46 6,-34', 'none', `stroke="${C.wood}" stroke-width="3"`),
  ].join('');
}

function giantCalabash(): string {
  return [
    `<ellipse cx="0" cy="-2" rx="58" ry="8" fill="${C.ink}" opacity="0.15"/>`,
    circle(0, -56, 56, '#D9A441'),
    path('M0,-112 Q-30,-56 0,0 Q-58,-10 -56,-56 Q-52,-104 0,-112Z', '#C08A2E', 'opacity="0.55"'),
    stroke('M-48,-80 Q0,-62 48,-80', '#A97624', 2.5),
    stroke('M-54,-46 Q0,-28 54,-46', '#A97624', 2.5),
    path('M-4,-112 Q0,-126 10,-130', 'none', `stroke="${C.leafDark}" stroke-width="4" stroke-linecap="round"`),
    circle(-18, -66, 6, '#FFFFFF') + circle(18, -66, 6, '#FFFFFF'),
    circle(-17, -65, 3, C.ink) + circle(19, -65, 3, C.ink),
    path('M-22,-40 Q0,-26 22,-40 Q0,-34 -22,-40Z', '#5E3B22'),
  ].join('');
}

function ram(): string {
  const c = '#EDE6D8';
  const h = '#8C6A4A';
  return [
    path('M-30,-30 L-24,-30 L-25,0 L-30,0Z', c),
    path('M-20,-30 L-14,-30 L-14,0 L-19,0Z', c),
    path('M16,-30 L22,-30 L22,0 L16,0Z', c),
    path('M26,-30 L32,-30 L33,0 L27,0Z', c),
    circle(-20, -40, 14, c) + circle(-4, -44, 15, c) + circle(14, -42, 14, c) + circle(24, -36, 10, c),
    path('M26,-46 Q34,-62 46,-58 Q54,-52 50,-40 L36,-36Z', '#D9CFBF'),
    path('M30,-58 Q22,-72 36,-74 Q48,-72 44,-60 Q40,-66 36,-64 Q32,-62 34,-56Z', h),
    circle(44, -52, 1.6, C.ink),
  ].join('');
}

function goat(): string {
  const c = '#A88563';
  const d = '#7A5C40';
  return [
    path('M-26,-28 L-21,-28 L-22,0 L-27,0Z', d),
    path('M-17,-28 L-12,-28 L-12,0 L-17,0Z', c),
    path('M14,-28 L19,-28 L19,0 L14,0Z', d),
    path('M22,-28 L27,-28 L28,0 L23,0Z', c),
    stroke('M-28,-38 L-34,-46', c, 4),
    path('M-30,-34 Q-32,-22 -20,-22 L22,-24 Q30,-26 30,-36 Q28,-44 18,-44 L-20,-44 Q-30,-44 -30,-34Z', c),
    path('M22,-42 L34,-58 Q42,-60 46,-52 L44,-44 L32,-36Z', c),
    stroke('M36,-58 Q32,-70 24,-72 M40,-58 Q40,-70 34,-74', d, 2.5),
    path('M42,-46 L46,-36 L40,-40Z', d),
    circle(40, -53, 1.5, C.ink),
  ].join('');
}

function forestEdge(): string {
  return [circle(-30, -40, 30, C.leafDark), circle(4, -54, 36, C.leaf), circle(34, -36, 26, C.leafDark), path('M-4,0 L-2,-30 L4,-30 L6,0Z', C.trunk)].join('');
}

function oldWoman(it: ArtItem): string {
  return person({ robe: it.c ?? '#6B4C7A', belt: C.ochre, head: 'wrap', headColor: '#E9E2D6', arms: 'cane' });
}

function tortoise(): string {
  const shell = '#7A6A3E';
  const skin = '#9C8A5A';
  return [
    path('M-30,-4 Q-36,-6 -34,-12 Q-30,-14 -26,-8Z', skin),
    stroke('M-18,-6 L-20,0 M14,-6 L16,0', skin, 6),
    path('M30,-10 Q40,-12 42,-20 Q44,-28 36,-28 Q28,-26 26,-16Z', skin),
    circle(38, -22, 1.5, C.ink),
    path('M-28,-6 Q-28,-34 0,-36 Q28,-34 28,-6Z', shell),
    path('M-12,-30 L0,-34 L12,-30 L14,-18 L0,-12 L-14,-18Z', '#8E7D4B'),
    stroke('M-12,-30 L-22,-10 M12,-30 L22,-10 M-14,-18 L0,-12 L14,-18 M0,-12 L0,-6', '#5E5230', 1.4),
    path('M-30,-6 L30,-6 L28,-3 L-28,-3Z', '#5E5230'),
  ].join('');
}

function guineaFowl(): string {
  const body = '#3E4250';
  const dots = [[-10, -20], [-2, -24], [6, -20], [-6, -14], [2, -12], [10, -14], [-14, -12], [-2, -18]]
    .map(([x, y]) => circle(x, y, 1.6, '#E8E6EE'))
    .join('');
  return [
    path('M-20,-14 Q-20,-32 0,-32 Q18,-30 18,-14 Q14,-4 0,-4 Q-16,-4 -20,-14Z', body),
    dots,
    stroke('M14,-24 Q18,-36 22,-38', '#3E4250', 5),
    circle(23, -40, 5, '#5BA3C9'),
    path('M21,-45 L24,-50 L26,-44Z', C.ochre),
    path('M26,-40 L32,-38 L26,-36Z', C.ochre),
    path('M21,-36 Q20,-31 23,-32Z', C.red),
    circle(24, -41, 1.1, C.ink),
    stroke('M-4,-4 L-6,0 M6,-4 L7,0', C.ochre, 1.6),
  ].join('');
}

function owl(): string {
  const c = '#8A6E4E';
  return [
    path('M-16,0 Q-20,-30 -12,-44 L-14,-54 L-4,-46 Q0,-48 4,-46 L14,-54 L12,-44 Q20,-30 16,0Z', c),
    path('M-10,-2 Q-12,-22 0,-26 Q12,-22 10,-2Z', '#C9AE84'),
    stroke('M-5,-16 L-3,-14 M3,-16 L5,-14 M-5,-9 L-3,-7 M3,-9 L5,-7', '#8A6E4E', 1.2),
    circle(-7, -38, 8, '#F4E6A8') + circle(7, -38, 8, '#F4E6A8'),
    circle(-7, -38, 4.5, C.ink) + circle(7, -38, 4.5, C.ink),
    circle(-6, -39.5, 1.3, '#FFFFFF') + circle(8, -39.5, 1.3, '#FFFFFF'),
    path('M-2,-32 L2,-32 L0,-27Z', C.ochre),
    stroke('M-6,0 L-6,3 M6,0 L6,3', C.ochre, 1.6),
  ].join('');
}

function mouse(): string {
  const c = '#9A8F86';
  return [
    stroke('M-14,-6 Q-26,-4 -30,-14', c, 1.6),
    path('M-16,-4 Q-16,-16 -2,-16 Q10,-16 14,-6 L14,-4Z', c),
    circle(2, -16, 4, c),
    circle(2, -16, 2.2, '#D9A9A0'),
    circle(10, -9, 1.2, C.ink),
    circle(15, -5, 1.2, '#D9A9A0'),
  ].join('');
}

function sack(): string {
  return [
    path('M-16,0 Q-20,-20 -8,-30 L-10,-36 L10,-36 L8,-30 Q20,-20 16,0Z', '#C8A46A'),
    stroke('M-9,-30 L9,-30', C.wood, 2.4),
    circle(-4, -14, 3, '#F4E6A8') + circle(-4, -14, 1.4, C.ink),
    circle(6, -10, 3.6, '#F4E6A8') + circle(6, -10, 1.7, C.ink),
  ].join('');
}

function partridge(): string {
  return [
    path('M-14,-8 Q-16,-22 0,-24 Q14,-24 16,-14 Q14,-4 0,-4 Q-12,-4 -14,-8Z', '#8D7357'),
    circle(-6, -14, 1.6, '#F4EFE6') + circle(2, -18, 1.6, '#F4EFE6') + circle(6, -10, 1.6, '#F4EFE6') + circle(-2, -8, 1.4, '#F4EFE6'),
    circle(14, -24, 6, '#7A6249'),
    path('M19,-25 L24,-23 L19,-21Z', C.ochre),
    circle(15, -25, 1.2, C.ink),
    stroke('M-2,-4 L-3,0 M4,-4 L5,0', C.red, 1.4),
  ].join('');
}

function monkey(): string {
  const c = '#8A6A4C';
  const f = '#D9B48B';
  return [
    stroke('M-14,-24 Q-34,-26 -36,-52 Q-36,-64 -28,-66', c, 4),
    path('M-14,-40 Q-18,-14 -6,-8 Q8,-6 12,-20 Q14,-38 0,-44Z', c),
    stroke('M-8,-12 L-12,0 M6,-12 L10,0', c, 5),
    stroke('M-8,-36 Q-22,-30 -20,-18 M8,-36 Q20,-28 16,-18', c, 4),
    circle(0, -54, 12, c),
    circle(-11, -56, 4, f) + circle(11, -56, 4, f),
    path('M-7,-56 Q0,-62 7,-56 Q8,-46 0,-44 Q-8,-46 -7,-56Z', f),
    circle(-3, -55, 1.4, C.ink) + circle(3, -55, 1.4, C.ink),
    stroke('M-2,-48 Q0,-47 2,-48', C.ink, 1),
  ].join('');
}

function toad(): string {
  const c = '#7D8A4A';
  return [
    path('M-20,0 Q-22,-16 -8,-20 Q8,-24 18,-14 Q24,-6 20,0Z', c),
    circle(-6, -18, 5, c) + circle(8, -20, 5, c),
    circle(-6, -19, 2.4, '#F4E6A8') + circle(8, -21, 2.4, '#F4E6A8'),
    circle(-6, -19, 1.1, C.ink) + circle(8, -21, 1.1, C.ink),
    stroke('M-8,-10 Q4,-6 16,-10', '#5E6A32', 1.4),
    circle(-10, -6, 1.6, '#5E6A32') + circle(4, -4, 1.4, '#5E6A32') + circle(12, -8, 1.2, '#5E6A32'),
    path('M-22,0 L-30,2 L-26,-4Z M20,0 L28,2 L24,-4Z', c),
  ].join('');
}

function wasp(): string {
  return [
    `<ellipse cx="-4" cy="-14" rx="9" ry="4" fill="${C.ochre}"/>`,
    stroke('M-8,-17.5 L-8,-10.5 M-3,-18 L-3,-10', C.ink, 1.6),
    circle(8, -14, 4, C.ink),
    `<ellipse cx="0" cy="-20" rx="7" ry="3" fill="#FFFFFF" opacity="0.7" transform="rotate(-20 0 -20)"/>`,
    `<ellipse cx="2" cy="-21" rx="6" ry="2.6" fill="#FFFFFF" opacity="0.6" transform="rotate(15 2 -21)"/>`,
  ].join('');
}

function snake(): string {
  const c = '#6F7A3A';
  return [
    path('M-60,0 Q-40,-18 -20,-4 Q0,10 20,-6 Q34,-18 44,-14 Q56,-10 58,-18 Q60,-28 50,-30 Q40,-30 40,-22 Q36,-24 30,-16 Q14,4 -6,-8 Q-28,-22 -46,-6 Q-54,2 -60,0Z', c),
    circle(52, -25, 1.8, C.ink),
    stroke('M58,-20 L64,-18 M64,-18 L68,-21 M64,-18 L68,-15', C.red, 1),
    circle(-30, -10, 2, '#4F5A2A') + circle(-10, -6, 2, '#4F5A2A') + circle(10, -4, 2, '#4F5A2A') + circle(28, -12, 2, '#4F5A2A'),
  ].join('');
}

function rain(): string {
  let s = '';
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97) % 800) - 400;
    const y = (i * 53) % 300;
    s += stroke(`M${x},${y - 300} l-6,18`, '#9FB4C8', 1.6, 'opacity="0.7"');
  }
  return s;
}

/* ---------- catalogue ---------- */

export const ITEMS: Record<string, ItemDef> = {
  // ciel
  sun: { draw: sun, anim: 'a-glow', light: true },
  moon: { draw: moon, light: true, anim: 'a-glow' },
  cloud: { draw: (_p, it) => (it.c === 'storm' ? cloud().replace('#FBF6EC', '#5D6474') : cloud()), anim: 'a-drift' },
  birds: { draw: birds, anim: 'a-fly' },
  star: { draw: bigStar, anim: 'a-glow', light: true },
  rays: { draw: rays, anim: 'a-pulse', light: true },
  // végétation
  baobab: { draw: (_p, it) => baobab(it), anim: 'a-sway-slow' },
  acacia: { draw: acacia, anim: 'a-sway-slow' },
  karite: { draw: karite, anim: 'a-sway-slow' },
  palm: { draw: palm, anim: 'a-sway' },
  bush: { draw: bush },
  grass: { draw: (p) => grass(p), anim: 'a-sway' },
  field: { draw: (_p, it) => field(it) },
  // architecture & lieux
  hut: { draw: (_p, it) => hut(it) },
  granary: { draw: granary },
  palace: { draw: palace },
  mosque: { draw: mosque },
  'painted-house': { draw: paintedHouse },
  ruins: { draw: ruins },
  peaks: { draw: peaks },
  rock: { draw: rock },
  well: { draw: well },
  // objets
  fire: { draw: fire, light: true },
  mortar: { draw: mortar },
  drum: { draw: drum },
  calabash: { draw: calabash },
  jar: { draw: jar },
  spear: { draw: spear },
  gold: { draw: gold, anim: 'a-glint' },
  'leaf-mask': { draw: leafMask, anim: 'a-dance' },
  'plank-mask': { draw: plankMask, anim: 'a-dance' },
  // animaux
  horse: { draw: () => horse(), anim: 'a-breathe' },
  'horse-run': { draw: () => horse(), anim: 'a-gallop' },
  crocodile: { draw: crocodile, anim: 'a-swim' },
  hare: { draw: hare, anim: 'a-hop' },
  hyena: { draw: hyena, anim: 'a-breathe' },
  dog: { draw: dog, anim: 'a-breathe' },
  catfish: { draw: catfish, anim: 'a-swim' },
  hippo: { draw: (p) => hippo(p), anim: 'a-bob' },
  cow: { draw: cow, anim: 'a-breathe' },
  chicken: { draw: chicken, anim: 'a-peck' },
  // éléments des nouveaux contes
  'millet-ball': { draw: milletBall, anim: 'a-bob' },
  'termite-mound': { draw: termiteMound },
  whip: { draw: whip, anim: 'a-sway' },
  dwarf: { draw: dwarf, anim: 'a-hop' },
  beehive: { draw: beehive, anim: 'a-sway' },
  bees: { draw: bees, anim: 'a-fly' },
  'bird-small': { draw: birdSmall, anim: 'a-peck' },
  yboumbouni: { draw: yboumbouni, anim: 'a-breathe' },
  'wild-cow': { draw: wildCow, anim: 'a-breathe' },
  lion: { draw: lion, anim: 'a-breathe' },
  elephant: { draw: elephant, anim: 'a-breathe' },
  'cloth-bundle': { draw: clothBundle },
  'giant-calabash': { draw: giantCalabash, anim: 'a-roll' },
  ram: { draw: ram, anim: 'a-breathe' },
  rope: { draw: () => stroke('M-60,-30 Q-20,-10 0,-30 Q20,-50 60,-30', '#B8944C', 4) },
  goat: { draw: goat, anim: 'a-breathe' },
  'forest-edge': { draw: forestEdge, anim: 'a-sway-slow' },
  'old-woman': { draw: (_p, it) => oldWoman(it), anim: 'a-breathe' },
  partridge: { draw: partridge, anim: 'a-peck' },
  tortoise: { draw: tortoise, anim: 'a-breathe' },
  'guinea-fowl': { draw: guineaFowl, anim: 'a-peck' },
  owl: { draw: owl, anim: 'a-breathe' },
  mouse: { draw: mouse, anim: 'a-hop' },
  sack: { draw: sack },
  monkey: { draw: monkey, anim: 'a-hop' },
  toad: { draw: toad, anim: 'a-hop' },
  wasp: { draw: wasp, anim: 'a-bob' },
  snake: { draw: snake, anim: 'a-swim' },
  rain: { draw: rain, anim: 'a-rain' },
  // personnages
  man: { draw: (_p, it) => person({ robe: it.c ?? C.indigo, belt: C.white, arms: 'down' }), anim: 'a-breathe' },
  'man-talk': { draw: (_p, it) => person({ robe: it.c ?? C.indigo, belt: C.white, arms: 'talk' }), anim: 'a-breathe' },
  'man-point': { draw: (_p, it) => person({ robe: it.c ?? C.indigo, belt: C.white, arms: 'point' }), anim: 'a-breathe' },
  'man-up': { draw: (_p, it) => person({ robe: it.c ?? C.indigo, belt: C.white, arms: 'up' }), anim: 'a-bob' },
  woman: { draw: (_p, it) => person({ robe: it.c ?? C.green, belt: C.yellow, head: 'wrap', headColor: C.yellow, arms: 'down' }), anim: 'a-breathe' },
  'woman-talk': { draw: (_p, it) => person({ robe: it.c ?? C.green, belt: C.yellow, head: 'wrap', headColor: C.yellow, arms: 'talk' }), anim: 'a-breathe' },
  'woman-up': { draw: (_p, it) => person({ robe: it.c ?? C.green, belt: C.yellow, head: 'wrap', headColor: C.yellow, arms: 'up' }), anim: 'a-bob' },
  'woman-pound': {
    draw: (_p, it) =>
      g(person({ robe: it.c ?? C.red, belt: C.yellow, head: 'wrap', headColor: C.green, arms: 'hold' }), 'transform="translate(-30,0)"') + mortar(),
  },
  child: { draw: (_p, it) => g(person({ robe: it.c ?? C.yellow, arms: 'down' }), 'transform="scale(0.66)"'), anim: 'a-breathe' },
  'child-up': { draw: (_p, it) => g(person({ robe: it.c ?? C.yellow, arms: 'up' }), 'transform="scale(0.66)"'), anim: 'a-hop' },
  'child-sit': { draw: (_p, it) => g(seated({ robe: it.c ?? C.yellow, stool: false }), 'transform="scale(0.66)"') },
  elder: { draw: (_p, it) => person({ robe: it.c ?? C.white, belt: C.ochre, arms: 'cane', beard: true, head: 'cap', headColor: C.red }), anim: 'a-breathe' },
  'elder-sit': { draw: (_p, it) => seated({ robe: it.c ?? C.white, arms: 'talk', beard: true }), anim: 'a-breathe' },
  'yaaba-sit': { draw: (_p, it) => seated({ robe: it.c ?? C.red, arms: 'talk', head: 'wrap', headColor: C.white }), anim: 'a-breathe' },
  king: {
    draw: (_p, it) =>
      person({ robe: it.c ?? C.white, belt: C.red, head: 'bonnet', headColor: C.red, arms: 'down', extra: path('M-8,-86 Q0,-78 8,-86', 'none', `stroke="${C.yellow}" stroke-width="3"`) }),
    anim: 'a-breathe',
  },
  'king-talk': {
    draw: (_p, it) => person({ robe: it.c ?? C.white, belt: C.red, head: 'bonnet', headColor: C.red, arms: 'talk' }),
    anim: 'a-breathe',
  },
  hunter: { draw: (_p, it) => person({ robe: it.c ?? C.ochre, belt: C.ink, head: 'cap', headColor: C.wood, arms: 'bow' }), anim: 'a-breathe' },
  shepherd: { draw: (_p, it) => person({ robe: it.c ?? C.indigo, belt: C.white, head: 'cone', arms: 'cane' }), anim: 'a-breathe' },
  princess: {
    draw: (_p, it) => g(spear(), 'transform="translate(30,0)"') + person({ robe: it.c ?? C.red, belt: C.yellow, head: 'wrap', headColor: C.white, arms: 'hold' }),
    anim: 'a-breathe',
  },
  rider: {
    draw: (_p, it) =>
      [
        g(horse(), ''),
        path('M-14,-82 L18,-82 L16,-66 L-12,-66Z', C.red),
        path('M-4,-80 L4,-56 L12,-56 L8,-80Z', it.c ?? C.red),
        stroke('M-26,-60 L40,-170', C.wood, 3),
        path('M36,-168 L46,-188 L44,-164Z', '#8D8F92'),
        path('M-8,-80 L14,-80 L10,-116 L-2,-116Z', it.c ?? C.red),
        stroke('M8,-110 Q14,-96 4,-92', it.c ?? C.red, 7),
        circle(3, -93, 4, C.skin),
        `<rect x="0" y="-122" width="7" height="8" fill="${C.skin}"/>`,
        circle(4, -128, 10, C.skin),
        path('M-7,-131 Q-7,-148 4,-148 Q16,-148 15,-131 Q4,-134 -7,-131Z', C.white),
        `<ellipse cx="-8" cy="-140" rx="7" ry="3.5" fill="${C.white}"/>`,
      ].join(''),
    anim: 'a-gallop',
  },
  'sky-man': {
    draw: (_p, it) => person({ robe: it.c ?? C.white, belt: C.yellow, head: 'bonnet', headColor: C.yellow, arms: 'up' }),
    anim: 'a-float',
  },
};

/* ---------- décors (ciel + sol) ---------- */

export function backdrop(sky: Sky, ground: Ground, p: Palette): { back: string; front: string } {
  const back: string[] = [`<rect width="${W}" height="${H}" fill="${p.sky}"/>`];
  if (sky === 'night') {
    let s = '';
    for (let i = 0; i < 46; i++) {
      const x = (i * 157.3) % W;
      const y = 14 + ((i * 61.7) % 230);
      const r = i % 7 === 0 ? 1.8 : i % 3 === 0 ? 1.3 : 0.9;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#F4EEDC" class="a-twinkle" style="animation-delay:${((i * 0.37) % 4).toFixed(2)}s"/>`;
    }
    back.push(s);
  }

  // collines lointaines
  const farHills =
    ground === 'sahel'
      ? 'M0 300 Q160 268 320 298 Q480 330 640 290 Q720 274 800 292 L800 450 L0 450Z'
      : ground === 'rocks'
        ? 'M0 304 L60 304 L80 268 L170 268 L190 300 L300 300 L330 258 L420 258 L440 296 L560 296 L590 276 L680 276 L700 302 L800 302 L800 450 L0 450Z'
        : 'M0 300 Q120 254 240 290 Q330 314 430 280 Q560 240 680 284 Q740 300 800 290 L800 450 L0 450Z';
  back.push(`<g class="layer-far">${path(farHills, p.far)}`);
  if (ground === 'village') {
    let huts = '';
    for (const [x, s] of [[90, 0.34], [128, 0.28], [610, 0.32], [652, 0.26], [700, 0.3]] as const) {
      huts += `<g transform="translate(${x},${312}) scale(${s})">${path('M-40,0 L-40,-52 L40,-52 L40,0Z', p.near)}${path('M-56,-46 L0,-120 L56,-46Z', p.near)}</g>`;
    }
    back.push(huts);
  }
  if (ground === 'forest') {
    let trees = '';
    for (let x = 10; x < W; x += 46) trees += circle(x, 312 - ((x * 7) % 18), 26 + ((x * 3) % 10), p.near);
    back.push(trees);
  }
  back.push('</g>');
  back.push(`<g class="layer-mid">${path('M0 332 Q140 302 300 328 Q460 350 600 318 Q700 302 800 322 L800 450 L0 450Z', p.near)}</g>`);
  back.push(path('M0 352 Q200 340 400 350 Q600 360 800 346 L800 450 L0 450Z', p.ground));

  if (ground === 'river') {
    back.push(path('M0 376 Q200 364 400 372 Q600 380 800 368 L800 404 Q600 414 400 406 Q200 398 0 410Z', p.water));
    back.push(`<g class="a-ripple">${stroke('M80 386 L140 386 M300 392 L380 392 M560 384 L620 384 M700 396 L760 396', p.water2, 2.5)}</g>`);
  }
  if (ground === 'lake') {
    back.push(path('M0 366 Q200 356 400 362 Q600 368 800 358 L800 450 L0 450Z', p.water));
    back.push(`<g class="a-ripple">${stroke('M60 384 L130 384 M240 400 L330 400 M470 388 L540 388 M620 410 L720 410 M110 426 L190 426 M400 432 L470 432', p.water2, 2.5)}</g>`);
  }

  const front: string[] = [];
  if (ground === 'lake') {
    front.push(path('M0 440 Q200 432 420 438 Q620 444 800 436 L800 450 L0 450Z', p.ground2));
  } else {
    front.push(path('M0 422 Q200 412 420 420 Q620 428 800 416 L800 450 L0 450Z', p.ground2));
  }
  return { back: back.join(''), front: front.join('') };
}
