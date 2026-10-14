// Ulazna točka: radnje (data-action), događaji i pokretanje
import { addDays, fmt, norm, num, r1, sgn, shortDate, today, uid } from './core/format.js';
import { exportData, importData } from './backup.js';
import { fillEmptyEnergy, openEnergy, openEnergyBulk, openKetone } from './dialogs/entries.js';
import { openFavs, openFood, saveFavorite, toggleFavorite } from './dialogs/food.js';
import { openScanner } from './dialogs/scanner.js';
import { dbItem, offSearch, openFoodSearch } from './dialogs/search.js';
import { openGoals, openSettings } from './dialogs/settings.js';
import { applyHealth, HB, hc, hcRequest, hcSync } from './native/health.js';
import { nativeRestore, nativeSave, widgetAction, widgetSync } from './native/widget.js';
import { openReports, previewReport, readReportForm, scheduleReportNotif, sendReport } from './reports.js';
import { db, emptyDb, latestWeight, recipeMacros, save, setDb } from './store.js';
import { closeDialog, dlg } from './ui/dialog.js';
import { $, NATIVE, pwa, state, toast } from './ui/dom.js';
import { render } from './ui/render.js';
import { cancelFast, endFast, openFastEdit, startEating, startFast, startFastNow } from './views/fast.js';
import { openRecipe } from './views/recipes.js';

