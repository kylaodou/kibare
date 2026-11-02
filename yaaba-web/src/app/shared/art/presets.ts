import { Art } from '../../core/models';

/** Décors prêts à l'emploi pour illustrer un paragraphe depuis l'éditeur. */
export const ART_PRESETS: { id: string; label: string; art: Art }[] = [
  {
    id: 'veillee',
    label: 'Veillée sous le baobab',
    art: { sky: 'night', ground: 'village', items: [
      { k: 'moon', x: 82, y: 300 }, { k: 'baobab', x: 20, y: 26 }, { k: 'hut', x: 78, y: 30, s: 0.85 },
      { k: 'fire', x: 50 }, { k: 'yaaba-sit', x: 36 }, { k: 'child-sit', x: 62, flip: true }, { k: 'child-sit', x: 69, flip: true, c: '#C9822B' },
    ] },
  },
  {
    id: 'village',
    label: 'Village en journée',
    art: { sky: 'day', ground: 'village', items: [
      { k: 'sun', x: 84, y: 300 }, { k: 'hut', x: 18, y: 26 }, { k: 'granary', x: 30, y: 24, s: 0.8 },
      { k: 'woman-pound', x: 52 }, { k: 'child-up', x: 70 }, { k: 'chicken', x: 80 },
    ] },
  },
  {
    id: 'savane',
    label: 'Savane et animaux',
    art: { sky: 'day', ground: 'savanna', items: [
      { k: 'sun', x: 82, y: 300 }, { k: 'acacia', x: 18, y: 26 }, { k: 'hare', x: 44, s: 1.5 }, { k: 'hyena', x: 66, flip: true, s: 1.1 }, { k: 'grass', x: 84 },
    ] },
  },
  {
    id: 'brousse-soir',
    label: 'Brousse au crépuscule',
    art: { sky: 'dusk', ground: 'savanna', items: [
      { k: 'sun', x: 78, y: 220 }, { k: 'baobab', x: 22, y: 24, c: 'bare' }, { k: 'hunter', x: 50 }, { k: 'birds', x: 60, y: 240 },
    ] },
  },
  {
    id: 'riviere',
    label: 'Bord de rivière',
    art: { sky: 'day', ground: 'river', items: [
      { k: 'palm', x: 12, y: 36 }, { k: 'woman', x: 30, y: 4 }, { k: 'calabash', x: 38, y: 4 }, { k: 'crocodile', x: 70, y: -16 },
    ] },
  },
  {
    id: 'lac',
    label: 'Lac et mare',
    art: { sky: 'dawn', ground: 'lake', items: [
      { k: 'sun', x: 74, y: 250 }, { k: 'palm', x: 10, y: 36 }, { k: 'hippo', x: 56, y: -24 }, { k: 'birds', x: 40, y: 240 },
    ] },
  },
  {
    id: 'sahel',
    label: 'Sahel et troupeau',
    art: { sky: 'dawn', ground: 'sahel', items: [
      { k: 'sun', x: 86, y: 240 }, { k: 'shepherd', x: 66 }, { k: 'cow', x: 44 }, { k: 'cow', x: 26, s: 0.85 },
    ] },
  },
  {
    id: 'palais',
    label: 'Cour royale',
    art: { sky: 'day', ground: 'village', items: [
      { k: 'palace', x: 56, y: 34, s: 0.85 }, { k: 'king-talk', x: 28 }, { k: 'elder', x: 16, flip: true }, { k: 'drum', x: 86 },
    ] },
  },
  {
    id: 'foret',
    label: 'Forêt et génies',
    art: { sky: 'dusk', ground: 'forest', items: [
      { k: 'karite', x: 16, y: 24 }, { k: 'dwarf', x: 50 }, { k: 'dwarf', x: 60, flip: true }, { k: 'leaf-mask', x: 80 },
    ] },
  },
  {
    id: 'rochers',
    label: 'Collines et rochers',
    art: { sky: 'day', ground: 'rocks', items: [
      { k: 'sun', x: 84, y: 300 }, { k: 'peaks', x: 58, y: 30, s: 0.8 }, { k: 'man', x: 20, c: '#2F3E6B' },
    ] },
  },
];
