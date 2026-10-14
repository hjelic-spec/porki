import './helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../www/js/core/format.js';
import { avg7, latestWeight, weeklyRate } from '../www/js/core/weight.js';
import { near } from './helpers.js';

const series = (from, n, start, perDay, skip = () => false) => {
  const w = {};
  for (let i = 0; i < n; i++) if (!skip(i)) w[addDays(from, i)] = start + perDay * i;
  return w;
};

test('latestWeight: zadnje mjerenje do zadanog dana', () => {
  const w = { '2026-10-01': 90, '2026-10-05': 89.5, '2026-10-09': 89 };
  assert.deepEqual(latestWeight(w, '2026-10-07'), { date: '2026-10-05', kg: 89.5 });
  assert.deepEqual(latestWeight(w, '2026-10-09'), { date: '2026-10-09', kg: 89 });
  assert.equal(latestWeight(w, '2026-09-30'), null);
  assert.equal(latestWeight({}, '2026-10-09'), null);
});

test('avg7: prosjek mjerenja u zadnjih 7 dana (uključujući taj dan)', () => {
  const w = { '2026-10-01': 100, '2026-10-02': 90, '2026-10-08': 80 };
  assert.equal(avg7(w, '2026-10-07'), 95);  // 1.–7.10.
  assert.equal(avg7(w, '2026-10-08'), 85);  // 2.–8.10.
  assert.equal(avg7(w, '2026-10-20'), null);
});

test('weeklyRate: linearni trend u kg tjedno', () => {
  const w = series('2026-10-01', 21, 95, -0.1);
  near(assert, weeklyRate(w, '2026-10-21'), -0.7, 1e-9);
  // s prazninama i šumom koji se poništava trend ostaje isti
  const noisy = series('2026-10-01', 21, 95, -0.1, i => i % 3 === 1);
  for (const [i, d] of Object.keys(noisy).entries()) noisy[d] += i % 2 ? 0.3 : -0.3;
  assert.ok(Math.abs(weeklyRate(noisy, '2026-10-21') + 0.7) < 0.15);
});

test('weeklyRate: preko prelaska na zimsko vrijeme', () => {
  near(assert, weeklyRate(series('2026-10-15', 21, 90, 0.05), '2026-11-04'), 0.35, 1e-9);
});

test('weeklyRate: gleda samo zadnjih N dana', () => {
  const w = { ...series('2026-09-01', 10, 100, 1), ...series('2026-10-01', 21, 95, -0.1) };
  near(assert, weeklyRate(w, '2026-10-21'), -0.7, 1e-9);
});

test('weeklyRate: premalo podataka', () => {
  assert.equal(weeklyRate({ '2026-10-01': 90, '2026-10-10': 89 }, '2026-10-10'), null);          // 2 mjerenja
  assert.equal(weeklyRate(series('2026-10-06', 5, 90, -0.1), '2026-10-10'), null);                // raspon 4 dana
  assert.notEqual(weeklyRate(series('2026-10-05', 6, 90, -0.1), '2026-10-10'), null);             // raspon 5 dana
  assert.equal(weeklyRate({}, '2026-10-10'), null);
});
