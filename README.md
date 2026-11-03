# KIBARE — Le Burkina Faso à travers ses histoires

> En mooré, le **kibare** (pluriel *kibaye*) est le « récit grave » : un conte qui pose des questions
> et invite à méditer. C'était le genre du Larlé Naaba Abga, conteur de la Radio nationale dès 1961.

Plateforme web multimédia pour **préserver, numériser et transmettre** le patrimoine oral burkinabè :
carte interactive **2D / 3D**, contes **illustrés et animés**, **narration audio** en cinq langues,
**voix de la communauté paragraphe par paragraphe**, comptes (e-mail ou **Google**), contributions
modérées, notifications et commentaires.

Projet du module *Technologies Web Multimédia* — Master 1.

## Fonctionnalités

| | |
|---|---|
| **Carte 2D / 3D** | Leaflet (2D) et Three.js (relief extrudé) synchronisés. Les **17 régions** issues de la réforme de 2025, avec affichage par région, province ou commune, et les chefs-lieux. Recherche, filtres, fiches région. |
| **La Veillée 3D** | Village burkinabè en 3D temps réel (WebGL, Three.js), sans installation : on marche autour du feu, chaque objet (cheval de Yennenga, masque, crocodile, case de Tiébélé…) ouvre un conte, et le griot le raconte avec gestes, sous-titres et narration dans la langue choisie. Son qui suit le visiteur, qualité adaptée automatiquement à l'appareil. |
| **56 contes** | Au moins trois contes par région : Yennenga, le Faux Départ du Moogho Naaba, les crocodiles de Sabou, le lac Bam, les pics de Sindou, contes gourmantchés, gouin, lyélé, peuls, bissa… Chaque conte cite sa **source**. |
| **Lecteur** | Illustration animée à gauche (la caméra cadre l'élément nommé dans la phrase lue), **texte intégral** à droite, paragraphe actif synchronisé avec l'image et la voix. Vidéo de paragraphe facultative. Taille du texte, partage, favoris. |
| **Langues** | Français et anglais rédigés ; **mooré, dioula, fulfulde** en premier jet de traduction automatique (NLLB-200), **signalé dans le lecteur** et à valider par des locuteurs. |
| **Narration** | Un MP3 par paragraphe en cinq langues (voix de synthèse par IA). Les **voix de la communauté** sont rattachées à chaque paragraphe : la première voix disponible est jouée par défaut, l'auditeur peut en choisir une autre ; synthèse du navigateur en secours, et gestion des fichiers illisibles. |
| **Narration interactive** | Choix au fil du récit, glossaire contextuel, morale, quiz, **passeport** de tampons et badges (accessible sans compte). |
| **Comptes** | Inscription par e-mail avec **lien de confirmation**, ou **connexion avec Google**. **Mot de passe oublié** : code à 6 chiffres valable 5 minutes, limité en fréquence et en essais. Compte créé avec Google : e-mail de bienvenue avec un lien pour choisir son mot de passe. E-mails aux couleurs de KIBARE (logo et motifs intégrés). |
| **Communauté** | Proposer un conte ou **prêter sa voix** paragraphe par paragraphe ; notifications (nouvelle demande pour l'admin, décision pour l'auteur) ; page des contributeurs ; commentaires avec réponses. |
| **Administration** | Tableau de bord ; listes **paginées, recherchées et triées côté serveur** (contes, contributions, commentaires, utilisateurs) ; modération avec écoute de chaque enregistrement et **texte exact du paragraphe** ; une contribution validée ne peut plus être refusée ; éditeur de contes multilingue avec **voix par paragraphe** (enregistrement dans le navigateur ou import), **vidéo par paragraphe (10 Mo max.)** et aperçu de l'animation. |
| **Accessibilité** | Responsive (testé de 360 px au bureau), navigation clavier, contrastes AA, ARIA, mouvement réduit, mode sombre, transcription intégrale de chaque audio, mode hors-ligne si l'API est indisponible. |

## Architecture

```
projetMM/
├── content/          Contenu éditorial (source unique)
│   ├── tales/*.json  Un fichier par conte (scènes avec identifiants stables, illustrations, quiz, glossaire, sources)
│   ├── regions.json  languages.json
│   └── build.mjs     Validation → yaaba-web/public/data et yaaba-api/.../seed (+ détection des MP3)
├── tools/            Chaîne hors-ligne (Python) : translate.py (NLLB-200), narrate.py (Edge TTS, MMS-TTS),
│                     build_geo.py (régions, provinces, communes), build_mail_art.py (images des e-mails)
├── yaaba-web/        Angular 21 · PrimeNG 21 · Font Awesome · Three.js · Leaflet
└── yaaba-api/        Spring Boot 3.5 · Spring Security (JWT) · JPA · H2 (ou PostgreSQL) · Spring Mail · Swagger
```

Chaque paragraphe d'un conte a un **identifiant stable** (`<slug>-p<n>`, ou `p-<uuid>` pour un paragraphe
créé dans l'éditeur) : les voix s'y rattachent, jamais à la simple position du paragraphe.

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
(à changer en production via `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

Tests de l'API : `cd yaaba-api && mvn test` — 15 scénarios : catalogue, inscription et vérification
d'e-mail, droits admin, voix paragraphe par paragraphe, transitions de statut, suppression, listes paginées,
limite vidéo, mot de passe oublié (code valide, faux, expiré, réutilisé, trop d'essais), changement de
mot de passe, Google non configuré, commentaires.

## Configuration

Les secrets ne sont **jamais commités**. En local, ils vont dans `yaaba-api/config/application.yml`
(lu automatiquement par Spring Boot, ignoré par git) ; en production, dans des variables d'environnement.

```yaml
# yaaba-api/config/application.yml (exemple)
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: votre-adresse@gmail.com
    password: mot-de-passe-d-application   # 16 lettres, myaccount.google.com/apppasswords
yaaba:
  mail:
    from: "KIBARE <votre-adresse@gmail.com>"
  google:
    client-id: xxxxxxxx.apps.googleusercontent.com
```

| Variable | Rôle |
|---|---|
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` | Serveur SMTP. Sans `MAIL_HOST`, les e-mails sont déposés en HTML dans `data/outbox` (développement). |
| `APP_URL` | Adresse publique du site, pour les liens des e-mails (défaut `http://localhost:4200`). |
| `REQUIRE_VERIFIED_EMAIL` | `true` par défaut : il faut avoir confirmé son adresse pour contribuer. |
| `GOOGLE_CLIENT_ID` | ID client OAuth « Application Web » (Google Cloud Console). Vide : bouton Google masqué. Ajouter l'adresse du site aux « Origines JavaScript autorisées ». |
| `JWT_SECRET` | Secret de signature des sessions — **obligatoire en production**. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Compte administrateur créé au premier démarrage. |
| `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` | Base de données (H2 fichier par défaut, PostgreSQL possible). |
| `STORAGE_DIR`, `CORS_ORIGINS`, `PORT` | Fichiers envoyés (voix, vidéos), origines autorisées, port HTTP. |

## Traductions et voix (optionnel)

```bash
python -m venv tools/.venv && tools/.venv/Scripts/pip install torch transformers sentencepiece edge-tts
set HF_HOME=tools/.cache
tools/.venv/Scripts/python tools/translate.py            # mooré, dioula, fulfulde → tale.mt
tools/.venv/Scripts/python tools/translate.py --repair   # retire les termes religieux parasites
tools/.venv/Scripts/python tools/narrate.py fr en moore dioula fulfulde
node content/build.mjs
```

Les deux scripts reprennent là où ils s'étaient arrêtés (cache des traductions, MP3 existants conservés).
Les textes saisis à la main dans l'éditeur ne sont jamais écrasés par la traduction automatique.

## Déploiement

**Tout-en-un (Docker)** : front et API sur le même port.

```bash
docker build -t kibare .
docker run -p 8080:8080 -e ADMIN_PASSWORD=motdepasse -e JWT_SECRET=un-long-secret -v kibare-data:/data kibare
```

Compatible Render, Railway, Fly.io, Koyeb… avec les variables de la section *Configuration*.

**Front statique seul** (Netlify, Vercel, GitHub Pages) : `cd yaaba-web && npx ng build`, puis publier
`dist/yaaba-web/browser`. Contes, carte, voix et passeport fonctionnent ; comptes, contributions et
commentaires nécessitent l'API.

## Sources et licences

- **Récits** : réécritures originales, source citée sur chaque conte — Équilbecq (1913–1916, domaine public),
  abcBurkina.net, *Recueil de contes pour les structures d'éducation préscolaire* (MENAPLN/UNICEF, 2022),
  traditions orales publiques. Les ouvrages sous droits ne sont pas reproduits.
- **Importance des contes** (page À propos) : J.-P. Ouédraogo, S. É. Sawadogo, A. D. K. Compaoré,
  « Les contes et légendes moaga : entre tradition orale, culture et éducation », *Recherches & Regards d'Afrique*, 2022.
- **Sons** : Gallica/BnF 1931 (domaine public, via Wikimedia Commons) ; balafon par KONE IF (CC BY 4.0).
- **Cartes** : geoBoundaries (CC BY 4.0), communes IGB 2020 (Humanitarian Data Exchange) ; fond Esri, © contributeurs OpenStreetMap.
- **IA** : NLLB-200 (Meta) pour les traductions, synthèse vocale par IA pour la narration — usage signalé dans l'interface.
