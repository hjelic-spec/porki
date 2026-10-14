import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  H, advanceFast, eatHours, endFast, fastNotifications, fastStatus, foodTime, goalLabel, isMeal,
  lastMealBetween, mealEndsFast, phaseText, startEating, startFast, startFastFromWindow
} from '../www/js/core/fast.js';
import { at, emptyDb, meal } from './helpers.js';

const fasting = (start, goal = 16) => { const db = emptyDb(); startFast(db, goal, at(start)); return db; };

test('prozor za jelo i oznaka cilja', () => {
  assert.equal(eatHours(16), 8);
  assert.equal(eatHours(23), 1);
  assert.equal(eatHours(24), 0);
  assert.equal(goalLabel(16), '16:8');
  assert.equal(goalLabel(24), '24 h');
});

test('faze posta po satima', () => {
  assert.equal(phaseText(0), 'Probava zadnjeg obroka');
  assert.equal(phaseText(3.99 * H), 'Probava zadnjeg obroka');
  assert.equal(phaseText(12 * H), 'Pojačano sagorijevanje masti i stvaranje ketona');
  assert.equal(phaseText(30 * H), 'Produženi post – pij vodu i nadoknadi elektrolite (sol, magnezij, kalij)');
});

test('obrok: crna kava (< 20 kcal) ne prekida post', () => {
  assert.equal(isMeal({ carbs: 0, fat: 0, protein: 0.3 }), false);
  assert.equal(isMeal({ carbs: 5, fat: 0, protein: 0 }), true); // točno 20 kcal
  assert.equal(foodTime(meal('2026-10-14', '08:30')), at('2026-10-14 08:30'));
  assert.equal(foodTime({ date: '2026-10-14' }), at('2026-10-14 12:00'));
});

test('lastMealBetween: zadnji obrok u rasponu, bez napitaka', () => {
  const foods = [meal('2026-10-14', '08:00'), meal('2026-10-14', '13:00'), { ...meal('2026-10-14', '15:00'), fat: 0, carbs: 0, protein: 1 }, meal('2026-10-14', '21:00')];
  assert.equal(lastMealBetween(foods, at('2026-10-14 07:00'), at('2026-10-14 20:00')), at('2026-10-14 13:00'));
  assert.equal(lastMealBetween(foods, at('2026-10-14 13:00'), at('2026-10-14 13:00')), at('2026-10-14 13:00'));
  assert.equal(lastMealBetween(foods, at('2026-10-14 14:00'), at('2026-10-14 20:00')), null);
});

test('post: brojač ide dalje i nakon cilja dok nema obroka', () => {
  const db = fasting('2026-10-13 20:00');
  let st = fastStatus(db, at('2026-10-14 08:00'));
  assert.equal(st.done, false);
  assert.equal(st.el, 12 * H);
  assert.equal(st.pct, 0.75);
  assert.equal(st.end, at('2026-10-14 12:00'));
  st = fastStatus(db, at('2026-10-14 14:00'));
  assert.equal(st.done, true);
  assert.equal(st.el, 18 * H);
  assert.equal(st.pct, 1);
  assert.equal(advanceFast(db, at('2026-10-15 14:00')), false); // post se sam ne završava
  assert.equal(db.fast.phase, 'fast');
});

test('prvi obrok završava post, upisuje ga u povijest i otvara prozor za jelo', () => {
  const db = fasting('2026-10-13 20:00');
  const r = startEating(db, at('2026-10-14 12:30'));
  assert.deepEqual({ el: r.el, ended: r.ended }, { el: 16.5 * H, ended: false });
  assert.equal(db.fast.phase, 'eat');
  assert.equal(db.fast.phaseStart, at('2026-10-14 12:30'));
  assert.equal(db.fasts.length, 1);
  assert.equal(db.fasts[0].start, at('2026-10-13 20:00'));
  assert.equal(db.fasts[0].end, at('2026-10-14 12:30'));
  const st = fastStatus(db, at('2026-10-14 16:30'));
  assert.equal(st.eating, true);
  assert.equal(st.end, at('2026-10-14 20:30'));
  assert.equal(st.pct, 0.5);
  assert.equal(startEating(db, at('2026-10-14 13:00')), null); // već je u prozoru za jelo
});

test('obrok upisan s vremenom prije početka posta računa se od početka', () => {
  const db = fasting('2026-10-14 10:00');
  const r = startEating(db, at('2026-10-14 09:00'));
  assert.equal(r.el, 0);
  assert.equal(db.fasts.length, 0); // kraće od 10 min se ne upisuje
  assert.equal(db.fast.phaseStart, at('2026-10-14 10:00'));
});

test('post od 24 h nema prozora za jelo – obrok ga završava', () => {
  const db = fasting('2026-10-13 18:00', 24);
  const r = startEating(db, at('2026-10-14 19:00'));
  assert.equal(r.ended, true);
  assert.equal(db.fast, null);
  assert.equal(db.fasts[0].end - db.fasts[0].start, 25 * H);
});

test('istekli prozor za jelo: novi post od zadnjeg obroka u prozoru', () => {
  const db = fasting('2026-10-13 20:00');
  startEating(db, at('2026-10-14 12:00'));
  db.foods = [meal('2026-10-14', '12:00'), meal('2026-10-14', '18:30'), meal('2026-10-14', '21:00')]; // 21:00 je izvan prozora
  assert.equal(advanceFast(db, at('2026-10-14 19:59')), false);
  assert.equal(advanceFast(db, at('2026-10-14 20:00')), true);
  assert.deepEqual({ phase: db.fast.phase, start: db.fast.phaseStart, cycle: db.fast.cycle }, { phase: 'fast', start: at('2026-10-14 18:30'), cycle: 2 });
});

