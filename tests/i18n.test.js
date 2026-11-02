import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dayLabel, fmt, fullDate, sgn, shortDate } from '../www/js/core/format.js';
import { KET } from '../www/js/core/ketones.js';
import { DIETS } from '../www/js/core/nutrition.js';
import dataEn from '../www/js/i18n/data-en.js';
import en from '../www/js/i18n/en.js';
import hr from '../www/js/i18n/hr.js';
import { deviceLang, foodName, getLang, recipeName, setLang, t } from '../www/js/i18n/index.js';

const js = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www', 'js');
const params = v => typeof v === 'string' ? [...v.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort() : null;

test('hrvatski i engleski imaju iste ključeve, istu vrstu vrijednosti i iste parametre', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(hr).sort());
  for (const k of Object.keys(hr)) {
    const a = hr[k], b = en[k];
    assert.equal(Array.isArray(a), Array.isArray(b), k);
    if (Array.isArray(a)) { assert.equal(a.length, b.length, k); continue; }
    if (typeof a === 'function' || typeof b === 'function') continue;
    if (typeof a === 'object') {
      assert.equal(typeof b, 'object', k);
      for (const form of Object.values(b)) assert.deepEqual(params(form), params(a.other), `${k}: parametri množine`);
      continue;
    }
    assert.equal(typeof b, 'string', k);
    assert.deepEqual(params(b), params(a), `${k}: parametri`);
  }
});

test('svaki ključ koji kod koristi postoji u rječniku', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const used = new Set();
  for (const f of walk(js).filter(f => f.endsWith('.js') && !f.includes(`${path.sep}i18n${path.sep}`))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\('([\w.]+)'[,)]/g)) used.add(m[1]);
    for (const m of src.matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)) used.add(m[1]);
  }
  for (const m of fs.readFileSync(path.join(js, '..', 'index.html'), 'utf8').matchAll(/data-i18n(?:-aria)?="([\w.]+)"/g)) used.add(m[1]);
  assert.ok(used.size > 300, `pronađeno ${used.size} ključeva`);
  for (const k of used) assert.ok(k in hr, `nedostaje ključ ${k}`);
  // ključevi koji se slažu u kodu
  const dynamic = [
    ...[1, 2, 3, 4, 5].map(i => 'ket.tip' + i), ...[1, 2, 3, 4, 5, 6, 7].map(i => 'explain.tip' + i),
    ...[0, 1, 2, 3, 4, 5, 6].map(i => 'rcat.' + i), ...[0, 1, 2, 3, 4].map(i => 'fast.phase.' + i),
    ...[0, 1, 2, 3, 4, 5].flatMap(i => ['ket.' + i, 'glu.' + i, 'ket.text.' + i]),
    'level.limit', 'level.avoid', 'hc.st.not_installed', 'hc.st.update_required', 'hc.st.unavailable', 'hc.st.error',
    'activity.1', 'activity.2', 'activity.3', 'activity.4', 'pace.0', 'pace.1', 'pace.2', 'pace.3'
  ];
  for (const k of dynamic) assert.ok(k in hr, `nedostaje ključ ${k}`);
});

test('engleski: tekst, množina, brojevi i datumi', () => {
  setLang('en');
  try {
    assert.equal(getLang(), 'en');
    assert.equal(t('nav.today'), 'Today');
    assert.equal(t('n.weeksCount', { n: 1 }), '1 week');
    assert.equal(t('n.weeksCount', { n: 3 }), '3 weeks');
    assert.equal(t('n.days', { n: 21 }), '21 days');
    assert.equal(t('weight.eta', { goal: '80.0', date: '1/3/2027' }), 'At the current pace you will reach 80.0 kg around 1/3/2027.');
    assert.equal(fmt(1234.5, 1), '1,234.5');
    assert.equal(sgn(-0.25, 2), '−0.25');
    assert.equal(dayLabel('2026-10-14'), 'Wed 14 Oct');
    assert.equal(shortDate('2026-10-14'), '14/10');
    assert.equal(fullDate('2026-10-14'), '14/10/2026');
    assert.equal(KET[3].l, 'Moderate');
    assert.equal(DIETS[0].name, 'Keto (strict)');
    assert.equal(t('rep.reminderSet', { day: 'Monday', time: '08:00' }), 'Reminder: Monday at 08:00');
  } finally { setLang('hr'); }
});