const actions = {
  close: closeDialog,
  settings: openSettings,
  'prev-day': () => { state.date = addDays(state.date, -1); render(); },
  'next-day': () => { if (state.date < today()) { state.date = addDays(state.date, 1); render(); } },
  'pick-day': () => {
    const p = $('#datePicker'); p.max = today(); p.value = state.date;
    if (p.showPicker) { try { p.showPicker(); return; } catch { /* fallback */ } }
    p.click();
  },
  'prev-week': () => { state.week = addDays(state.week, -7); render(); },
  'next-week': () => { state.week = addDays(state.week, 7); render(); },
  'add-food': openFoodSearch,
  'food-manual': () => openFood({ name: (dlg.querySelector('[name=q]') || {}).value || '' }),
  scan: openScanner,
  'off-search': offSearch,
  pick: el => { const i = +el.dataset.i, src = el.dataset.src; const it = src === 'd' ? (FOOD_DB[i] && dbItem(FOOD_DB[i])) : (src === 'o' ? state.offres : state.sres)[i]; if (it) openFood({ ...it, fav: false, time: undefined }); },
  'fast-goal': el => { db.settings.fastGoal = +el.dataset.v; save(); render(); },
  'fast-start': el => startFast(el.dataset.from),
  'fast-end': endFast,
  'fast-eat': () => startEating(Date.now(), true),
  'fast-now': startFastNow,
  'fast-edit': openFastEdit,
  'fast-cancel': cancelFast,
  'del-fast': el => { if (confirm('Obrisati ovaj post?')) { db.fasts = db.fasts.filter(f => f.id !== el.dataset.id); save(); render(); } },
  'edit-food': el => { const f = db.foods.find(x => x.id === el.dataset.id); if (f) openFood(f.src ? { ...f, ...f.src, per100: true } : f, f.id); },
  'del-food': el => { db.foods = db.foods.filter(f => f.id !== el.dataset.id); save(); closeDialog(); render(); toast('Obrisano'); },
  quick: el => { const q = state.quick[+el.dataset.i]; if (q) openFood({ ...q, fav: false, time: undefined }); },
  'fav-toggle': el => {
    const f = db.foods.find(x => x.id === el.dataset.id); if (!f) return;
    const k = f.name.toLowerCase();
    if (db.favorites.some(x => x.name.toLowerCase() === k)) { db.favorites = db.favorites.filter(x => x.name.toLowerCase() !== k); toast('Uklonjeno iz favorita'); }
    else { saveFavorite(f); toast('Dodano u favorite'); }
    save(); render();
  },
  'edit-favs': openFavs,
  'food-showall': () => { state.foodShowAll = !state.foodShowAll; if (state.foodSearchUpd) state.foodSearchUpd(); },
  reports: () => { if (dlg.open) closeDialog(); openReports(); },
  'report-send': () => { readReportForm(); sendReport(); },
  'report-preview': () => { readReportForm(); scheduleReportNotif(); previewReport(); },
  goals: () => { if (dlg.open) closeDialog(); openGoals(); },
  'r-filter': el => { state.rFilter = el.dataset.v; render(); },
  'r-cat': el => { state.rCat = el.dataset.v; render(); },
  recipe: el => openRecipe(el.dataset.id),
  'recipe-fav': el => {
    const r = RECIPES.find(x => x.id === el.dataset.id); if (!r) return;
    const m = recipeMacros(r);
    const on = toggleFavorite({ name: r.name, per100: false, grams: m.grams, carbs: m.carbs, fiber: m.fiber, fat: m.fat, protein: m.protein, inc: false });
    el.textContent = on ? '★ U favoritima' : '☆ U favorite';
    toast(on ? 'Recept dodan u favorite (1 porcija)' : 'Uklonjeno iz favorita');
  },
  'fav-new': () => openFood({ per100: true }),
  'fav-item': el => {
    const i = +el.dataset.i, src = el.dataset.src;
    const it = src === 'd' ? (FOOD_DB[i] && dbItem(FOOD_DB[i])) : (src === 'o' ? state.offres : state.sres)[i];
    if (!it) return;
    const on = toggleFavorite(it);
    el.classList.toggle('on', on);
    toast(on ? `★ ${it.name} dodano u favorite` : 'Uklonjeno iz favorita');
  },
  'food-store': () => {
    // spremi namirnicu u vlastitu bazu (skenirano / ručno) bez unosa u obrok
    const fd = Object.fromEntries(new FormData(dlg.querySelector('form')));
    const name = (fd.name || '').trim();
    if (!name) { toast('Upiši naziv'); return; }
    const vals = { carbs: num(fd.carbs) || 0, fiber: num(fd.fiber) || 0, fat: num(fd.fat) || 0, protein: num(fd.protein) || 0 };
    const g = num(fd.grams), isPer = !!fd.per100;
    let entry;
    if (isPer) entry = { name, ...vals, grams: g || 100, per100: true };
    else if (g) { const k = 100 / g; entry = { name, carbs: r1(vals.carbs * k), fiber: r1(vals.fiber * k), fat: r1(vals.fat * k), protein: r1(vals.protein * k), grams: g, per100: true }; }
    else entry = { name, ...vals, grams: null, per100: false };
    entry.inc = !!db.settings.carbsIncludeFiber;
    const key = fd.code || Object.keys(db.products).find(k => norm(db.products[k].name) === norm(name)) || 'moj-' + uid();
    db.products[key] = entry;
    save(); closeDialog(); render();
    toast(`▥ ${name} spremljeno u tvoje namirnice`);
  },
  'fav-only': () => {
    const fd = Object.fromEntries(new FormData(dlg.querySelector('form')));
    const name = (fd.name || '').trim();
    if (!name) { toast('Upiši naziv'); return; }
    const it = { name, per100: !!fd.per100, grams: num(fd.grams), carbs: num(fd.carbs) || 0, fiber: num(fd.fiber) || 0, fat: num(fd.fat) || 0, protein: num(fd.protein) || 0 };
    db.favorites = db.favorites.filter(f => f.name.toLowerCase() !== name.toLowerCase());
    toggleFavorite(it);
    closeDialog(); render();
    toast(`★ ${name} spremljeno u favorite`);
  },
  'del-fav': el => { db.favorites = db.favorites.filter(f => f.id !== el.dataset.id); save(); el.closest('li').remove(); render(); },
  'add-ketone': openKetone,
  'del-ketone': el => { if (confirm('Obrisati mjerenje?')) { db.ketones = db.ketones.filter(k => k.id !== el.dataset.id); save(); render(); } },
  'del-weight': el => { if (confirm(`Obrisati mjerenje za ${shortDate(el.dataset.d)}?`)) { delete db.weights[el.dataset.d]; save(); render(); } },
  wrange: el => { state.wRange = +el.dataset.v; render(); },
  'energy-edit': openEnergy,
  'energy-bulk': el => openEnergyBulk(+el.dataset.days || 30),
  'energy-fill': fillEmptyEnergy,
  'del-energy': () => { delete db.energy[state.date]; save(); closeDialog(); render(); },
  'hc-sync': () => hcSync(true, 30),
  'hc-perm': async () => { if (dlg.open) closeDialog(); await hcRequest(); await hcSync(); },
  'hc-open': () => HB && HB.openHealthConnect().catch(e => toast(e.message)),
  install: async () => { const e = pwa.installEvt; if (!e) return; e.prompt(); await e.userChoice.catch(() => {}); pwa.installEvt = null; render(); },
  'hide-install': () => { db.settings.hideInstall = true; save(); render(); },
  export: exportData,
  import: importData,
  wipe: () => {
    if (confirm('Trajno obrisati SVE podatke s ovog uređaja?') && confirm('Sigurno? Ovo se ne može poništiti.')) {
      setDb(emptyDb(), false); save(); closeDialog(); render(); toast('Podaci obrisani');
    }
  }
};
document.addEventListener('click', ev => {
  const tabBtn = ev.target.closest('.nav button[data-tab]');
  if (tabBtn) { state.tab = tabBtn.dataset.tab; render(); scrollTo(0, 0); return; }
  const el = ev.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) { ev.preventDefault(); actions[el.dataset.action](el, ev); }
});
document.addEventListener('submit', ev => {
  const f = ev.target;
  if (f.dataset.form === 'weight' || f.dataset.form === 'weight-any') {
    ev.preventDefault();
    const date = f.date ? f.date.value || state.date : state.date;
    const raw = f.kg.value.trim();
    if (!raw && f.dataset.form === 'weight') {
      if (db.weights[date] != null && confirm('Obrisati težinu za ovaj dan?')) { delete db.weights[date]; save(); render(); }
      return;
    }
    const kg = num(raw);
    if (kg == null || kg < 20 || kg > 400) { toast('Unesi težinu u kg, npr. 85,4'); return; }
    db.weights[date] = r1(kg); save();
    const prev = latestWeight(addDays(date, -1));
    toast(`Spremljeno ${fmt(kg, 1)} kg${prev ? ` (${sgn(kg - prev.kg)})` : ''}`);
    render();
  }
});
$('#datePicker').addEventListener('change', ev => {
  if (ev.target.value) { state.date = ev.target.value > today() ? today() : ev.target.value; render(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') { if (NATIVE) nativeSave(true); return; }
  // novi dan dok je aplikacija bila otvorena
  if (state.lastSeen && state.lastSeen !== today() && state.date === state.lastSeen) state.date = today();
  state.lastSeen = today();
  if (!dlg.open) render();
  if (NATIVE && Date.now() - hc.lastSync > 60e3) hcSync();
  if (NATIVE) { widgetAction(); widgetSync(); }
});
addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); pwa.installEvt = ev; render(); });
state.lastSeen = today();

/* ================= Pokretanje ================= */
(async function init() {
  if (NATIVE) await nativeRestore();
  const qs = location.search;
  if (qs && /(total|active|basal|steps|weight)=/.test(qs)) {
    applyHealth(qs);
    history.replaceState(null, '', location.pathname);
  }
  render();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (NATIVE) { hcSync(); widgetSync(); widgetAction(); if (db.settings.reportDay) scheduleReportNotif(); }
  else if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