test('istekli prozor bez upisanog obroka: post počinje na kraju prozora', () => {
  const db = fasting('2026-10-13 20:00');
  startEating(db, at('2026-10-14 12:00')); // „Jedem sada“ bez upisa hrane
  advanceFast(db, at('2026-10-15 09:00'));
  assert.equal(db.fast.phase, 'fast');
  assert.equal(db.fast.phaseStart, at('2026-10-14 20:00'));
});

test('stari zapis {start, goal} preračunava se po fiksnom rasporedu', () => {
  const db = emptyDb();
  db.fast = { start: at('2026-10-13 20:00'), goal: 16 };
  advanceFast(db, at('2026-10-14 13:00'));
  assert.deepEqual(db.fast, { goal: 16, phase: 'eat', phaseStart: at('2026-10-14 12:00'), cycle: 1 });
  db.fast = { start: at('2026-10-13 20:00'), goal: 16 };
  advanceFast(db, at('2026-10-14 21:00')); // drugi ciklus: post od 20:00
  assert.deepEqual(db.fast, { goal: 16, phase: 'fast', phaseStart: at('2026-10-14 20:00'), cycle: 1 });
});

test('trajanje posta u stvarnim satima i preko prelaska na zimsko vrijeme', () => {
  const db = fasting('2026-10-24 20:00'); // 25.10. sat se vraća s 3:00 na 2:00
  assert.equal(fastStatus(db, at('2026-10-25 11:00')).el, 16 * H);
  assert.equal(fastStatus(db, at('2026-10-25 11:00')).done, true);
});

test('ručni početak posta u prozoru za jelo: od zadnjeg obroka ili od sada', () => {
  const db = fasting('2026-10-13 20:00');
  startEating(db, at('2026-10-14 12:00'));
  db.foods = [meal('2026-10-14', '12:00'), meal('2026-10-14', '15:00')];
  assert.deepEqual(startFastFromWindow(db, at('2026-10-14 17:00')), { last: at('2026-10-14 15:00') });
  assert.equal(db.fast.phaseStart, at('2026-10-14 15:00'));
  assert.equal(db.fast.cycle, 2);
  const db2 = fasting('2026-10-13 20:00');
  startEating(db2, at('2026-10-14 12:00'));
  startFastFromWindow(db2, at('2026-10-14 17:00'));
  assert.equal(db2.fast.phaseStart, at('2026-10-14 17:00'));
});

test('završetak: upisuje se samo faza posta dulja od 10 min', () => {
  let db = fasting('2026-10-14 08:00');
  endFast(db, at('2026-10-14 08:05'));
  assert.equal(db.fast, null);
  assert.equal(db.fasts.length, 0);
  db = fasting('2026-10-14 08:00');
  endFast(db, at('2026-10-14 10:00'));
  assert.equal(db.fasts.length, 1);
  db = fasting('2026-10-13 20:00');
  startEating(db, at('2026-10-14 12:00'));
  endFast(db, at('2026-10-14 14:00')); // u prozoru za jelo
  assert.equal(db.fasts.length, 1);    // samo post od 13. do 14., prozor se ne upisuje
});

test('koji upisani obrok završava post', () => {
  const db = fasting('2026-10-14 08:00');
  const now = at('2026-10-14 12:00');
  assert.equal(mealEndsFast(db, meal('2026-10-14', '11:30'), now), true);
  assert.equal(mealEndsFast(db, meal('2026-10-14', '12:10'), now), true);  // do 15 min unaprijed
  assert.equal(mealEndsFast(db, meal('2026-10-14', '13:00'), now), false); // obrok u budućnosti
  assert.equal(mealEndsFast(db, meal('2026-10-14', '07:30'), now), false); // prije početka posta
  assert.equal(mealEndsFast(db, { ...meal('2026-10-14', '11:00'), fat: 0, carbs: 0, protein: 2 }, now), false); // kava
  startEating(db, at('2026-10-14 11:30'));
  assert.equal(mealEndsFast(db, meal('2026-10-14', '11:45'), now), false); // već je u prozoru za jelo
});

test('obavijesti u fazi posta: samo cilj', () => {
  const db = fasting('2026-10-13 20:00');
  assert.deepEqual(fastNotifications(db, at('2026-10-14 08:00')), [{ kind: 'goal', at: at('2026-10-14 12:00') }]);
  assert.deepEqual(fastNotifications(db, at('2026-10-14 13:00')), []); // cilj je prošao
});

test('obavijesti u prozoru za jelo: cilj sljedećeg posta računa se od zadnjeg obroka', () => {
  const db = fasting('2026-10-13 20:00');
  startEating(db, at('2026-10-14 12:00'));
  db.foods = [meal('2026-10-14', '12:00')];
  // samo jedan obrok u 12:00 → novi post od 12:00, cilj 15.10. u 4:00 (a ne 16 h nakon kraja prozora)
  assert.deepEqual(fastNotifications(db, at('2026-10-14 13:00')), [
    { kind: 'eat-end', at: at('2026-10-14 20:00') },
    { kind: 'goal', at: at('2026-10-15 04:00') }
  ]);
  db.foods.push(meal('2026-10-14', '19:00'));
  assert.equal(fastNotifications(db, at('2026-10-14 19:05'))[1].at, at('2026-10-15 11:00'));
  db.foods = [];
  assert.equal(fastNotifications(db, at('2026-10-14 13:00'))[1].at, at('2026-10-15 12:00')); // bez obroka: od kraja prozora
});
