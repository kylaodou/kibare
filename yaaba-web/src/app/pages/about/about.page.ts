import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/data.service';
import { I18nService, TranslatePipe } from '../../core/i18n.service';
import { LogoComponent } from '../../shared/logo/logo.component';

type L = { fr: string; en: string };

/** Fonctions des contes et légendes moose, d'après Ouédraogo, Sawadogo & Compaoré (2022). */
const PILLARS: { icon: string; t: L; d: L }[] = [
  {
    icon: 'fa-people-roof',
    t: { fr: 'Une tradition orale', en: 'An oral tradition' },
    d: {
      fr: 'Le conte fait partie du rogom-miki, « ce que l’on a trouvé en naissant » : nos ancêtres contaient, nous contons, et la génération suivante contera. Il n’existe que parce qu’il se transmet de bouche à oreille.',
      en: 'Tales belong to rogom-miki, “what we found when we were born”: our ancestors told them, we tell them, and the next generation will tell them. They exist only because they are passed on by word of mouth.',
    },
  },
  {
    icon: 'fa-fingerprint',
    t: { fr: 'Un miroir de l’identité', en: 'A mirror of identity' },
    d: {
      fr: 'À travers ses animaux, ses lieux sacrés et ses génies, le conte révèle « l’âme » d’un peuple : l’attachement au buudu (la famille élargie), la solidarité, le respect des ancêtres et de la parole donnée.',
      en: 'Through its animals, sacred places and spirits, a tale reveals the “soul” of a people: attachment to the buudu (the extended family), solidarity, respect for the ancestors and for one’s word.',
    },
  },
  {
    icon: 'fa-graduation-cap',
    t: { fr: 'Une école de la vie', en: 'A school for life' },
    d: {
      fr: 'Les veillées sont des moments où l’on enseigne les normes de conduite : le savoir-vivre et le savoir-être. Intégrité, hospitalité, dignité et respect sont transmis sans leçon magistrale, par l’histoire.',
      en: 'Evening gatherings are times when codes of conduct are taught: how to live and how to be. Integrity, hospitality, dignity and respect are passed on not through lectures but through stories.',
    },
  },
  {
    icon: 'fa-fire',
    t: { fr: 'Un lien social', en: 'A social bond' },
    d: {
      fr: 'Autour du feu, la communauté se retrouve pour oublier les soucis du jour, discuter, se divertir et se donner des conseils pour le lendemain. Le conte rassemble les âges.',
      en: 'Around the fire the community gathers to forget the day’s worries, talk, have fun and share advice for tomorrow. Tales bring the generations together.',
    },
  },
];

const WORDS: { w: string; d: L }[] = [
  { w: 'solmdé', d: { fr: 'le conte, du verbe solme : cacher, mystifier', en: 'a tale, from the verb solme: to hide, to mystify' } },
  { w: 'solem kʋʋga', d: { fr: 'le conte court ou la devinette', en: 'a short tale or riddle' } },
  { w: 'solem wogdo', d: { fr: 'les contes longs', en: 'long tales' } },
  { w: 'kʋdemde', d: { fr: 'la légende : « des faits anciens »', en: 'a legend: “things of long ago”' } },
  { w: 'kibare / kibaye', d: { fr: 'le récit grave, qui pousse à méditer', en: 'the grave tale, which invites reflection' } },
  { w: 'gomde', d: { fr: 'la parole, affirmation de soi', en: 'speech, the affirmation of oneself' } },
];

const CAST: { icon: string; n: L; d: L }[] = [
  { icon: 'fa-carrot', n: { fr: 'M’ba Soamba, le lièvre', en: 'M’ba Soamba, the hare' }, d: { fr: 'La ruse, l’intelligence et la vivacité d’esprit.', en: 'Cunning, intelligence and quick wit.' } },
  { icon: 'fa-drumstick-bite', n: { fr: 'M’ba Katre, la hyène', en: 'M’ba Katre, the hyena' }, d: { fr: 'La sottise, la gourmandise et l’égoïsme.', en: 'Foolishness, greed and selfishness.' } },
  { icon: 'fa-scale-balanced', n: { fr: 'Le lion', en: 'The lion' }, d: { fr: 'Le plus puissant avec le buffle et l’éléphant, mais seul juste.', en: 'Mighty like the buffalo and the elephant, but the only just one.' } },
  { icon: 'fa-shield-dog', n: { fr: 'Le chien', en: 'The dog' }, d: { fr: 'Le défenseur des faibles.', en: 'The defender of the weak.' } },
  { icon: 'fa-crow', n: { fr: 'Le coq', en: 'The rooster' }, d: { fr: 'L’orgueil.', en: 'Pride.' } },
  { icon: 'fa-shield-halved', n: { fr: 'La tortue', en: 'The tortoise' }, d: { fr: 'L’innocence, souvent punie à tort.', en: 'Innocence, often unjustly punished.' } },
];

