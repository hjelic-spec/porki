import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { burnedOf, calcTargets, dietLevel, kcalOf, netOf, recipeMacros, totals } from '../www/js/core/nutrition.js';

test('neto UH: EU deklaracija (vlakna nisu u UH) i US deklaracija (inc)', () => {
  assert.equal(netOf({ carbs: 10, fiber: 4 }), 10);
  assert.equal(netOf({ carbs: 10, fiber: 4, inc: true }), 6);
  assert.equal(netOf({ carbs: 2, fiber: 5, inc: true }), 0); // nikad negativno
  assert.equal(netOf({}), 0);
});

test('kcal: UH 4, vlakna 2, masti 9, proteini 4 kcal/g', () => {
  assert.equal(kcalOf({ carbs: 10, fiber: 5, fat: 10, protein: 20 }), 40 + 10 + 90 + 80);
  assert.equal(kcalOf({ carbs: 10, fiber: 5, fat: 10, protein: 20, inc: true }), 20 + 10 + 90 + 80);
  assert.equal(kcalOf({}), 0);
});

test('totals zbraja popis unosa', () => {
  const t = totals([{ carbs: 3, fiber: 1, fat: 10, protein: 5 }, { carbs: 4, fiber: 2, fat: 0, protein: 20, inc: true }]);
  assert.deepEqual(t, { net: 5, fiber: 3, fat: 10, protein: 25, kcal: 12 + 2 + 90 + 20 + 8 + 4 + 80, n: 2 });
  assert.deepEqual(totals([]), { net: 0, fiber: 0, fat: 0, protein: 0, kcal: 0, n: 0 });
});

test('burnedOf: ukupno ima prednost, inače aktivno + mirovanje', () => {
  assert.equal(burnedOf({ total: 2400, active: 500, basal: 1800 }), 2400);
  assert.equal(burnedOf({ active: 500, basal: 1800 }), 2300);
  assert.equal(burnedOf({ active: 500 }), 500);
  assert.equal(burnedOf({ total: 0 }), 0);
  assert.equal(burnedOf({ steps: 8000 }), null);
  assert.equal(burnedOf(null), null);
  assert.equal(burnedOf(undefined), null);
});

test('calcTargets: Mifflin-St Jeor, deficit i keto raspodjela', () => {
  const t = calcTargets({ diet: 'keto', sex: 'm', age: 45, height: 180, weight: 100, goal: 85, activity: 1.375, pace: 0.5 });
  // BMR = 10·100 + 6,25·180 − 5·45 + 5 = 1905; TDEE = 1905 · 1,375 = 2619,4; deficit 0,5 kg/tj = 550 kcal/dan
  assert.equal(t.bmr, 1905);
  assert.equal(t.tdee, 2619);
  assert.equal(t.kcal, 2070);
  assert.equal(t.protein, 128); // 1,5 g × 85 kg (ciljna težina)
  assert.equal(t.carbs, 20);
  assert.equal(t.fat, 164);     // (2070 − 4·127,5 − 4·20) / 9
});

test('calcTargets: proteini prema ciljnoj težini, ali ne ispod 80 % trenutne', () => {
  const p = { diet: 'lchf', sex: 'z', age: 40, height: 165, weight: 100, activity: 1.2, pace: 0.25 };
  assert.equal(calcTargets({ ...p, goal: 60 }).protein, 120);  // 1,5 × max(60, 80)
  assert.equal(calcTargets({ ...p, goal: 90 }).protein, 135);  // 1,5 × 90
  assert.equal(calcTargets({ ...p, goal: 110 }).protein, 150); // cilj iznad trenutne → trenutna
  assert.equal(calcTargets({ ...p }).protein, 150);
});

test('calcTargets: kalorije ne idu ispod 1200 (Ž) / 1500 (M)', () => {
  const base = { diet: 'balanced', age: 70, height: 155, weight: 50, activity: 1.2, pace: 0.75 };
  assert.equal(calcTargets({ ...base, sex: 'z' }).kcal, 1200);
  assert.equal(calcTargets({ ...base, sex: 'm' }).kcal, 1500);
});

