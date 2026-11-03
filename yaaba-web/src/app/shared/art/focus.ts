import { Art } from '../../core/models';

/** Mots qui désignent chaque élément d'une illustration : la caméra cadre celui que nomme la phrase lue. */
const PEOPLE = ['homme', 'man', 'chasseur', 'hunter', 'roi', 'king', 'chef', 'chief', 'naaba', 'père', 'father', 'fils', 'son'];
const FOCUS_WORDS: Record<string, string[]> = {
  man: PEOPLE, 'man-talk': PEOPLE, 'man-point': PEOPLE, 'man-up': PEOPLE, hunter: ['chasseur', 'hunter'],
  king: ['roi', 'king', 'chef', 'chief', 'naaba'], 'king-talk': ['roi', 'king', 'chef', 'chief', 'naaba'],
  woman: ['femme', 'woman', 'mère', 'mother', 'fille', 'daughter', 'reine'], 'woman-talk': ['femme', 'woman', 'mère', 'mother'],
  'woman-up': ['femme', 'woman', 'mère', 'mother'], 'woman-pound': ['femme', 'woman', 'mère', 'mother'],
  princess: ['princesse', 'princess'], 'old-woman': ['vieille', 'old woman', 'grand-mère'],
  child: ['enfant', 'child', 'petit', 'little', 'garçon', 'boy'], 'child-up': ['enfant', 'child', 'petit', 'little', 'garçon', 'boy'],
  elder: ['vieil', 'vieux', 'ancien', 'elder', 'old man', 'sage'], 'elder-sit': ['vieil', 'vieux', 'ancien', 'elder', 'sage'],
  shepherd: ['berger', 'herder', 'shepherd'], rider: ['cavalier', 'rider', 'horseman'],
  lion: ['lion'], hyena: ['hyène', 'hyena'], hare: ['lièvre', 'hare'], elephant: ['éléphant', 'elephant'],
  croc: ['crocodile'], crocodile: ['crocodile'], tortoise: ['tortue', 'tortoise'], snake: ['serpent', 'snake'],
  monkey: ['singe', 'monkey'], dog: ['chien', 'dog', 'chacal', 'jackal'], cow: ['vache', 'cow', 'troupeau', 'herd'],
  goat: ['chèvre', 'goat', 'bouc'], ram: ['bélier', 'ram'], horse: ['cheval', 'horse'], 'horse-run': ['cheval', 'horse'],
  chicken: ['poule', 'hen', 'poulet', 'chicken', 'coq'], 'guinea-fowl': ['pintade', 'guinea fowl'], partridge: ['perdrix', 'partridge'],
  owl: ['hibou', 'owl'], bat: ['chauve-souris', 'bat'], toad: ['crapaud', 'toad'], mouse: ['souris', 'mouse'],
  antelope: ['antilope', 'antelope', 'biche', 'doe'], camel: ['chameau', 'camel'], lizard: ['margouillat', 'lizard'],
  hippo: ['hippopotame', 'hippo'], catfish: ['poisson', 'fish', 'silure', 'catfish'], 'wild-cow': ['buffle', 'buffalo'],
  yboumbouni: ['yboumbouni'], bees: ['abeille', 'bee'], beehive: ['miel', 'honey', 'ruche'], wasp: ['guêpe', 'wasp'],
  baobab: ['baobab'], well: ['puits', 'well'], fire: ['feu', 'fire'], palace: ['palais', 'palace', 'cour'],
  calabash: ['calebasse', 'calabash'], 'giant-calabash': ['calebasse', 'calabash'], drum: ['tambour', 'drum', 'tam-tam'],
  jar: ['jarre', 'jar', 'canari'], granary: ['grenier', 'granary'], hut: ['case', 'hut'], moon: ['lune', 'moon'],
  sun: ['soleil', 'sun'], rain: ['pluie', 'rain', 'orage', 'storm'], peaks: ['pics', 'peaks', 'rocher'],
};

/** Indice de l'élément de l'illustration nommé en premier dans la phrase (null : aucun). */
export function sceneFocus(art: Art, text: string): number | null {
  const sentence = text.toLowerCase();
  let best: { i: number; at: number } | null = null;
  art.items.forEach((it, i) => {
    for (const word of FOCUS_WORDS[it.k] ?? []) {
      const at = sentence.search(new RegExp(String.raw`(^|[^\p{L}])` + word, 'u'));
      if (at >= 0 && (!best || at < best.at)) best = { i, at };
    }
  });
  return best ? (best as { i: number }).i : null;
}
