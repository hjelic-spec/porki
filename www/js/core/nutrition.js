// Makronutrijenti, kalorije, dnevni ciljevi i ocjena namirnica prema prehrani
import { r1 } from './format.js';

export const KCAL_PER_KG = 7700; // ≈ kcal u 1 kg masnog tkiva

// Neto UH: na EU deklaracijama "ugljikohidrati" već NE uključuju vlakna.
export const netOf = f => Math.max(0, (f.carbs || 0) - (f.inc ? (f.fiber || 0) : 0));
export const kcalOf = f => netOf(f) * 4 + (f.fiber || 0) * 2 + (f.fat || 0) * 9 + (f.protein || 0) * 4;
export function totals(list) {
  const t = { net: 0, fiber: 0, fat: 0, protein: 0, kcal: 0, n: list.length };
  for (const f of list) {
    t.net += netOf(f); t.fiber += f.fiber || 0; t.fat += f.fat || 0; t.protein += f.protein || 0; t.kcal += kcalOf(f);
  }
  return t;
}
export const burnedOf = e => !e ? null : e.total != null ? e.total : (e.active != null || e.basal != null) ? (e.active || 0) + (e.basal || 0) : null;

export const DIETS = [
  { id: 'keto', name: 'Keto (strogi)', desc: 'Do 20 g neto UH dnevno, puno masti, umjereno proteina. Cilj je stalna ketoza.' },
  { id: 'lchf', name: 'LCHF', desc: 'Do 50 g neto UH, prirodne masti i proteini. Fleksibilnija od strogog ketoa.' },
  { id: 'lowcarb', name: 'Umjereni low-carb', desc: 'Do 100 g neto UH – manje škroba i šećera, ali bez ketoze.' },
  { id: 'medit', name: 'Mediteranska', desc: 'Povrće, riba, maslinovo ulje, mahunarke i cjelovite žitarice; oko 45 % kalorija iz UH.' },
  { id: 'protein', name: 'Visokoproteinska', desc: 'Oko 2 g proteina po kg ciljne težine – za očuvanje mišića i trening snage.' },
  { id: 'balanced', name: 'Uravnotežena', desc: 'Klasična raspodjela (oko 50 % UH, 20 % proteina, 30 % masti) uz kalorijski deficit.' }
];
export const dietOf = id => DIETS.find(d => d.id === id) || DIETS[1];
export const isLowCarb = diet => ['keto', 'lchf', 'lowcarb'].includes(diet || 'lchf');
export const ACTIVITY = [[1.2, 'Sjedilački (malo kretanja)'], [1.375, 'Lagana aktivnost (1–3 treninga tjedno)'], [1.55, 'Umjerena aktivnost (3–5 treninga)'], [1.725, 'Visoka aktivnost (6–7 treninga)']];
export const PACE = [[0, 'Održavanje težine'], [0.25, 'Polako (0,25 kg tjedno)'], [0.5, 'Umjereno (0,5 kg tjedno)'], [0.75, 'Brže (0,75 kg tjedno)']];

// Mifflin-St Jeor + raspodjela makronutrijenata prema prehrani
export function calcTargets(p) {
  const w = p.weight, h = p.height, age = p.age;
  if (!w || !h || !age || !p.sex) return null;
  const bmr = 10 * w + 6.25 * h - 5 * age + (p.sex === 'm' ? 5 : -161);
  const tdee = bmr * p.activity;
  const floor = p.sex === 'm' ? 1500 : 1200;
  const kcal = Math.round(Math.max(floor, tdee - p.pace * KCAL_PER_KG / 7) / 10) * 10;
  const refW = p.goal && p.goal < w ? Math.max(p.goal, w * 0.8) : w; // proteini prema ciljnoj težini
  let P, C, F;
  const rest = (k, used) => Math.max(0, (k - used));
  switch (p.diet) {
    case 'keto': P = 1.5 * refW; C = 20; F = rest(kcal, 4 * P + 4 * C) / 9; break;
    case 'lchf': P = 1.5 * refW; C = 50; F = rest(kcal, 4 * P + 4 * C) / 9; break;
    case 'lowcarb': P = 1.4 * refW; C = 100; F = rest(kcal, 4 * P + 4 * C) / 9; break;
    case 'medit': P = 1.2 * refW; F = kcal * 0.35 / 9; C = rest(kcal, 4 * P + 9 * F) / 4; break;
    case 'protein': P = 2.0 * refW; F = kcal * 0.30 / 9; C = rest(kcal, 4 * P + 9 * F) / 4; break;
    default: P = 1.2 * refW; F = kcal * 0.30 / 9; C = rest(kcal, 4 * P + 9 * F) / 4;
  }
  F = Math.max(F, 30);
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein: Math.round(P), carbs: Math.round(C), fat: Math.round(F) };
}

