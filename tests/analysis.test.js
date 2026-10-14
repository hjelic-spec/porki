import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../www/js/core/format.js';
import { dayBalance, dayFood, macroSplit, weekData, weekEnergyVsScale } from '../www/js/core/analysis.js';
import { emptyDb, near } from './helpers.js';

// Hrana od točno `kcal` kalorija (samo masti, da je račun jednostavan)
const food = (date, kcal, time = '12:00') => ({ id: date + time, date, time, name: 'x', carbs: 0, fiber: 0, fat: kcal / 9, protein: 0 });
const WS = '2026-10-05'; // ponedjeljak

test('dayFood: samo unosi tog dana, poredani po vremenu', () => {
  const db = emptyDb();
  db.foods = [food('2026-10-05', 100, '18:00'), food('2026-10-06', 100, '07:00'), food('2026-10-05', 100, '07:30'), food('2026-10-05', 100, '12:00')];
  assert.deepEqual(dayFood(db, '2026-10-05').map(f => f.time), ['07:30', '12:00', '18:00']);
});

test('bilanca dana samo kad postoje i hrana i potrošnja', () => {
  const db = emptyDb();
  db.foods = [food('2026-10-05', 1800)];
  db.energy = { '2026-10-05': { total: 2500 }, '2026-10-06': { total: 2500 } };
  near(assert, dayBalance(db, '2026-10-05'), -700);
  assert.equal(dayBalance(db, '2026-10-06'), null); // potrošnja bez hrane
  db.energy = {};
  assert.equal(dayBalance(db, '2026-10-05'), null); // hrana bez potrošnje
});

test('weekData: 7 dana od ponedjeljka s bilancom, težinom i najvišim ketonima', () => {
  const db = emptyDb();
  db.foods = [food(WS, 2000), food(addDays(WS, 2), 1500)];
  db.energy = { [WS]: { active: 600, basal: 1700 }, [addDays(WS, 1)]: { total: 2400, steps: 9000 } };
  db.weights = { [addDays(WS, 6)]: 88.4 };
  db.ketones = [{ date: WS, ket: 2, glu: 0 }, { date: WS, ket: 4, glu: 1 }];
  const wd = weekData(db, WS);
  assert.equal(wd.length, 7);
  assert.equal(wd[6].d, '2026-10-11');
  near(assert, wd[0].balance, -300);
  assert.equal(wd[1].balance, null);
  assert.equal(wd[1].steps, 9000);
  assert.equal(wd[2].balance, null);
  assert.equal(wd[2].logged, true);
  assert.equal(wd[6].weight, 88.4);
  assert.equal(wd[0].ket, 4);
  assert.equal(wd[0].glu, 1);
  assert.equal(wd[3].ket, null);
});

test('macroSplit: udjeli masti, UH i proteina zbrajaju se na 100 % bez vlakana', () => {
  const s = macroSplit([{ fat: 100, net: 25, protein: 100 }, { fat: 0, net: 0, protein: 0 }]);
  // 900 + 100 + 400 = 1400 kcal
  near(assert, s.fat, 900 / 14);
  near(assert, s.carb, 100 / 14);
  near(assert, s.protein, 400 / 14);
  assert.equal(macroSplit([{ fat: 0, net: 0, protein: 0 }]), null);
});

test('očekivano vs stvarno: 7 dana deficita od 1100 kcal ≈ −1 kg', () => {
  const db = emptyDb();
  for (let i = 0; i < 7; i++) {
    const d = addDays(WS, i);
    db.foods.push(food(d, 1400));
    db.energy[d] = { total: 2500 };
    db.weights[d] = 90 - i * 0.1;          // prosjek tjedna 89,7
    db.weights[addDays(d, -7)] = 91;       // prosjek prošlog tjedna 91
  }
  const e = weekEnergyVsScale(db, WS);
  assert.equal(e.days, 7);
  near(assert, e.sumBal, -7700);
  near(assert, e.expected, -1);
  near(assert, e.expectedWeek, -1);
  near(assert, e.actual, 89.7 - 91, 1e-9);
  assert.equal(e.actualHow, 'prosjek tjedna u odnosu na prošli tjedan');
});

test('očekivano vs stvarno: s manje od 3 dana nema procjene za cijeli tjedan', () => {
  const db = emptyDb();
  for (const i of [0, 3]) { const d = addDays(WS, i); db.foods.push(food(d, 1500)); db.energy[d] = { total: 2600 }; }
  const e = weekEnergyVsScale(db, WS);
  assert.equal(e.days, 2);
  near(assert, e.expected, -2200 / 7700);
  assert.equal(e.expectedWeek, null);
  assert.equal(e.actual, null);
});

test('očekivano vs stvarno: 3 dana bilance preračunata na 7 dana', () => {
  const db = emptyDb();
  for (const i of [0, 1, 2]) { const d = addDays(WS, i); db.foods.push(food(d, 1500)); db.energy[d] = { total: 2600 }; }
  near(assert, weekEnergyVsScale(db, WS).expectedWeek, -1100 * 7 / 7700);
});

test('stvarna promjena bez prošlog tjedna: prvo i zadnje mjerenje ovog tjedna', () => {
  const db = emptyDb();
  db.weights = { [addDays(WS, 1)]: 90, [addDays(WS, 5)]: 89.2 };
  const e = weekEnergyVsScale(db, WS);
  near(assert, e.actual, -0.8, 1e-9);
  assert.equal(e.actualHow, 'od 6.10. do 10.10.');
});