const CREDITS: { t: L; items: L[] }[] = [
  {
    t: { fr: 'Récits', en: 'Stories' },
    items: [
      { fr: 'François-Victor Équilbecq, Essai sur la littérature merveilleuse des noirs (1913–1916), domaine public : contes gourmantchés réécrits.', en: 'François-Victor Équilbecq, Essai sur la littérature merveilleuse des noirs (1913–1916), public domain: retold Gourmantché tales.' },
      { fr: 'abcBurkina.net : contes gouin recueillis par Justine Fayama, conte lyélé de Réo, « L’ingratitude » : réécritures libres, sources citées sur chaque conte.', en: 'abcBurkina.net: Gouin tales collected by Justine Fayama, a Lyélé tale from Réo, “L’ingratitude”: free retellings, sources cited on each tale.' },
      { fr: 'Traditions orales publiques (Yennenga, Sabou, Lac Bam, Sindou…) : mises en récit originales, versions et sources indiquées.', en: 'Public oral traditions (Yennenga, Sabou, Lake Bam, Sindou…): original retellings, versions and sources stated.' },
    ],
  },
  {
    t: { fr: 'Sons', en: 'Sounds' },
    items: [
      { fr: 'Enregistrements de l’Exposition coloniale de 1931 (Gallica / BnF, via Wikimedia Commons), domaine public : chants et instruments mossi, kassena, tiefo.', en: 'Recordings from the 1931 Colonial Exhibition (Gallica / BnF, via Wikimedia Commons), public domain: Mossi, Kassena and Tiefo songs and instruments.' },
      { fr: 'Balafon sénoufo et balafon traditionnel : KONE IF, Wikimedia Commons, licence CC BY 4.0.', en: 'Senufo and traditional balafon: KONE IF, Wikimedia Commons, CC BY 4.0 licence.' },
      { fr: 'Balafon du Sahel et bruitages (grillons, oiseaux) : synthèse en direct avec la Web Audio API.', en: 'Sahel balafon and sound effects (crickets, birds): synthesised live with the Web Audio API.' },
    ],
  },
  {
    t: { fr: 'Cartes', en: 'Maps' },
    items: [
      { fr: 'Limites administratives : geoBoundaries (Banque mondiale), licence CC BY 4.0.', en: 'Administrative boundaries: geoBoundaries (World Bank), CC BY 4.0 licence.' },
      { fr: 'Fonds de carte 2D : © Esri, HERE, Garmin, © contributeurs OpenStreetMap.', en: '2D basemap: © Esri, HERE, Garmin, © OpenStreetMap contributors.' },
    ],
  },
  {
    t: { fr: 'Intelligence artificielle', en: 'Artificial intelligence' },
    items: [
      { fr: 'Traductions en mooré, dioula et fulfulde : premier jet par le modèle NLLB-200 (Meta), signalé sur chaque conte et à valider par un locuteur.', en: 'Translations into Mooré, Dioula and Fulfulde: first draft by the NLLB-200 model (Meta), flagged on each tale and awaiting review by a speaker.' },
      { fr: 'Voix de lecture : synthèse vocale par IA, en français, en anglais et en langues nationales. Les voix de la communauté sont de vraies voix.', en: 'Read-aloud voices: AI speech synthesis, in French, English and the national languages. Community voices are real people.' },
      { fr: 'Illustrations vectorielles et logo : créations originales du projet.', en: 'Vector illustrations and logo: original creations of the project.' },
    ],
  },
];

