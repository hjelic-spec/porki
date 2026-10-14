import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, cleanNum, daysBetween, fmt, h, num, postova, sgn, tjedan, weekStart, durTxt, norm } from '../www/js/core/format.js';

test('addDays i daysBetween preko prelaska na ljetno i zimsko vrijeme', () => {
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30'); // dan od 23 h
  assert.equal(addDays('2026-10-25', 1), '2026-10-26'); // dan od 25 h
  assert.equal(addDays('2026-10-26', -1), '2026-10-25');
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-10-24', '2026-10-27'), 3);
});

test('addDays preko kraja mjeseca, godine i prijestupnog dana', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-12-25', '2027-01-04'), 10);
});

test('weekStart vraća ponedjeljak', () => {
  assert.equal(weekStart('2026-10-12'), '2026-10-12'); // ponedjeljak
  assert.equal(weekStart('2026-10-14'), '2026-10-12'); // srijeda
  assert.equal(weekStart('2026-10-18'), '2026-10-12'); // nedjelja
  assert.equal(weekStart('2027-01-01'), '2026-12-28'); // preko godine
});

test('num čita decimalni zarez i točku', () => {
  assert.equal(num('85,4'), 85.4);
  assert.equal(num('85.4'), 85.4);
  assert.equal(num(''), null);
  assert.equal(num(null), null);
  assert.equal(num('abc'), null);
  assert.equal(num(0), 0);
});

test('cleanNum razlikuje tisućice i decimale', () => {
  assert.equal(cleanNum('2.300', true), 2300);
  assert.equal(cleanNum('2,300', true), 2300);
  assert.equal(cleanNum('2.300'), 2.3);
  assert.equal(cleanNum('2.300,5'), 2300.5);
  assert.equal(cleanNum('1,234.5'), 1234.5);
  assert.equal(cleanNum('84,2'), 84.2);
  assert.equal(cleanNum('2 450 kcal', true), 2450);
  assert.equal(cleanNum('-'), null);
  assert.equal(cleanNum(''), null);
  assert.equal(cleanNum(undefined), null);
});

test('fmt i sgn koriste hrvatski zapis', () => {
  assert.equal(fmt(1234.5, 1), '1.234,5');
  assert.equal(fmt(null), '–');
  assert.equal(fmt(NaN), '–');
  assert.equal(sgn(0.25, 2), '+0,25');
  assert.equal(sgn(-0.5), '−0,5');
  assert.equal(sgn(0), '±0,0');
  assert.equal(sgn(null), '–');
});

test('padeži: tjedan i post', () => {
  const t = [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(tjedan);
  assert.deepEqual(t, ['tjedan', 'tjedna', 'tjedna', 'tjedana', 'tjedana', 'tjedana', 'tjedana', 'tjedan', 'tjedna', 'tjedana', 'tjedan', 'tjedana']);
  assert.deepEqual([1, 3, 7, 13, 21].map(postova), ['post', 'posta', 'postova', 'postova', 'post']);
});

test('durTxt, h i norm', () => {
  assert.equal(durTxt(16 * 3600e3 + 5 * 60e3 + 59e3), '16 h 05 min');
  assert.equal(durTxt(-5000), '0 h 00 min');
  assert.equal(h(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(h(null), '');
  assert.equal(norm('Čokolada, Đumbir'), 'cokolada, dumbir');
});