test('calcTargets: bez spola, dobi, visine ili težine nema izračuna', () => {
  const p = { diet: 'lchf', sex: 'm', age: 40, height: 180, weight: 90, activity: 1.375, pace: 0.5 };
  for (const k of ['sex', 'age', 'height', 'weight']) assert.equal(calcTargets({ ...p, [k]: k === 'sex' ? '' : null }), null, k);
});

test('calcTargets: makronutrijenti odgovaraju kalorijama, masti barem 30 g', () => {
  for (const diet of ['keto', 'lchf', 'lowcarb', 'medit', 'protein', 'balanced'])
    for (const sex of ['m', 'z'])
      for (const weight of [55, 80, 120, 160])
        for (const pace of [0, 0.25, 0.5, 0.75]) {
          const t = calcTargets({ diet, sex, age: 35, height: 172, weight, goal: weight - 10, activity: 1.375, pace });
          assert.ok(t.kcal >= (sex === 'm' ? 1500 : 1200));
          assert.ok(t.fat >= 30 && t.carbs >= 0 && t.protein > 0);
          const kc = 4 * t.protein + 4 * t.carbs + 9 * t.fat;
          // zbroj odstupa samo kad su masti podignute na 30 g ili su UH fiksni (keto/lchf/lowcarb s puno proteina)
          if (t.fat > 30) assert.ok(Math.abs(kc - t.kcal) <= 15, `${diet} ${sex} ${weight} ${pace}: ${kc} vs ${t.kcal}`);
        }
});

test('recipeMacros: vrijednosti na 100 g preračunate po porciji', () => {
  const foodDb = [['Jaja', 0.7, 0, 10, 13, 60], ['Slanina', 0.5, 0, 40, 14, 30], ['Špinat', 1.4, 2.2, 0.4, 2.9, 100]];
  const r = { servings: 2, ingredients: [['Jaja', 200], ['Slanina', 100], ['Špinat', 100], ['Nepoznato', 50]] };
  const m = recipeMacros(r, foodDb);
  assert.equal(m.grams, 200);                       // (200 + 100 + 100) / 2; nepoznati sastojak se preskače
  assert.equal(m.carbs, 1.7);                       // (1,4 + 0,5 + 1,4) / 2 = 1,65 → 1,7
  assert.equal(m.fat, 30.2);                        // (20 + 40 + 0,4) / 2
  assert.equal(m.protein, 21.5);                    // (26 + 14 + 2,9) / 2 = 21,45
  assert.equal(m.fiber, 1.1);
  assert.equal(m.net, m.carbs);
  assert.equal(recipeMacros(r, foodDb, 4).fat, 120.8);
});

test('dietLevel: ocjena namirnice ovisi o prehrani', () => {
  const row = (name, net, level = '') => [name, net, 0, 0, 0, 100, level, 'Sekcija'];
  assert.equal(dietLevel(row('Bademi', 5), 'lchf'), '');
  assert.equal(dietLevel(row('Bademi', 5), 'keto'), 'limit');   // strogi keto
  assert.equal(dietLevel(row('Jabuka', 12, 'limit'), 'keto'), 'avoid');
  assert.equal(dietLevel(row('Jabuka', 12, 'limit'), 'lchf'), 'limit');
  assert.equal(dietLevel(row('Jabuka', 12, 'limit'), 'lowcarb'), '');
  assert.equal(dietLevel(row('Riža, kuhana', 28, 'avoid'), 'lowcarb'), 'limit');
  assert.equal(dietLevel(row('Kruh, bijeli', 48, 'avoid'), 'lowcarb'), 'avoid');
  assert.equal(dietLevel(row('Kruh, bijeli', 48, 'avoid'), 'medit'), 'limit');
  assert.equal(dietLevel(row('Slanina', 1), 'medit'), 'avoid');
  assert.equal(dietLevel(row('Slanina', 1), 'balanced'), 'limit');
  assert.equal(dietLevel(row('Maslac', 0.6), 'medit'), 'limit');
  assert.equal(dietLevel(row('Maslac', 0.6), 'protein'), '');
  assert.equal(dietLevel(row('Banana', 20, 'avoid'), 'balanced'), '');
  assert.equal(dietLevel(row('Med', 80, 'avoid'), 'balanced'), 'limit');
  assert.equal(dietLevel(row('Eritritol (sladilo)', 0, 'limit'), 'keto'), '');
});
