# KIBARE — Le Burkina Faso à travers ses histoires

> En mooré, le **kibare** (pluriel *kibaye*) est le « récit grave » : un conte qui pose des questions
> et invite à méditer. C'était le genre du Larlé Naaba Abga, conteur de la Radio nationale dès 1961.

Plateforme web multimédia pour **préserver, numériser et transmettre** le patrimoine oral burkinabè :
carte interactive **2D / 3D**, contes **illustrés et animés**, **narration audio** en cinq langues,
**narration interactive**, **comptes, contributions modérées, notifications et commentaires**.

Projet du module *Technologies Web Multimédia* — Master 1.

## Fonctionnalités

| | |
|---|---|
| **Carte 2D / 3D** | Leaflet (2D, fond Esri) et Three.js (relief extrudé, ombres) synchronisés : la sélection est conservée quand on bascule. Recherche, filtres par type et par langue, fiches région. |
| **33 contes** | Toutes les régions représentées : Yennenga, le Faux Départ du Moogho Naaba, les crocodiles de Sabou, le lac Bam, les pics de Sindou, contes gourmantchés (Équilbecq), gouin, lyélé, contes du recueil préscolaire MENAPLN/UNICEF… Chaque conte cite sa **source**. |
| **Lecteur** | Illustration à gauche, **texte intégral** à droite ; paragraphe actif synchronisé avec l'image et la voix ; taille du texte réglable ; impression ; partage. |
| **Langues** | Français et anglais rédigés ; **mooré, dioula, fulfulde** en premier jet de traduction automatique (NLLB-200), **signalé dans le lecteur** et à valider par des locuteurs. |
| **Narration** | Un MP3 par paragraphe : voix neuronales (fr, en) et MMS-TTS (langues nationales) ; voix réelles de la communauté publiées après modération ; synthèse du navigateur en secours. |
| **Ambiance sonore** | Un enregistrement par région : archives de l'Exposition de 1931 (Gallica/BnF, domaine public), balafon sénoufo (CC BY 4.0) ; balafon synthétisé (Web Audio API) pour le Sahel. |
| **Narration interactive** | Choix à faire au fil du récit, glossaire contextuel (mooré, fulfulde…), morale, quiz, passeport de tampons et badges. |
| **Communauté** | Inscription / connexion (JWT), proposition de contes ou de voix, **notifications** (nouvelle demande pour l'admin, acceptation ou refus pour l'auteur), page des contributeurs, **commentaires** avec réponses. |
| **Administration** | Tableau de bord (activité sur 30 jours, contes les plus lus, répartitions), modération des contributions avec note, éditeur de contes multilingue, gestion des voix, des commentaires et des utilisateurs. |
| **Accessibilité** | Navigation clavier, contrastes AA, ARIA, mouvement réduit, mode sombre, transcription intégrale de chaque audio, mode hors-ligne si l'API est indisponible. |

## Architecture

```
projetMM/
├── content/          Contenu éditorial (source unique)
│   ├── tales/*.json  Un fichier par conte (scènes, illustrations, quiz, glossaire, sources)
│   ├── regions.json  languages.json
│   └── build.mjs     Validation → yaaba-web/public/data et yaaba-api/.../seed (+ détection des MP3)
├── tools/            Chaîne IA hors-ligne (Python) : translate.py (NLLB-200), narrate.py (Edge TTS, MMS-TTS)
├── yaaba-web/        Angular 21 · PrimeNG 21 · Font Awesome · Three.js · Leaflet
└── yaaba-api/        Spring Boot 3.5 · Spring Security (JWT) · JPA · H2 (ou PostgreSQL) · Swagger
```

## Lancer en local

Prérequis : Node 20+, Java 21, Maven.

```bash
# 1. Contenu (après toute modification dans content/ ou de nouveaux MP3)
node content/build.mjs

# 2. API — http://localhost:8081  (Swagger : http://localhost:8081/swagger-ui.html)
cd yaaba-api
mvn spring-boot:run

# 3. Front — http://localhost:4200
cd yaaba-web
npm install
npm start
```

Compte administrateur créé au démarrage : **admin@kibare.bf / kibare2026**
(à changer via `ADMIN_EMAIL` / `ADMIN_PASSWORD` ; secret des jetons : `JWT_SECRET`).

Tests de l'API : `cd yaaba-api && mvn test` (catalogue, inscription/connexion, droits admin,
contribution → validation → publication et notifications, commentaires).

## Traductions et voix (optionnel)

```bash
python -m venv tools/.venv && tools/.venv/Scripts/pip install torch transformers sentencepiece edge-tts
set HF_HOME=tools/.cache
tools/.venv/Scripts/python tools/translate.py            # mooré, dioula, fulfulde → tale.mt
tools/.venv/Scripts/python tools/translate.py --repair   # retire les termes religieux parasites
tools/.venv/Scripts/python tools/narrate.py fr en moore dioula fulfulde
node content/build.mjs
```

Les textes saisis à la main dans l'éditeur ne sont jamais écrasés par la traduction automatique.

## Déploiement

**Tout-en-un (Docker)** : front et API sur le même port.

```bash
docker build -t kibare .
docker run -p 8080:8080 -e ADMIN_PASSWORD=motdepasse -e JWT_SECRET=un-long-secret -v kibare-data:/data kibare
```

Compatible Render, Railway, Fly.io… (variables : `PORT`, `DATABASE_URL`, `DATABASE_USER`,
`DATABASE_PASSWORD`, `STORAGE_DIR`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS`).

**Front statique seul** (Netlify, Vercel, GitHub Pages) : `cd yaaba-web && npx ng build`, puis publier
`dist/yaaba-web/browser`. Contes, carte, voix et passeport fonctionnent ; comptes, contributions et
commentaires nécessitent l'API.

## Sources et licences

- **Récits** : réécritures originales, source citée sur chaque conte — Équilbecq (1913–1916, domaine public),
  abcBurkina.net, *Recueil de contes pour les structures d'éducation préscolaire* (MENAPLN/UNICEF, 2022),
  traditions orales publiques. Les ayants droit peuvent saisir les textes originaux dans l'éditeur (champ « droits »).
- **Importance des contes** (page À propos) : J.-P. Ouédraogo, S. É. Sawadogo, A. D. K. Compaoré,
  « Les contes et légendes moaga : entre tradition orale, culture et éducation », *Recherches & Regards d'Afrique*, 2022.
- **Sons** : Gallica/BnF 1931 (domaine public, via Wikimedia Commons) ; balafon par KONE IF (CC BY 4.0).
- **Cartes** : geoBoundaries (CC BY 4.0) ; fond Esri, © contributeurs OpenStreetMap.
- **IA** : NLLB-200 et MMS-TTS (Meta), Edge TTS — usage signalé dans l'interface.
