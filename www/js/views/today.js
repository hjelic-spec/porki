// Kartica Danas: težina, makronutrijenti, potrošnja energije i ketoni
import { addDays, daysBetween, fmt, h, sgn, shortDate, today } from '../core/format.js';
import { GLU, KET, ketText } from '../core/ketones.js';
import { burnedOf, totals } from '../core/nutrition.js';
import { hc } from '../native/health.js';
import { avg7, dayFood, db, latestWeight, lowCarb, weightDates } from '../store.js';
import { donut, pbar } from '../ui/charts.js';
import { NATIVE, pwa, state } from '../ui/dom.js';
import { fastCard } from './fast.js';
import { t } from '../i18n/index.js';

export function viewToday() {
  const d = state.date, s = db.settings;
  const tot = totals(dayFood(d));
  const w = db.weights[d];
  const prev = latestWeight(addDays(d, -1));
  const a7 = avg7(d), a7prev = avg7(addDays(d, -7));
  const e = db.energy[d], burned = burnedOf(e);
  const kets = db.ketones.filter(k => k.date === d).sort((a, b) => a.time.localeCompare(b.time));
  const lastK = kets.at(-1);
  let out = banners();
  if (d === today()) out += fastCard();

  // Težina
  const diff = w != null && prev ? w - prev.kg : null;
  out += `<section class="card">
    <div class="card-h"><h2>${t('today.weight')}</h2><span class="muted">${a7 != null ? t('today.avg7', { kg: fmt(a7, 1) }) + (a7prev != null ? ` (${sgn(a7 - a7prev)} ${t('today.kgWeek')})` : '') : t('today.weighHint')}</span></div>
    <form class="row" data-form="weight">
      <input name="kg" inputmode="decimal" autocomplete="off" placeholder="${prev ? fmt(prev.kg, 1) : t('weight.placeholder')}" value="${w != null ? fmt(w, 1) : ''}" aria-label="${t('weight.aria')}">
      <span class="muted">kg</span>
      <button class="btn primary">${w != null ? t('btn.update') : t('btn.save')}</button>
    </form>
    ${diff != null ? `<p class="muted small" style="margin:8px 0 0">${t('today.diff', { diff: sgn(diff), date: shortDate(prev.date) })}</p>` : ''}
  </section>`;

  // Makronutrijenti
  const kc = { c: tot.net * 4, f: tot.fat * 9, p: tot.protein * 4 };
  const kTot = kc.c + kc.f + kc.p;
  const pct = v => kTot ? Math.round(v / kTot * 100) : 0;
  const carbLeft = s.carbLimit - tot.net;
  out += `<section class="card">
    <div class="card-h"><h2>${t('today.macros')}</h2><span class="muted">${t('n.entries', { n: tot.n })}</span></div>
    <div class="carb-hero">
      ${donut(Object.assign([{ v: kc.c, color: 'var(--c-carb)' }, { v: kc.f, color: 'var(--c-fat)' }, { v: kc.p, color: 'var(--c-prot)' }], { center: `<text x="50" y="49" text-anchor="middle" style="fill:var(--ink);font-size:17px;font-weight:700">${fmt(tot.kcal)}</text><text x="50" y="63" text-anchor="middle" style="fill:var(--muted);font-size:9px">kcal</text>` }))}
      <div style="flex:1;min-width:0">
        <div class="muted small">${t('today.netCarbs')}</div>
        <div class="big ${carbLeft < 0 ? 'bad' : ''}">${fmt(tot.net, tot.net < 10 ? 1 : 0)}<span class="unit"> / ${s.carbLimit} g</span></div>
        <div class="muted small">${carbLeft >= 0 ? t('today.carbLeft', { g: fmt(carbLeft, 1) }) : `<span class="bad">${t('today.carbOver', { g: fmt(-carbLeft, 1) })}</span>`}</div>
        <div class="legend" style="margin-top:6px"><span><i style="background:var(--c-carb)"></i>${t('abbr.carbs')} ${pct(kc.c)}%</span><span><i style="background:var(--c-fat)"></i>${t('abbr.fat')} ${pct(kc.f)}%</span><span><i style="background:var(--c-prot)"></i>${t('abbr.protein')} ${pct(kc.p)}%</span></div>
      </div>
    </div>
    <div style="margin-top:12px">
      ${pbar(t('macro.netCarbs'), tot.net, s.carbLimit, 'var(--c-carb)', lowCarb())}
      ${pbar(t('macro.protein'), tot.protein, s.proteinTarget, 'var(--c-prot)')}
      ${pbar(t('macro.fat'), tot.fat, s.fatTarget, 'var(--c-fat)')}
    </div>
    <div class="btns" style="margin-top:12px"><button class="btn primary" style="flex:1" data-action="add-food">${t('food.addBtn')}</button><button class="btn" data-action="scan">${t('food.scan')}</button></div>
  </section>`;

  // Energija
  const bal = burned != null && tot.n ? tot.kcal - burned : null;
  const parts = [];
  if (e?.active != null) parts.push(t('energy.active', { kcal: fmt(e.active) }));
  if (e?.basal != null) parts.push(t('energy.resting', { kcal: fmt(e.basal) }));
  if (e?.steps != null) parts.push(t('energy.steps', { steps: fmt(e.steps) }));
  if (d === today()) parts.push(t('energy.dayOngoing'));
  out += `<section class="card">
    <div class="card-h"><h2>${t('energy.title')}</h2><span class="muted">${e?.src === 'health' ? 'Health Connect' : e ? t('energy.manual') : ''}</span></div>
    ${burned != null || e?.steps != null ? `
      <div class="tiles">
        <div class="tile"><b>${fmt(burned)}</b><span>${t('energy.burnedKcal')}</span></div>
        <div class="tile"><b>${fmt(tot.kcal)}</b><span>${t('energy.eatenKcal')}</span></div>
        <div class="tile"><b class="${bal == null ? '' : bal <= 0 ? 'good' : 'bad'}">${bal == null ? '–' : sgn(bal, 0)}</b><span>${bal == null ? t('energy.balance') : bal <= 0 ? t('energy.deficit') : t('energy.surplus')}</span></div>
      </div>
      <p class="muted small" style="margin:8px 0 0">${parts.join(' · ')}</p>`
    : `<p class="muted" style="margin:0">${NATIVE ? t('energy.noDataNative') : t('energy.noDataWeb')}</p>`}
    <div class="btns" style="margin-top:12px">${healthButtons()}<button class="btn" data-action="energy-edit">${t('energy.manualBtn')}</button><button class="btn" data-action="energy-bulk">${t('energy.bulkBtn')}</button></div>
  </section>`;

  // Ketoni
  out += `<section class="card">
    <div class="card-h"><h2>Keto-Diastix</h2><span class="muted">${kets.length ? t('n.measurements', { n: kets.length }) : ''}</span></div>
    ${lastK ? `<div class="row"><span class="dot" style="width:34px;height:34px;border-radius:8px;background:${KET[lastK.ket].c}"></span>
      <div class="grow"><b>${KET[lastK.ket].l}</b> <span class="muted">(${KET[lastK.ket].mmol} mmol/L) ${t('today.ketAt', { time: h(lastK.time) })}</span><div class="muted small">${ketText(lastK.ket)}${lastK.glu > 0 ? ` · <span class="bad">${t('today.glucose', { v: GLU[lastK.glu].l })}</span>` : ''}</div></div></div>`
    : `<p class="muted" style="margin:0">${t('ket.noneToday')}</p>`}
    <div class="btns" style="margin-top:12px"><button class="btn" data-action="add-ketone">${t('ket.addBtn')}</button></div>
  </section>`;
  return out;
}

