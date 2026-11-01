/** Texte multilingue : une clé par code de langue (fr, en, moore, dioula, fulfulde…). */
export type Txt = Record<string, string>;

export type TaleType = 'conte' | 'legende' | 'recit';

export type Sky = 'day' | 'dawn' | 'dusk' | 'night';
export type Ground = 'savanna' | 'river' | 'lake' | 'rocks' | 'village' | 'sahel' | 'forest';

/** Un élément d'illustration posé dans une scène (x en %, y en px au-dessus de l'horizon). */
export interface ArtItem {
  k: string;
  x: number;
  y?: number;
  s?: number;
  flip?: boolean;
  c?: string;
  a?: string;
}

export interface Art {
  sky: Sky;
  ground: Ground;
  items: ArtItem[];
}

export interface Choice {
  q: Txt;
  options: Txt[];
  answer: number;
  reveal: Txt;
}

export interface Scene {
  art: Art;
  text: Txt;
  choice?: Choice;
}

export interface QuizItem {
  q: Txt;
  options: Txt[];
  answer: number;
}

export interface GlossaryEntry {
  term: string;
  lang: string;
  def: Txt;
}

export interface TaleText {
  title: string;
  subtitle: string;
  summary: string;
  moral: string;
}

export interface AudioTrack {
  id: number;
  lang: string;
  url: string;
  narrator: string;
  durationSec?: number;
  /** un fichier par paragraphe quand le conteur a enregistré séquence par séquence */
  segments?: string[];
}

export interface Tale {
  slug: string;
  type: TaleType;
  region: string;
  place: string;
  coords: [number, number];
  people: string;
  language: string;
  duration: number;
  age: number;
  featured?: boolean;
  cover?: number;
  tags: string[];
  i18n: Record<string, TaleText>;
  scenes: Scene[];
  quiz: QuizItem[];
  glossary: GlossaryEntry[];
  source: Txt;
  audio?: AudioTrack[];
  views?: number;
  likes?: number;
  comments?: number;
  origin?: string;
  /** langues disposant d'une narration MP3 par paragraphe (audio/narration/{slug}/{lang}/{i}.mp3) */
  narration?: string[];
  /** langues dont le texte est une traduction automatique à relire */
  mt?: string[];
  contributors?: { name: string; role: string; userId?: number }[];
}

export interface Region {
  code: string;
  name: string;
  capital: string;
  peoples: string[];
  languages: string[];
  center: [number, number];
  description: Txt;
}

export interface Language {
  code: string;
  name: string;
  native: string;
  family: string;
  speakers: string;
  regions: string[];
  peoples: string[];
  greeting?: { text: string; meaning: Txt };
  thanks?: { text: string; meaning: Txt };
  description: Txt;
  /** true si le texte des contes est disponible dans cette langue */
  text?: boolean;
}

export interface ContributionPayload {
  kind: 'story' | 'voice';
  taleSlug?: string;
  title: string;
  region: string;
  language: string;
  taleType?: TaleType;
  summary?: string;
  moral?: string;
  text?: string;
  consent: boolean;
}

export interface Contribution extends ContributionPayload {
  id: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  publishedSlug?: string;
  reviewNote?: string;
  audioUrl?: string;
  segments?: string[];
  userId?: number;
  authorName: string;
  authorEmail?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface CommentItem {
  id: number;
  taleSlug: string;
  parentId?: number;
  text: string;
  status: 'VISIBLE' | 'HIDDEN';
  userId: number;
  userName: string;
  admin: boolean;
  createdAt: string;
}

export interface Contributor {
  id: number;
  name: string;
  region?: string;
  language?: string;
  bio?: string;
  approved: number;
  tales: string[];
  since: string;
}

export interface PlatformStats {
  tales: number;
  regions: number;
  languages: number;
  audioTracks: number;
  contributions: number;
  pending: number;
  views: number;
  users: number;
  comments: number;
}
