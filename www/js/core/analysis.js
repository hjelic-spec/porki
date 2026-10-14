// Dnevni i tjedni pregled te očekivana (iz kalorijske bilance) vs. stvarna promjena težine
import { addDays, mean, shortDate, sum } from './format.js';
import { KCAL_PER_KG, burnedOf, totals } from './nutrition.js';

export const dayFood = (db, d) => db.foods.filter(f => f.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
// Bilanca dana (unos − potrošnja) samo kad postoje i hrana i potrošnja
export function dayBalance(db, d) {
  const fl = dayFood(db, d), b = burnedOf(db.energy[d]);
  return fl.length && b != null ? totals(fl).kcal - b : null;
}
export function weekData(db, ws) {
  return [...Array(7)].map((_, i) => {
    const d = addDays(ws, i), fl = dayFood(db, d), t = totals(fl), e = db.energy[d], burned = burnedOf(e);
    const ks = db.ketones.filter(k => k.date === d);
    return {
      d, logged: fl.length > 0, ...t, burned, steps: e?.steps ?? null,
      balance: fl.length && burned != null ? t.kcal - burned : null,
      weight: db.weights[d] ?? null,
      ket: ks.length ? Math.max(...ks.map(k => k.ket)) : null,
      glu: ks.length ? Math.max(...ks.map(k => k.glu || 0)) : null
    };
  });
}
// Udio kalorija iz masti, UH i proteina (vlakna nisu ni u jednoj skupini)
export function macroSplit(days) {
  const fat = sum(days.map(x => x.fat * 9)), carb = sum(days.map(x => x.net * 4)), prot = sum(days.map(x => x.protein * 4));
  const kc = fat + carb + prot;
  return kc ? { fat: fat / kc * 100, carb: carb / kc * 100, protein: prot / kc * 100 } : null;
}
// Za tjedan: očekivana promjena (kg) iz bilance i stvarna promjena (razlika tjednih prosjeka težine)
export function weekEnergyVsScale(db, ws) {
  const wd = weekData(db, ws), prev = weekData(db, addDays(ws, -7));
  const B = wd.filter(x => x.balance != null);
  const sumBal = sum(B.map(x => x.balance));
  const expected = B.length ? sumBal / KCAL_PER_KG : null;                         // samo dani s podacima
  const expectedWeek = B.length >= 3 ? mean(B.map(x => x.balance)) * 7 / KCAL_PER_KG : null; // procjena za 7 dana
  const wNow = wd.filter(x => x.weight != null), wPrev = prev.filter(x => x.weight != null);
  let actual = null, actualHow = '';
  if (wNow.length && wPrev.length) { actual = mean(wNow.map(x => x.weight)) - mean(wPrev.map(x => x.weight)); actualHow = 'prosjek tjedna u odnosu na prošli tjedan'; }
  else if (wNow.length >= 2) { actual = wNow.at(-1).weight - wNow[0].weight; actualHow = `od ${shortDate(wNow[0].d)} do ${shortDate(wNow.at(-1).d)}`; }
  const avgBal = B.length ? sumBal / B.length : null;
  const avgW = mean([...wNow, ...wPrev].map(x => x.weight));
  return { ws, days: B.length, sumBal, avgBal, expected, expectedWeek, actual, actualHow, avgW, wd };
}