@Component({
  selector: 'app-about',
  imports: [RouterLink, LogoComponent, TranslatePipe],
  template: `
    <section class="head bogolan">
      <div class="container head-grid">
        <div>
          <span class="eyebrow">{{ 'about.eyebrow' | t }}</span>
          <h1>{{ 'about.title' | t }}</h1>
          <p class="lead">{{ 'about.lead' | t }}</p>
        </div>
        <div class="logo-card"><app-logo variant="full" [size]="150" /></div>
      </div>
      <div class="band-danfani"></div>
    </section>

    <!-- importance des contes -->
    <section class="container body">
      <div class="intro">
        <span class="eyebrow">{{ c().why.eyebrow }}</span>
        <h2>{{ c().why.title }}</h2>
        <p class="lead">{{ c().why.lead }}</p>
      </div>

      <div class="pillars">
        @for (p of pillars; track p.icon) {
          <article class="pillar">
            <span class="p-ico"><i class="fa-solid {{ p.icon }}"></i></span>
            <h3>{{ p.t[lang()] }}</h3>
            <p>{{ p.d[lang()] }}</p>
          </article>
        }
      </div>

      <div class="two">
        <article class="block words">
          <h3><i class="fa-solid fa-book-open"></i> {{ c().words }}</h3>
          <dl>
            @for (w of words; track w.w) {
              <div>
                <dt lang="mos">{{ w.w }}</dt>
                <dd>{{ w.d[lang()] }}</dd>
              </div>
            }
          </dl>
        </article>
        <article class="block cast">
          <h3><i class="fa-solid fa-paw"></i> {{ c().cast }}</h3>
          <ul>
            @for (a of cast; track a.icon) {
              <li>
                <span class="c-ico"><i class="fa-solid {{ a.icon }}"></i></span>
                <span><strong>{{ a.n[lang()] }}</strong> {{ a.d[lang()] }}</span>
              </li>
            }
          </ul>
        </article>
      </div>

      <figure class="larle">
        <div class="year"><span>1961</span><small>Radio nationale</small></div>
        <div>
          <h3>{{ c().larle.title }}</h3>
          <p>{{ c().larle.text }}</p>
        </div>
      </figure>

      <p class="cite">
        <i class="fa-solid fa-book"></i>
        {{ c().cite }}
        <em>« Les contes et légendes moaga : entre tradition orale, culture et éducation »</em>,
        Recherches &amp; Regards d’Afrique, n° spécial, nov. 2022, p. 199–215. Laboratoire de linguistique (Laboling), Université Norbert Zongo, Koudougou.
      </p>
    </section>

    <!-- nom et logo -->
    <section class="section soft">
      <div class="container two">
        <article class="block">
          <h2>{{ 'about.name.title' | t }}</h2>
          <p>{{ 'about.name.text' | t }}</p>
        </article>
        <article class="block">
          <h2>{{ 'about.logo.title' | t }}</h2>
          <ul class="logo-parts">
            <li><span class="sw brown"></span>{{ 'about.logo.red' | t }}</li>
            <li><span class="sw green"></span>{{ 'about.logo.green' | t }}</li>
            <li><span class="sw yellow"></span>{{ 'about.logo.star' | t }}</li>
            <li><span class="sw ochre"></span>{{ 'about.logo.tree' | t }}</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="container body">
      <h2 class="sec">{{ 'about.features' | t }}</h2>
      <div class="features">
        @for (f of features; track f.k) {
          <div class="feature">
            <span class="f-ico"><i class="fa-solid {{ f.icon }}"></i></span>
            <div>
              <h3>{{ 'about.f.' + f.k + '.t' | t }}</h3>
              <p>{{ 'about.f.' + f.k + '.d' | t }}</p>
            </div>
          </div>
        }
      </div>

      <div class="two">
        <article class="block">
          <h2>{{ 'about.method.title' | t }}</h2>
          <p>{{ 'about.method.text' | t }}</p>
          <p class="muted">{{ c().method }}</p>
        </article>
        <article class="block">
          <h2>{{ 'about.tech.title' | t }}</h2>
          <ul class="tech">
            <li><i class="fa-brands fa-angular"></i> Angular 21 · PrimeNG 21</li>
            <li><i class="fa-solid fa-cube"></i> Three.js (3D) · Leaflet (2D)</li>
            <li><i class="fa-brands fa-java"></i> Spring Boot 3 · Spring Security (JWT) · JPA · H2</li>
            <li><i class="fa-solid fa-wave-square"></i> Web Audio API · Web Speech API · MediaRecorder</li>
            <li><i class="fa-brands fa-font-awesome"></i> Font Awesome · Montserrat &amp; Nunito Sans</li>
          </ul>
        </article>
      </div>

      <h2 class="sec">{{ 'about.credits.title' | t }}</h2>
      <div class="credits">
        @for (g of credits; track g.t.fr) {
          <article class="block">
            <h3>{{ g.t[lang()] }}</h3>
            <ul>
              @for (i of g.items; track i.fr) {
                <li>{{ i[lang()] }}</li>
              }
            </ul>
          </article>
        }
      </div>
      <p class="muted course">{{ 'about.credits.course' | t }}</p>

      <div class="cta">
        <a routerLink="/carte" class="btn"><i class="fa-solid fa-map-location-dot"></i> {{ 'home.cta.map' | t }}</a>
        <a routerLink="/contribuer" class="btn btn-ghost"><i class="fa-solid fa-microphone-lines"></i> {{ 'nav.contribute' | t }}</a>
      </div>
    </section>
  `,
  styles: `
    .head { padding-top: clamp(32px, 5vw, 64px); }
    .head-grid { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 32px; padding-bottom: 48px; }
    .head h1 { max-width: 20ch; }
    .head .eyebrow { color: var(--y-ochre); }
    .logo-card { background: #fff; padding: 16px 22px; border-radius: var(--radius-l); }
    .body { padding-block: 56px; }
    .intro { max-width: 720px; margin-bottom: 36px; }
    .pillars { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); margin-bottom: 28px; }
    .pillar { padding: 24px; border: 1px solid var(--border); border-top: 4px solid var(--y-ochre); border-radius: var(--radius-l); background: var(--surface); }
    .pillar h3 { font-size: 1.1rem; margin: 16px 0 8px; }
    .pillar p { color: var(--text-2); font-size: 0.93rem; margin: 0; }
    .p-ico { width: 46px; height: 46px; border-radius: var(--radius); display: grid; place-items: center; background: var(--y-red-soft); color: var(--y-red-ink); font-size: 1.1rem; }
    .two { display: grid; gap: 20px; margin-bottom: 20px; }
    @media (min-width: 860px) { .two { grid-template-columns: 1fr 1fr; } }
    .block { padding: 28px; border: 1px solid var(--border); border-radius: var(--radius-l); background: var(--surface); }
    .block h2 { font-size: 1.4rem; }
    .block h3 { font-size: 1.1rem; margin-bottom: 16px; }
    .block h3 i { color: var(--y-ochre); margin-right: 6px; }
    .block p { color: var(--text-2); }
    .words dl { margin: 0; display: grid; gap: 12px; }
    .words dl div { display: grid; grid-template-columns: 140px 1fr; gap: 12px; padding-bottom: 12px; border-bottom: 1px dashed var(--border); }
    .words dt { font-family: var(--font-display); font-weight: 700; color: var(--y-red); }
    .words dd { margin: 0; color: var(--text-2); font-size: 0.93rem; }
    .cast ul, .logo-parts, .tech, .credits ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; color: var(--text-2); }
    .cast li { display: flex; gap: 12px; align-items: flex-start; font-size: 0.93rem; }
    .cast strong { color: var(--text); display: block; }
    .c-ico { flex: none; width: 34px; height: 34px; border-radius: var(--radius); display: grid; place-items: center; background: var(--y-yellow-soft); color: var(--y-yellow-ink); }
    .larle { margin: 0 0 20px; display: flex; flex-wrap: wrap; gap: 28px; align-items: center; padding: 28px; border-radius: var(--radius-l); background: #3b1d0c var(--pattern-bogolan); color: #e9d5bd; }
    .larle h3 { color: #fff; font-size: 1.2rem; }
    .larle p { margin: 0; max-width: 70ch; }
    .year { display: flex; flex-direction: column; align-items: center; padding: 14px 20px; border: 2px solid var(--y-ochre); border-radius: var(--radius); }
    .year span { font-family: var(--font-display); font-size: 2rem; font-weight: 800; color: var(--y-ochre); line-height: 1; }
    .year small { margin-top: 6px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; }
    .cite { font-size: 0.85rem; color: var(--text-3); margin: 0; }
    .cite i { color: var(--y-ochre); margin-right: 4px; }
    .soft { background: var(--surface-2); }
    .soft .two { margin-block: 0; }
    .logo-parts li { display: flex; align-items: center; gap: 12px; }
    .sw { flex: none; width: 22px; height: 22px; border-radius: var(--radius-s); }
    .sw.brown { background: #7c3109; } .sw.green { background: #00894a; } .sw.yellow { background: #fbb117; } .sw.ochre { background: #e69135; }
    .tech i { width: 24px; color: var(--y-red); }
    .sec { font-size: 1.6rem; margin: 48px 0 20px; }
    .sec:first-child { margin-top: 0; }
    .features { display: grid; gap: 24px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); margin-bottom: 48px; }
    .feature { display: flex; gap: 16px; }
    .feature h3 { font-size: 1.1rem; margin-bottom: 4px; }
    .feature p { color: var(--text-2); font-size: 0.93rem; margin: 0; }
    .f-ico { flex: none; width: 46px; height: 46px; border-radius: var(--radius); display: grid; place-items: center; background: var(--y-green-soft); color: var(--y-green-ink); }
    .credits { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }
    .credits li { font-size: 0.9rem; }
    .course { margin-top: 16px; font-size: 0.88rem; }
    .cta { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 40px; }
  `,
})
export class AboutPage {
  readonly data = inject(DataService);
  private i18n = inject(I18nService);
  readonly lang = computed(() => (this.i18n.lang() === 'en' ? 'en' : 'fr'));
  readonly pillars = PILLARS;
  readonly words = WORDS;
  readonly cast = CAST;
  readonly credits = CREDITS;
  readonly c = computed(() =>
    this.lang() === 'en'
      ? {
          why: {
            eyebrow: 'Why tales matter',
            title: 'Living libraries',
            lead: 'For a long time, grandparents were the keepers of this oral literature. Today, despite the efforts of communities, cultural promoters and the media, tales are disappearing. Yet the moments when tales are told are when the wise pass on cultural and educational values to present and future generations.',
          },
          words: 'Speaking about tales in Mooré',
          cast: 'Who’s who in the tales',
          larle: {
            title: 'Larlé Naaba Abga, master of kibaye',
            text: 'Every Tuesday from 7:45 to 8:30 pm, from 1961 onwards, Burkina Faso’s national radio broadcast the evening tales of Larlé Naaba Abga, until his death in 1982. His genre was the kibare: an enigmatic, “grave” tale that raises important questions so that listeners draw lessons of wisdom from it. KIBARE takes its name from this.',
          },
          cite: 'Source: Jean-Paul Ouédraogo, Sobzanga Édouard Sawadogo and Abdoul Dramane Karim Compaoré,',
          method: 'Each tale is a retelling in our own words with its sources cited. Texts in national languages produced by machine translation are clearly flagged and will be replaced as speakers validate or record them.',
        }
      : {
          why: {
            eyebrow: 'Pourquoi les contes comptent',
            title: 'Des bibliothèques vivantes',
            lead: 'Longtemps, les grands-parents ont été les dépositaires de cette littérature orale. Aujourd’hui, malgré les efforts des communautés, des promoteurs culturels et des médias, les contes sont en voie de disparition. Pourtant, les moments de contes sont ceux où les sages transmettent les valeurs culturelles et éducatives aux générations présentes et futures.',
          },
          words: 'Parler du conte en mooré',
          cast: 'Qui est qui dans les contes',
          larle: {
            title: 'Larlé Naaba Abga, maître des kibaye',
            text: 'Chaque mardi de 19 h 45 à 20 h 30, dès 1961, la Radio nationale du Burkina diffusait les soirées de contes du Larlé Naaba Abga, jusqu’à sa disparition en 1982. Son genre était le kibare : un conte énigmatique, « grave », qui pose des questions importantes pour que l’auditeur en tire des leçons de sagesse. C’est de là que KIBARE tire son nom.',
          },
          cite: 'Source : Jean-Paul Ouédraogo, Sobzanga Édouard Sawadogo et Abdoul Dramane Karim Compaoré,',
          method: 'Chaque conte est une réécriture dans nos propres mots, avec ses sources citées. Les textes en langues nationales issus de la traduction automatique sont signalés clairement et seront remplacés au fur et à mesure de leur validation ou de leur enregistrement par des locuteurs.',
        },
  );
  readonly features = [
    { k: 'map', icon: 'fa-cube' },
    { k: 'art', icon: 'fa-palette' },
    { k: 'voice', icon: 'fa-headphones' },
    { k: 'lang', icon: 'fa-language' },
    { k: 'play', icon: 'fa-hand-pointer' },
    { k: 'passport', icon: 'fa-stamp' },
    { k: 'contrib', icon: 'fa-microphone-lines' },
    { k: 'a11y', icon: 'fa-universal-access' },
    { k: 'offline', icon: 'fa-wifi' },
  ];
}
