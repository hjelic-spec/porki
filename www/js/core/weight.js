// Težina: zadnje mjerenje, 7-dnevni prosjek i tempo (kg/tjedan); `weights` = { 'YYYY-MM-DD': kg }
import { addDays, daysBetween, mean, today } from './format.js';

export const weightDates = weights => Object.keys(weights).sort();
export function latestWeight(weights, upto) {
  const ds = weightDates(weights).filter(d => d <= upto);
  return ds.length ? { date: ds.at(-1), kg: weights[ds.at(-1)] } : null;
}
export function avg7(weights, date) {
  const v = [];
  for (let i = 0; i < 7; i++) { const w = weights[addDays(date, -i)]; if (w != null) v.push(w); }
  return mean(v);
}
// Linearni trend (kg/tjedan) kroz zadnjih `days` dana; treba barem 3 mjerenja kroz barem 5 dana
export function weeklyRate(weights, end = today(), days = 21) {
  const pts = weightDates(weights).filter(d => d <= end && daysBetween(d, end) < days).map(d => [daysBetween(end, d), weights[d]]);
  if (pts.length < 3 || pts[pts.length - 1][0] - pts[0][0] < 5) return null;
  const mx = mean(pts.map(p => p[0])), my = mean(pts.map(p => p[1]));
  let nu = 0, de = 0;
  for (const [x, y] of pts) { nu += (x - mx) * (y - my); de += (x - mx) ** 2; }
  return de ? nu / de * 7 : null;
}
