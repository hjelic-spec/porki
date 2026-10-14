// Android widget i trajna kopija podataka u datoteci aplikacije
import { addDays, hmTxt, r1, shortDate, sum, today } from '../core/format.js';
import { KET } from '../core/ketones.js';
import { burnedOf, totals } from '../core/nutrition.js';
import { openWeightQuick } from '../dialogs/entries.js';
import { openFoodSearch } from '../dialogs/search.js';
import { dayFood, db, lastMealBetween, latestWeight, save, setDb, weeklyRate, weightDates, withDefaults } from '../store.js';
import { closeDialog, dlg } from '../ui/dialog.js';
import { plugin, state, toast } from '../ui/dom.js';
import { render } from '../ui/render.js';
import { endFast, scheduleFastNotif, startEating, startFast } from '../views/fast.js';

export const WB = plugin('WidgetBridge');
if (WB) WB.addListener('widgetAction', () => widgetAction()).catch?.(() => {});
if (WB) WB.addListener('backupShared', () => { db.settings.lastBackup = today(); save(); if (!dlg.open) render(); toast('Kopija je spremljena'); }).catch?.(() => {});
let widgetTimer = 0, widgetReady = false, nativeTimer = 0;
// Android: trajna kopija u datoteci aplikacije (WebView localStorage na disk zapisuje s odgodom)
export function nativeSave(now = false) {
  if (!WB) return;
  clearTimeout(nativeTimer);
  const write = () => WB.saveData({ json: JSON.stringify(db) }).catch(e => console.error(e));
  if (now) write(); else nativeTimer = setTimeout(write, 250);
}
export async function nativeRestore() {
  if (!WB) return;
  try {
    const r = await WB.loadData();
    const d = r && r.json ? JSON.parse(r.json) : null;
    if (d && (d.savedAt || 0) > (db.savedAt || 0)) setDb(withDefaults(d));
    else if (!d) nativeSave(true);
  } catch (e) { console.error(e); }
}
export function widgetSync() {
  if (!WB || !widgetReady) return; // najprije preuzmi radnje s widgeta (npr. post pokrenut na widgetu)
  clearTimeout(widgetTimer);
  widgetTimer = setTimeout(() => {
    const lw = latestWeight(today()), rate = weeklyRate();
    // promjena u odnosu na prethodno mjerenje
    const ds = weightDates().filter(d => d <= today()), last = ds.at(-1), prevD = ds.at(-2);
    const diff = last && prevD ? r1(db.weights[last] - db.weights[prevD]) : null;
    // kalorijska bilanca: danas i zadnjih 7 dana (samo dani s unosom hrane i poznatom potrošnjom)
    const balOf = d => { const fl = dayFood(d), b = burnedOf(db.energy[d]); return fl.length && b != null ? totals(fl).kcal - b : null; };
    const balToday = balOf(today());
    const week = [...Array(7)].map((_, i) => balOf(addDays(today(), -i))).filter(v => v != null);
    const lk = [...db.ketones].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0];
    const tt = totals(dayFood(today()));
    WB.update({
      ...(diff != null ? { weightDiff: diff, weightDiffRef: last === today() && prevD === addDays(last, -1) ? 'jučer' : shortDate(prevD) } : {}),
      ...(balToday != null ? { balToday: Math.round(balToday) } : {}),
      ...(week.length ? { balWeek: Math.round(sum(week)), balWeekDays: week.length } : {}),
      balDate: today(),
      protein: Math.round(tt.protein),
      proteinTarget: db.settings.proteinTarget || 0,
      ...(lk ? { ketText: KET[lk.ket].l, ketColor: KET[lk.ket].c, ketDate: lk.date, ketTime: lk.time || '', gluWarn: lk.glu > 0 } : {}),
      fastStart: db.fast ? db.fast.phaseStart : 0,
      fastPhase: db.fast ? db.fast.phase : 'fast',
      lastMeal: db.fast && db.fast.phase === 'eat' ? (lastMealBetween(db.fast.phaseStart, Date.now()) || 0) : 0,
      fastGoal: db.fast ? db.fast.goal : db.settings.fastGoal,
      appNotify: !!db.fast,
      weight: lw ? lw.kg : 0,
      weightDate: lw ? lw.date : '',
      ...(rate != null ? { rate: Math.round(rate * 100) / 100 } : {}),
      carbs: Math.round(totals(dayFood(today())).net * 10) / 10,
      carbLimit: db.settings.carbLimit,
      carbDate: today()
    }).catch(e => console.error(e));
  }, 300);
}
export async function widgetAction() {
  if (!WB) return;
  let r = {};
  try { r = (await WB.consumeAction()) || {}; } catch { /* nema radnje */ }
  if (r.fastStart && !db.fast) {
    // obavijest o cilju šalje widget, pa je aplikacija ne zakazuje ponovno
    db.fast = { goal: db.settings.fastGoal, phase: 'fast', phaseStart: r.fastStart, cycle: 1 };
    scheduleFastNotif();
    save();
    toast(`Post je pokrenut na widgetu u ${hmTxt(r.fastStart)}`);
    if (!dlg.open) render();
  }
  widgetReady = true;
  widgetSync();
  if (!r.action) return;
  if (dlg.open) closeDialog();
  state.date = today();
  if (r.action === 'food') { state.tab = 'food'; render(); openFoodSearch(); }
  else if (r.action === 'weight') { state.tab = 'today'; render(); openWeightQuick(); }
  else if (r.action === 'today') { state.tab = 'today'; render(); scrollTo(0, 0); }
  else if (r.action === 'ketones') { state.tab = 'ketones'; render(); scrollTo(0, 0); }
  else if (r.action === 'fast_eat') { state.tab = 'today'; render(); scrollTo(0, 0); if (db.fast) setTimeout(() => startEating(Date.now(), true), 350); }
  else if (r.action === 'fast_end') { state.tab = 'today'; render(); scrollTo(0, 0); if (db.fast) setTimeout(endFast, 350); }
  else if (r.action === 'fast') {
    state.tab = 'today'; render(); scrollTo(0, 0);
    if (!db.fast) setTimeout(() => { if (!db.fast && confirm(`Započeti post sada (cilj ${db.settings.fastGoal} h)?`)) startFast('now'); }, 350);
  }
}
