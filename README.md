# KIBARE — Le Burkina Faso à travers ses histoires

KIBARE est un site web qui préserve et transmet les contes du Burkina Faso : on les découvre sur une carte, on les écoute en cinq langues, et on peut entrer dans un village en 3D où un griot les raconte.

**Site en ligne : https://kibare.onrender.com**

Projet du cours *Technologies Web & Multimédia* — Master 1, IBAM / UJKZ.

## Ce qu'on peut faire

- **Explorer la carte** en 2D ou en 3D, par région, province, commune ou ville.
- **Écouter 56 contes**, illustrés et animés, en français, anglais, mooré, dioula et fulfulde.
- **Entrer en immersion 3D** : chaque région a son village, et chaque conte y a sa représentation.
- **Prêter sa voix** à un conte, paragraphe par paragraphe, depuis le navigateur.
- **Gagner des tampons** dans son passeport en terminant des contes.
- **Administrer le site** : contes, voix, contributions, commentaires et utilisateurs.

## La Veillée 3D

Ouvrez `/veillee`, ou cliquez sur « Entrer en immersion 3D » dans le panneau de la carte.

| Action | Ordinateur | Téléphone |
|---|---|---|
| Marcher | Flèches, Z Q S D, ou clic sur le sol | Flèches à l'écran ou toucher le sol |
| Regarder | Glisser avec la souris | Glisser un doigt |
| Zoomer | Molette ou pavé tactile | Pincer |
| Écouter un conte | S'approcher, puis touche Entrée | S'approcher, puis toucher le bouton |

Pendant le récit, la langue se change directement dans la barre du griot.

## Les outils

| Partie | Outils |
|---|---|
| Site | Angular 21, PrimeNG, Leaflet, Three.js |
| Serveur | Spring Boot 3.5, Java 21, Spring Security (JWT) |
| Données | PostgreSQL en ligne, H2 en local |
| Contenu | Traduction NLLB-200, voix Edge TTS et MMS-TTS |

## Organisation du projet

```
content/     les contes, régions et langues (fichiers JSON)
tools/       scripts Python : traduction, voix, cartes
yaaba-web/   le site (Angular)
yaaba-api/   le serveur (Spring Boot)
```

## Lancer le projet sur son ordinateur

Il faut Node 20 ou plus, Java 21 et Maven.

```bash
# 1. Préparer le contenu
node content/build.mjs

# 2. Lancer le serveur (http://localhost:8081)
cd yaaba-api
mvn spring-boot:run

# 3. Dans un autre terminal, lancer le site (http://localhost:4200)
cd yaaba-web
npm install
npm start
```

Compte administrateur en local : `admin@kibare.bf` / `kibare2026`.

Pour lancer les tests du serveur : `cd yaaba-api && mvn test`.

## Configuration

Les mots de passe ne vont **jamais** dans le code. En local, ils vont dans `yaaba-api/config/application.yml` (ignoré par git). En ligne, ils vont dans les variables d'environnement de Render.

| Variable | À quoi elle sert |
|---|---|
| `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` | La base de données |
| `CLOUDINARY_URL` | Le stockage des voix et des vidéos |
| `BREVO_API_KEY`, `MAIL_FROM` | L'envoi des e-mails |
| `GOOGLE_CLIENT_ID` | La connexion avec Google |
| `APP_URL` | L'adresse du site, pour les liens des e-mails |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Le compte administrateur |
| `JWT_SECRET` | La sécurité des sessions |

## Mise en ligne (gratuite)

| Service | Rôle |
|---|---|
| Render | Héberge le site. Chaque envoi sur `main` le met à jour tout seul. |
| Neon | La base de données |
| Cloudinary | Les voix et les vidéos envoyées |
| Brevo | Les e-mails |
| UptimeRobot | Appelle `/actuator/health` toutes les 5 minutes pour que le site ne s'endorme pas |

## Sources

Les contes sont des réécritures originales, et chacun cite sa source : F.-V. Équilbecq (domaine public), MENAPLN/UNICEF, traditions orales. Sons : Gallica/BnF, balafon de KONE IF (CC BY 4.0). Cartes : geoBoundaries, IGB. Les traductions en langues nationales sont un premier jet automatique, à faire relire par des locuteurs.
