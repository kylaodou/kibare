import { Art, Region, Tale } from '../../core/models';
import { taleText } from '../../shared/tale-card/tale-card.component';

export type Biome = 'sahel' | 'savane' | 'foret';
export type Signature = 'peaks' | 'palace' | 'ruins' | 'lake' | 'mosque' | 'hills' | null;
export type Model =
  | 'griot' | 'horse' | 'mask' | 'calabash' | 'croc' | 'hippo' | 'fish' | 'painted' | 'well' | 'palace' | 'ruins'
  | 'lion' | 'hyena' | 'elephant' | 'cow' | 'antelope' | 'goat' | 'dog' | 'hare' | 'bird' | 'owl' | 'tortoise' | 'toad' | 'monkey' | 'hive' | 'stele';

/** Un élément du village relié à un conte. */
export interface Hotspot {
  id: string;
  /** conte associé (null : le griot propose un conte) */
  slug: string | null;
  label: string;
  icon: string;
  x: number;
  z: number;
  /** hauteur de l'étiquette */
  h: number;
  /** rayon de la zone cliquable et de l'obstacle */
  r: number;
  model: Model;
  /** illustration du conte, peinte sur un panneau à côté de l'objet */
  art?: Art;
}

export interface VillagePlan {
  key: string;
  name: string;
  subtitle: string;
  seed: number;
  biome: Biome;
  signature: Signature;
  spots: Hotspot[];
}

/** Paysage de chaque région : climat (du Sahel au nord à la forêt du sud-ouest) et site emblématique à l'horizon. */
const REGION_LOOK: Record<string, { biome: Biome; signature: Signature }> = {
  soum: { biome: 'sahel', signature: 'hills' },
  liptako: { biome: 'sahel', signature: 'mosque' },
  yaadga: { biome: 'sahel', signature: 'palace' },
  sourou: { biome: 'savane', signature: 'lake' },
  bankui: { biome: 'savane', signature: 'lake' },
  kuilse: { biome: 'savane', signature: 'lake' },
  sirba: { biome: 'savane', signature: 'hills' },
  oubri: { biome: 'savane', signature: 'hills' },
  kadiogo: { biome: 'savane', signature: 'palace' },
  nando: { biome: 'savane', signature: null },
  nazinon: { biome: 'savane', signature: 'hills' },
  nakambe: { biome: 'savane', signature: 'palace' },
  goulmou: { biome: 'foret', signature: 'palace' },
  tapoa: { biome: 'foret', signature: 'hills' },
  guiriko: { biome: 'foret', signature: 'mosque' },
  tannounyan: { biome: 'foret', signature: 'peaks' },
  djoro: { biome: 'foret', signature: 'ruins' },
};

const GRIOT: Hotspot = { id: 'griot', slug: null, label: 'Le griot', icon: 'fa-comment-dots', x: 0, z: -2.5, h: 1.75, r: 0.7, model: 'griot' };

/** Représentation choisie pour les contes dont le titre désigne l'objet principal. */
const BY_SLUG: Record<string, Model> = {
  yennenga: 'horse',
  'do-et-les-masques-de-feuilles': 'mask',
  'crocodiles-sabou': 'croc',
  'les-crocodiles-de-bazoule': 'croc',
  'les-hippopotames-de-tengrela': 'hippo',
  'les-silures-sacres-de-dafra': 'fish',
  'l-anneau-du-chef': 'fish',
  'le-pecheur-de-bagre-et-le-poisson-genie': 'fish',
  'awa-et-les-murs-de-tiebele': 'painted',
  'le-thil-gardien-de-la-case': 'painted',
  'la-calebasse-qui-avalait-tout': 'calabash',
  'le-chacal-et-la-calebasse-de-miel': 'hive',
  'le-miel-et-les-genies-nains': 'hive',
  'le-puits-du-lion': 'well',
  'l-homme-du-puits': 'well',
  'les-deux-voleurs': 'well',
  'le-secret-des-ruines-de-loropeni': 'ruins',
  'l-origine-des-yeux-du-hibou': 'owl',
};

/** Élément d'illustration → modèle 3D, du plus marquant au plus commun. */
const BY_ITEM: [string, Model][] = [
  ['crocodile', 'croc'], ['hippo', 'hippo'], ['catfish', 'fish'], ['elephant', 'elephant'], ['lion', 'lion'], ['hyena', 'hyena'],
  ['horse', 'horse'], ['horse-run', 'horse'], ['rider', 'horse'], ['painted-house', 'painted'], ['plank-mask', 'mask'],
  ['ruins', 'ruins'], ['palace', 'palace'], ['well', 'well'], ['giant-calabash', 'calabash'], ['beehive', 'hive'],
  ['owl', 'owl'], ['tortoise', 'tortoise'], ['toad', 'toad'], ['monkey', 'monkey'], ['antelope', 'antelope'],
  ['cow', 'cow'], ['wild-cow', 'cow'], ['hare', 'hare'], ['dog', 'dog'], ['goat', 'goat'], ['ram', 'goat'],
  ['guinea-fowl', 'bird'], ['partridge', 'bird'], ['bird-small', 'bird'], ['chicken', 'bird'], ['calabash', 'calabash'], ['jar', 'calabash'],
];