function healthButtons() {
  if (!NATIVE) return '';
  if (hc.status === 'not_installed' || hc.status === 'update_required')
    return `<button class="btn primary" data-action="hc-open">${hc.status === 'update_required' ? t('hc.update') : t('hc.install')}</button>`;
  if (hc.status === 'unavailable') return '';
  if (hc.status === 'available' && !hc.granted.length) return `<button class="btn primary" data-action="hc-perm">${t('hc.allowAccess')}</button>`;
  return `<button class="btn primary" data-action="hc-sync" ${hc.syncing ? 'disabled' : ''}>${hc.syncing ? t('hc.syncing') : t('hc.sync')}</button>`;
}

function banners() {
  let out = '';
  if (!db.settings.dietChosen) out += `<div class="banner"><span>${t('banner.diet')}</span><button class="btn primary sm" data-action="goals">${t('banner.dietBtn')}</button></div>`;
  if (pwa.installEvt && !db.settings.hideInstall) {
    out += `<div class="banner"><span>${t('banner.install')}</span><span class="btns"><button class="btn primary sm" data-action="install">${t('banner.installBtn')}</button><button class="x-btn" data-action="hide-install" aria-label="${t('btn.close')}">✕</button></span></div>`;
  }
  if (NATIVE && hc.status === 'available' && !hc.granted.length) {
    out += `<div class="banner"><span>${t('banner.hc')}</span><button class="btn primary sm" data-action="hc-perm">${t('banner.hcBtn')}</button></div>`;
  }
  const first = [...weightDates(), ...db.foods.map(f => f.date)].sort()[0];
  const lb = db.settings.lastBackup;
  if (first && daysBetween(first, today()) >= 14 && (!lb || daysBetween(lb, today()) > 30)) {
    out += `<div class="banner warn"><span>${t('banner.backup')} ${lb ? t('banner.lastBackup', { date: shortDate(lb) }) : t('banner.makeBackup')}</span><button class="btn sm" data-action="export">${t('banner.exportBtn')}</button></div>`;
  }
  return out;
}
