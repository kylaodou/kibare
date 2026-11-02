// Assemble et valide le contenu (contes, régions, langues) puis le copie
// vers le front Angular (données hors-ligne) et le backend Spring Boot (données d'amorçage).
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

const regions = read('regions.json');
const languages = read('languages.json');
const tales = readdirSync(join(here, 'tales')).filter((f) => f.endsWith('.json')).sort().map((f) => read(`tales/${f}`));

const errors = [];
const regionCodes = new Set(regions.map((r) => r.code));
const langCodes = new Set(languages.map((l) => l.code));
const slugs = new Set();
for (const t of tales) {
  const at = (m) => errors.push(`${t.slug}: ${m}`);
  if (slugs.has(t.slug)) at('slug en double');
  slugs.add(t.slug);
  if (!regionCodes.has(t.region)) at(`région inconnue ${t.region}`);
  if (!langCodes.has(t.language)) at(`langue inconnue ${t.language}`);
  for (const l of ['fr', 'en']) if (!t.i18n[l]?.title) at(`titre ${l} manquant`);
  // chaque paragraphe a un identifiant stable : les voix y sont rattachées, quel que soit l'ordre
  const ids = new Set();
  t.scenes.forEach((s, i) => {
    if (!s.id) at(`scène ${i} : identifiant manquant`);
    else if (ids.has(s.id)) at(`scène ${i} : identifiant en double ${s.id}`);
    ids.add(s.id);
    for (const l of ['fr', 'en']) if (!s.text[l]) at(`scène ${i} : texte ${l} manquant`);
    if (s.choice && !s.choice.options[s.choice.answer]) at(`scène ${i} : réponse hors limites`);
  });
  t.quiz.forEach((q, i) => { if (!q.options[q.answer]) at(`quiz ${i} : réponse hors limites`); });
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

// narration enregistrée : une langue est déclarée quand chaque paragraphe a son MP3
const audio = join(here, '../yaaba-web/public/audio/narration');
for (const t of tales) {
  const dir = join(audio, t.slug);
  if (!existsSync(dir)) continue;
  const langs = readdirSync(dir).filter((l) => t.scenes.every((_, i) => existsSync(join(dir, l, `${i}.mp3`))));
  if (langs.length) t.narration = langs.sort();
}

const targets = [join(here, '../yaaba-web/public/data'), join(here, '../yaaba-api/src/main/resources/seed')];
for (const dir of targets) {
  if (!existsSync(join(dir, '..'))) continue;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'tales.json'), JSON.stringify(tales));
  writeFileSync(join(dir, 'regions.json'), JSON.stringify(regions));
  writeFileSync(join(dir, 'languages.json'), JSON.stringify(languages));
}
console.log(`✔ ${tales.length} contes, ${regions.length} régions, ${languages.length} langues`);