// Hranjive vrijednosti recepta po `portions` porcija; sastojci se traže u bazi namirnica (vrijednosti na 100 g)
const byName = new WeakMap();
export function recipeMacros(r, foodDb, portions = 1) {
  let by = byName.get(foodDb);
  if (!by) byName.set(foodDb, by = new Map(foodDb.map(x => [x[0], x])));
  const t = { carbs: 0, fiber: 0, fat: 0, protein: 0, grams: 0 };
  for (const [name, g] of r.ingredients) {
    const x = by.get(name);
    if (!x) continue;
    const k = g / 100;
    t.carbs += x[1] * k; t.fiber += x[2] * k; t.fat += x[3] * k; t.protein += x[4] * k; t.grams += g;
  }
  const f = portions / r.servings;
  const out = { carbs: r1(t.carbs * f), fiber: r1(t.fiber * f), fat: r1(t.fat * f), protein: r1(t.protein * f), grams: Math.round(t.grams * f), inc: false };
  out.net = netOf(out); out.kcal = kcalOf(out);
  return out;
}

// Ocjena namirnice iz baze za odabranu prehranu: '' (prikladno), 'limit' (ograničeno) ili 'avoid' (izbjegavati)
const KETO_STRICT = new Set(['Bademi', 'Lješnjaci', 'Kikiriki maslac', 'Bademovo brašno', 'Kokosovo brašno', 'Grčki jogurt 10 %', 'Luk, crveni', 'Paprika, crvena', 'Prokulica', 'Mahune']);
const PROCESSED = new Set(['Slanina', 'Kulen', 'Zimska salama', 'Kobasica, svinjska', 'Hrenovke', 'Pršut', 'Majoneza']);
const SATFAT = new Set(['Svinjska mast', 'Pačja mast', 'Goveđi loj', 'Maslac', 'Ghee (pročišćeni maslac)', 'Slatko vrhnje 35 %', 'Mascarpone', 'Kokosovo ulje', 'Patka s kožom']);
const SUGARY = new Set(['Med', 'Tamna čokolada 85 %']);
const REFINED = new Set(['Kruh, bijeli', 'Riža, kuhana', 'Tjestenina, kuhana']);
export function dietLevel(row, diet = 'lchf') {
  const name = row[0], net = row[1], base = row[6] || '';
  if (diet === 'lchf') return base;
  if (diet === 'keto') {
    if (name === 'Eritritol (sladilo)') return '';
    if (base === 'avoid' || (base === 'limit' && net >= 10)) return 'avoid';
    if (base === 'limit' || KETO_STRICT.has(name) || net >= 7) return 'limit';
    return '';
  }
  if (diet === 'lowcarb') {
    if (net >= 40) return 'avoid';
    if (base === 'avoid' || net >= 15) return 'limit';
    return '';
  }
  // mediteranska, visokoproteinska, uravnotežena: ocjena prema vrsti namirnice
  if (SUGARY.has(name)) return 'limit';
  if (PROCESSED.has(name)) return diet === 'medit' ? 'avoid' : 'limit';
  if (diet === 'medit' && (SATFAT.has(name) || REFINED.has(name))) return 'limit';
  if (diet === 'protein' && REFINED.has(name)) return 'limit';
  return '';
}
