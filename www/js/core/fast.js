/* Intermitentni post – logika bez sučelja.
   Post prati stvarne obroke:
   faza 'fast' traje dok se ne upiše prvi obrok (ili „Jedem“) – i nakon cilja brojač ide dalje;
   faza 'eat' traje 24 − cilj sati od prvog obroka, zatim sama počinje nova faza posta od zadnjeg obroka.
   Stanje: db.fast = { goal, phase: 'fast'|'eat', phaseStart, cycle } ili null; db.fasts = završeni postovi. */
import { parseISO, uid } from './format.js';
import { kcalOf } from './nutrition.js';

export const H = 3600e3;
export const MIN_RECORDED = 10 * 60e3; // kraći postovi se ne upisuju u povijest
export const FAST_GOALS = [12, 14, 16, 18, 20, 23, 24];
export const FAST_PHASES = [
  [0, 'Probava zadnjeg obroka'],
  [4, 'Razina inzulina pada, tijelo troši zalihe glikogena'],
  [12, 'Pojačano sagorijevanje masti i stvaranje ketona'],
  [18, 'Duboka ketoza'],
  [24, 'Produženi post – pij vodu i nadoknadi elektrolite (sol, magnezij, kalij)']
];
export const goalLabel = g => g >= 24 ? `${g} h` : `${g}:${24 - g}`;
// Prozor za jelo: 24 − post (16:8 → 8 h). Post od 24 h i dulje nema prozora.
export const eatHours = g => g < 24 ? 24 - g : 0;
export const phaseText = elMs => FAST_PHASES.filter(p => elMs / H >= p[0]).at(-1)[1];
export const foodTime = f => { const d = parseISO(f.date), [Hh, M] = String(f.time || '12:00').split(':').map(Number); d.setHours(Hh || 0, M || 0, 0, 0); return d.getTime(); };
// obrok = unos s nešto kalorija (crna kava ili voda ne prekidaju post)
export const isMeal = f => kcalOf(f) >= 20;
export const lastMealBetween = (foods, a, b) => { const t = foods.filter(isMeal).map(foodTime).filter(x => x >= a && x <= b); return t.length ? Math.max(...t) : null; };

// Stari zapis {start, goal}: preračun prema fiksnom rasporedu
export function fastNormalize(db, now = Date.now()) {
  const f = db.fast;
  if (!f || f.phase) return;
  const fastMs = f.goal * H, eatMs = eatHours(f.goal) * H;
  let phase = 'fast', ps = f.start;
  if (eatMs) {
    const cyc = fastMs + eatMs, n = Math.floor((now - f.start) / cyc), cs = f.start + n * cyc;
    if (now - cs >= fastMs) { phase = 'eat'; ps = cs + fastMs; } else ps = cs;
  }
  db.fast = { goal: f.goal, phase, phaseStart: ps, cycle: 1 };
}
// Istekli prozor za jelo prelazi u novi post (od zadnjeg obroka u prozoru). Vraća true ako se stanje promijenilo.
export function advanceFast(db, now = Date.now()) {
  if (!db.fast) return false;
  fastNormalize(db, now);
  const f = db.fast, eatMs = eatHours(f.goal) * H;
  let changed = false;
  while (f.phase === 'eat' && eatMs && now >= f.phaseStart + eatMs) {
    const end = f.phaseStart + eatMs;
    const last = lastMealBetween(db.foods, f.phaseStart, end);
    f.phase = 'fast';
    f.phaseStart = last ?? end;   // post se računa od zadnjeg obroka u prozoru
    f.cycle = (f.cycle || 1) + 1;
    changed = true;
  }
  return changed;
}
// Brojke za prikaz: trajanje, cilj, napredak; `last` = zadnji obrok u prozoru za jelo
export function fastStatus(db, now = Date.now()) {
  const f = db.fast, goalMs = f.goal * H, eatMs = eatHours(f.goal) * H, ps = f.phaseStart;
  if (f.phase === 'eat') {
    const end = ps + eatMs;
    return { eating: true, done: false, ps, end, el: now - ps, pct: Math.min(1, (now - ps) / eatMs), last: lastMealBetween(db.foods, ps, now) };
  }
  const el = now - ps;
  return { eating: false, done: el >= goalMs, ps, end: ps + goalMs, el, pct: Math.min(1, el / goalMs), last: null };
}
// Zakazane obavijesti: cilj posta, kraj prozora za jelo i cilj sljedećeg posta (računa se od zadnjeg obroka u prozoru)
export function fastNotifications(db, now = Date.now()) {
  const f = db.fast;
  if (!f) return [];
  const goalMs = f.goal * H, eatMs = eatHours(f.goal) * H, list = [];
  if (f.phase === 'fast') list.push({ kind: 'goal', at: f.phaseStart + goalMs });
  else {
    const end = f.phaseStart + eatMs, last = lastMealBetween(db.foods, f.phaseStart, end);
    list.push({ kind: 'eat-end', at: end });
    list.push({ kind: 'goal', at: (last ?? end) + goalMs });
  }
  return list.filter(n => n.at > now);
}
export function startFast(db, goal, start) {
  db.fast = { goal, phase: 'fast', phaseStart: start, cycle: 1 };
}
// Trajanje posta kad bi prvi obrok bio u trenutku t
export const fastElapsedAt = (f, t) => Math.max(t, f.phaseStart) - f.phaseStart;
// Kraj faze posta u trenutku t (prvi obrok): zapis u povijest i početak prozora za jelo.
// Vraća { el, ended } (ended = post bez prozora za jelo je završen) ili null ako post nije u fazi posta.
export function startEating(db, t) {
  const f = db.fast;
  if (!f || f.phase !== 'fast') return null;
  t = Math.max(t, f.phaseStart);
  const el = t - f.phaseStart;
  if (el >= MIN_RECORDED) db.fasts.push({ id: uid(), start: f.phaseStart, end: t, goal: f.goal });
  if (!eatHours(f.goal)) { db.fast = null; return { el, ended: true, t }; }
  f.phase = 'eat'; f.phaseStart = t;
  return { el, ended: false, t };
}
// Ručni početak posta tijekom prozora za jelo – od zadnjeg obroka ako postoji
export function startFastFromWindow(db, now = Date.now()) {
  const f = db.fast;
  if (!f || f.phase !== 'eat') return null;
  const last = lastMealBetween(db.foods, f.phaseStart, now);
  f.phase = 'fast'; f.phaseStart = last ?? now; f.cycle = (f.cycle || 1) + 1;
  return { last };
}
// Završetak praćenja; post (ne prozor za jelo) dulji od 10 min upisuje se u povijest
export function endFast(db, now = Date.now()) {
  const f = db.fast;
  if (!f) return null;
  const st = fastStatus(db, now);
  if (!st.eating && st.el >= MIN_RECORDED) db.fasts.push({ id: uid(), start: f.phaseStart, end: now, goal: f.goal });
  db.fast = null;
  return st;
}
// Treba li upisani obrok završiti post (prvi obrok nakon početka posta, ne u budućnosti)
export function mealEndsFast(db, item, now = Date.now()) {
  const f = db.fast;
  if (!f || f.phase !== 'fast' || !isMeal(item)) return false;
  const t = foodTime(item);
  return t >= f.phaseStart && t <= now + 15 * 60e3;
}
