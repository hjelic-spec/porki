// Makronutrijenti, kalorije, dnevni ciljevi i ocjena namirnica prema prehrani
import { t } from '../i18n/index.js';
import { r1 } from './format.js';

export const KCAL_PER_KG = 7700; // ≈ kcal u 1 kg masnog tkiva

// Neto UH: na EU deklaracijama "ugljikohidrati" već NE uključuju vlakna.
export const netOf = f => Math.max(0, (f.carbs || 0) - (f.inc ? (f.fiber || 0) : 0));
export const kcalOf = f => netOf(f) * 4 + (f.fiber || 0) * 2 + (f.fat || 0) * 9 + (f.protein || 0) * 4;
export function totals(list) {
  const sumUp = { net: 0, fiber: 0, fat: 0, protein: 0, kcal: 0, n: list.length };
  for (const f of list) {
    sumUp.net += netOf(f); sumUp.fiber += f.fiber || 0; sumUp.fat += f.fat || 0; sumUp.protein += f.protein || 0; sumUp.kcal += kcalOf(f);
  }
  return sumUp;
}
export const burnedOf = e => !e ? null : e.total != null ? e.total : (e.active != null || e.basal != null) ? (e.active || 0) + (e.basal || 0) : null;

// Nazivi i opisi su u prijevodima (diet.<id>.name / .desc)
export const DIETS = ['keto', 'lchf', 'lowcarb', 'medit', 'protein', 'balanced'].map(id => ({
  id, get name() { return t(`diet.${id}.name`); }, get desc() { return t(`diet.${id}.desc`); }
}));
export const dietOf = id => DIETS.find(d => d.id === id) || DIETS[1];
export const isLowCarb = diet => ['keto', 'lchf', 'lowcarb'].includes(diet || 'lchf');
// [vrijednost, ključ prijevoda]
export const ACTIVITY = [[1.2, 'activity.1'], [1.375, 'activity.2'], [1.55, 'activity.3'], [1.725, 'activity.4']];
export const PACE = [[0, 'pace.0'], [0.25, 'pace.1'], [0.5, 'pace.2'], [0.75, 'pace.3']];

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
  const tot = { carbs: 0, fiber: 0, fat: 0, protein: 0, grams: 0 };
  for (const [name, g] of r.ingredients) {
    const x = by.get(name);
    if (!x) continue;
    const k = g / 100;
    tot.carbs += x[1] * k; tot.fiber += x[2] * k; tot.fat += x[3] * k; tot.protein += x[4] * k; tot.grams += g;
  }
  const f = portions / r.servings;
  const out = { carbs: r1(tot.carbs * f), fiber: r1(tot.fiber * f), fat: r1(tot.fat * f), protein: r1(tot.protein * f), grams: Math.round(tot.grams * f), inc: false };
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