const FOOTPRINT: Partial<Record<Model, { r: number; h: number; icon: string }>> = {
  horse: { r: 1.5, h: 2.5, icon: 'fa-horse' },
  mask: { r: 0.8, h: 3.3, icon: 'fa-masks-theater' },
  calabash: { r: 1, h: 2, icon: 'fa-bowl-food' },
  hive: { r: 1, h: 2.1, icon: 'fa-bowl-food' },
  croc: { r: 3.4, h: 2.3, icon: 'fa-water' },
  hippo: { r: 3.4, h: 2.3, icon: 'fa-water' },
  fish: { r: 3.4, h: 2.3, icon: 'fa-fish' },
  painted: { r: 2.9, h: 4.3, icon: 'fa-house-chimney' },
  well: { r: 1.2, h: 2.8, icon: 'fa-faucet-drip' },
  palace: { r: 2.9, h: 4.3, icon: 'fa-chess-rook' },
  ruins: { r: 2.7, h: 3.4, icon: 'fa-archway' },
  elephant: { r: 2, h: 3.3, icon: 'fa-paw' },
  lion: { r: 1.3, h: 2.3, icon: 'fa-paw' },
  hyena: { r: 1.2, h: 2.2, icon: 'fa-paw' },
  cow: { r: 1.5, h: 2.4, icon: 'fa-cow' },
  antelope: { r: 1.2, h: 2.3, icon: 'fa-paw' },
  goat: { r: 0.9, h: 2.2, icon: 'fa-paw' },
  dog: { r: 0.9, h: 2.2, icon: 'fa-dog' },
  hare: { r: 0.7, h: 2.2, icon: 'fa-paw' },
  monkey: { r: 0.8, h: 2.2, icon: 'fa-paw' },
  bird: { r: 0.7, h: 2.2, icon: 'fa-dove' },
  owl: { r: 0.8, h: 2.3, icon: 'fa-feather-pointed' },
  tortoise: { r: 0.8, h: 2.2, icon: 'fa-paw' },
  toad: { r: 0.7, h: 2.2, icon: 'fa-frog' },
  stele: { r: 0.7, h: 2.3, icon: 'fa-book-open' },
};

const POND: Model[] = ['croc', 'hippo', 'fish'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 2147483646 || 1;
}

/** Modèle d'un conte : d'abord son objet principal, sinon le premier élément de ses illustrations encore libre dans le village. */
function modelFor(t: Tale, used: Set<Model>): Model {
  const free = (m: Model) => !used.has(m) && !(POND.includes(m) && POND.some((p) => used.has(p)));
  const direct = BY_SLUG[t.slug];
  if (direct && free(direct)) return direct;
  const items = new Set(t.scenes.flatMap((s) => s.art.items.map((i) => i.k)));
  for (const [k, m] of BY_ITEM) if (items.has(k) && free(m)) return m;
  return 'stele';
}

function spotFor(t: Tale, x: number, z: number, model: Model): Hotspot {
  const f = FOOTPRINT[model]!;
  return { id: t.slug, slug: t.slug, label: taleText(t, 'fr').title, icon: f.icon, x, z, h: f.h, r: f.r, model, art: t.scenes[t.cover ?? 0]?.art };
}

/** Village d'accueil : les contes emblématiques, chacun à sa place. */
export function showcasePlan(tales: (slug: string) => Tale | undefined): VillagePlan {
  const layout: [string, number, number, Model][] = [
    ['yennenga', -9, 5, 'horse'],
    ['do-et-les-masques-de-feuilles', -6.5, -6.5, 'mask'],
    ['la-calebasse-qui-avalait-tout', 5.5, 5, 'calabash'],
    ['crocodiles-sabou', 12, 7, 'croc'],
    ['awa-et-les-murs-de-tiebele', 10, -7.5, 'painted'],
    ['le-puits-du-lion', -12, -2, 'well'],
  ];
  const spots = [GRIOT];
  for (const [slug, x, z, m] of layout) {
    const t = tales(slug);
    if (t) spots.push(spotFor(t, x, z, m));
  }
  return { key: 'accueil', name: 'Le village des conteurs', subtitle: 'Les grands contes du Burkina Faso', seed: 12345, biome: 'savane', signature: null, spots };
}

/** Village d'une région ou d'un lieu de la région : son paysage et tous ses contes, disposés autour du feu. */
export function regionPlan(region: Region, tales: Tale[], lieu?: string): VillagePlan {
  const look = REGION_LOOK[region.code] ?? { biome: 'savane', signature: null };
  const key = `${region.code}:${lieu ?? ''}`;
  const seed = hash(key);
  const used = new Set<Model>();
  // le conte dont le lieu correspond passe d'abord, pour lui donner la représentation la plus marquante
  const here = lieu ? [...tales].sort((a, b) => Number(b.place.includes(lieu)) - Number(a.place.includes(lieu))) : tales;
  const list = here.map((t) => {
    const m = modelFor(t, used);
    if (m !== 'stele') used.add(m);
    return { t, m };
  });

  // places réparties autour du feu, en laissant libres le baobab (au nord) et l'arrivée du visiteur (au sud)
  const gap = 0.42;
  const arc = Math.PI - 2 * gap;
  const n = list.length;
  const start = (seed % 100) / 100;
  const spots = [GRIOT];
  list.forEach(({ t, m }, i) => {
    const u = (i + 0.5 + (start - 0.5) * 0.5) / Math.max(1, n);
    const onRight = u < 0.5;
    const along = (onRight ? u : u - 0.5) * 2 * arc;
    const a = onRight ? gap + along : Math.PI + gap + along;
    const f = FOOTPRINT[m]!;
    const radius = 7.2 + f.r + (i % 2 ? 1.6 : 0);
    // angle compté depuis le nord (-z), dans le sens horaire
    spots.push(spotFor(t, Math.sin(a) * radius, -Math.cos(a) * radius, m));
  });
  const name = lieu ? `Village de ${lieu}` : `Pays de ${region.name}`;
  return { key, name, subtitle: lieu ? `Région ${region.name}` : `Autour de ${region.capital}`, seed, biome: look.biome, signature: look.signature, spots };
}