test('hrvatski je zadani i rezervni jezik', () => {
  setLang('hr');
  assert.equal(t('nav.today'), 'Danas');
  assert.equal(fmt(1234.5, 1), '1.234,5');
  assert.equal(dayLabel('2026-10-14'), 'Sri, 14. lis');
  assert.equal(fullDate('2026-10-14'), '14.10.2026');
  assert.equal(t('n.days', { n: 21 }), '21 dan');
  assert.equal(t('rep.reminderSet', { day: 'Ponedjeljak', time: '08:00' }), 'Podsjetnik: ponedjeljak u 08:00');
  assert.equal(t('nepostojeci.kljuc'), 'nepostojeci.kljuc');
  setLang('de');
  assert.equal(getLang(), 'hr'); // nepodržan jezik → hrvatski
});

test('jezik uređaja: hrvatski i srodni jezici → hr, ostalo → en', () => {
  assert.equal(deviceLang(['hr-HR']), 'hr');
  assert.equal(deviceLang(['bs-BA', 'en']), 'hr');
  assert.equal(deviceLang(['sr-Latn-RS']), 'hr');
  assert.equal(deviceLang(['en-US', 'hr']), 'hr');
  assert.equal(deviceLang(['de-DE']), 'en');
  assert.equal(deviceLang([]), 'en');
});

// foods.js i recipes.js su obične skripte s globalnim konstantama
const loadData = (file, names) => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(js, '..', file), 'utf8') + `;this.out = { ${names} };`, ctx);
  return ctx.out;
};

test('svaka namirnica, sekcija i recept ima engleski prijevod', () => {
  const { FOOD_SECTIONS, FOOD_DB } = loadData('foods.js', 'FOOD_SECTIONS, FOOD_DB');
  const { RECIPES } = loadData('recipes.js', 'RECIPES');
  for (const row of FOOD_DB) assert.ok(dataEn.foods[row[0]], `namirnica bez prijevoda: ${row[0]}`);
  for (const s of FOOD_SECTIONS) {
    for (const k of ['title', 'ntitle', 'intro', 'nintro']) if (s[k]) assert.ok(dataEn.text[s[k]], `sekcija bez prijevoda: ${s[k]}`);
    for (const g of s.groups) for (const k of ['title', 'ntitle']) if (g[k]) assert.ok(dataEn.text[g[k]], `skupina bez prijevoda: ${g[k]}`);
  }
  for (const r of RECIPES) {
    const tr = dataEn.recipes[r.id];
    assert.ok(tr && tr.name, `recept bez prijevoda: ${r.id}`);
    assert.equal(tr.steps.length, r.steps.length, `${r.id}: broj koraka`);
    for (const [name] of r.ingredients) assert.ok(FOOD_DB.some(x => x[0] === name), `${r.id}: sastojak ${name} nije u bazi`);
  }
  // nema viška (zastarjelih prijevoda)
  const names = new Set(FOOD_DB.map(x => x[0]));
  for (const k of Object.keys(dataEn.foods)) assert.ok(names.has(k), `prijevod za nepostojeću namirnicu: ${k}`);
  for (const k of Object.keys(dataEn.recipes)) assert.ok(RECIPES.some(r => r.id === k), `prijevod za nepostojeći recept: ${k}`);
});

test('nazivi namirnica i recepata prate jezik', () => {
  setLang('en');
  try {
    assert.equal(foodName('Cvjetača'), 'Cauliflower');
    assert.equal(foodName('Moj proizvod'), 'Moj proizvod'); // vlastite namirnice ostaju kako su upisane
    assert.equal(recipeName({ id: 'pire-cvjetaca', name: 'Pire od cvjetače' }), 'Cauliflower mash');
  } finally { setLang('hr'); }
  assert.equal(foodName('Cvjetača'), 'Cvjetača');
  assert.equal(recipeName({ id: 'pire-cvjetaca', name: 'Pire od cvjetače' }), 'Pire od cvjetače');
});
