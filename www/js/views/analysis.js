// Kartica Analiza: tjedni pregled, uvidi i očekivano vs. stvarno
import { macroSplit } from '../core/analysis.js';
import { addDays, dayShort, fmt, fullDate, mean, r1, sgn, shortDate, sum, today, weekStart } from '../core/format.js';
import { KET } from '../core/ketones.js';
import { KCAL_PER_KG } from '../core/nutrition.js';
import { t } from '../i18n/index.js';
import { db, latestWeight, lowCarb, weekData, weekEnergyVsScale } from '../store.js';
import { chart } from '../ui/charts.js';
import { state } from '../ui/dom.js';
import { fastWeekCard } from './fast.js';

export function insights(wd, prev) {
  const s = db.settings, out = [], L = wd.filter(x => x.logged);
  const add = (type, text) => out.push({ type, text });
  if (!L.length) add('info', t('ins.noFood'));
  else {
    const within = L.filter(x => x.net <= s.carbLimit).length;
    add(within === L.length ? 'good' : within >= L.length * 0.7 ? 'warn' : 'bad',
      t('ins.carbsWithin', { limit: s.carbLimit, n: within, of: L.length, avg: fmt(mean(L.map(x => x.net)), 1) }));
    const avgP = mean(L.map(x => x.protein));
    if (s.proteinTarget) {
      if (avgP < s.proteinTarget * 0.85) add('warn', t('ins.proteinLow', { avg: fmt(avgP), target: s.proteinTarget }));
      else add('good', t('ins.proteinOk', { avg: fmt(avgP) }));
    }
    const sp = macroSplit(L);
    if (sp) {
      const pct = { fat: fmt(sp.fat), protein: fmt(sp.protein), carb: fmt(sp.carb) };
      if (lowCarb() && sp.carb > 10) add('warn', t('ins.carbPct', { carb: pct.carb }));
      if (lowCarb()) add(sp.fat >= 60 ? 'good' : 'info', t('ins.splitLowCarb', pct) + (sp.fat < 60 ? ' ' + t('ins.splitLchfHint') : ''));
      else add('info', t('ins.split', pct));
    }
    const avgK = mean(L.map(x => x.kcal));
    if (s.kcalTarget && avgK > s.kcalTarget * 1.1) add('warn', t('ins.kcalHigh', { avg: fmt(avgK), target: fmt(s.kcalTarget) }));
    if (L.length < 5) add('info', t('ins.fewDays', { n: L.length }));
  }
  const B = wd.filter(x => x.balance != null);
  if (B.length) {
    const tot = sum(B.map(x => x.balance));
    add(tot <= 0 ? 'good' : 'warn', t('ins.balance', { n: B.length, kcal: sgn(tot, 0), kg: sgn(tot / KCAL_PER_KG, 2) }));
  } else add('info', t('ins.noBalance'));
  const aw = mean(wd.filter(x => x.weight != null).map(x => x.weight));
  const pw = mean(prev.filter(x => x.weight != null).map(x => x.weight));
  if (aw != null && pw != null) {
    const dd = aw - pw;
    add(dd <= 0 ? 'good' : 'warn', t('ins.avgWeight', { kg: fmt(aw, 1), diff: sgn(dd) }));
    if (dd < -1.5) add('info', t('ins.bigDrop'));
    if (dd > 0.5 && L.some(x => x.net > s.carbLimit)) add('info', t('ins.waterBack'));
  } else if (wd.filter(x => x.weight != null).length < 4) add('info', t('ins.weighDaily'));
  const K = wd.filter(x => x.ket != null);
  if (K.length) {
    const inK = K.filter(x => x.ket >= 1).length;
    add(inK === K.length ? 'good' : inK ? 'info' : 'warn', t('ins.ketPositive', { n: inK, of: K.length }));
    if (K.some(x => x.ket >= 4)) add('warn', t('ins.ketHigh'));
  }
  if (wd.some(x => x.glu > 0)) add('bad', t('ins.glucose'));
  return out;
}

export function energyVsScaleCard(ws) {
  const s = db.settings, e = weekEnergyVsScale(ws);
  const exp = e.expectedWeek ?? e.expected;
  const kg = v => v == null ? '–' : `${sgn(v, 2)} kg`;
  // 8 tjedana: očekivano vs stvarno
  const weeks = [...Array(8)].map((_, i) => weekEnergyVsScale(addDays(ws, -7 * (7 - i))));
  const both = weeks.filter(w => w.expectedWeek != null && w.actual != null);
  const cumExp = sum(both.map(w => w.expectedWeek)), cumAct = sum(both.map(w => w.actual));
  // Tumačenje tjedna
  const notes = [];
  const add = (type, text) => notes.push({ type, text });
  if (exp == null) add('info', t('evs.needData'));
  if (exp != null && e.actual != null) {
    const d = e.actual - exp;
    if (Math.abs(d) <= 0.3) add('good', t('evs.match'));
    else if (d < 0) add('info', t('evs.moreLoss', { kg: fmt(-d, 1) }));
    else add('warn', t('evs.lessLoss', { kg: fmt(d, 1) }));
  } else if (exp != null) add('info', t('evs.weighMore'));
  if (both.length >= 3 && cumAct - cumExp > 0.5) {
    const perDay = (cumAct - cumExp) * KCAL_PER_KG / (both.length * 7);
    add('warn', t('evs.lagging', { weeks: t('n.weeksCount', { n: both.length }), kg: fmt(cumAct - cumExp, 1), kcal: fmt(perDay) }));
  }
  // Zdravlje
  const health = [];
  const hAdd = (type, text) => health.push({ type, text });
  const bw = e.avgW || latestWeight(addDays(ws, 6))?.kg;
  if (e.avgBal != null && e.avgBal < -1000) hAdd('warn', t('health.bigDeficit', { kcal: fmt(-e.avgBal) }));
  if (bw && exp != null && -exp > bw * 0.01) hAdd('warn', t('health.fastExpected', { kg: fmt(-exp, 1) }));
  if (bw && e.actual != null && -e.actual > bw * 0.015) hAdd('info', t('health.fastActual'));
  const L = e.wd.filter(x => x.logged);
  if (L.length && s.proteinTarget && mean(L.map(x => x.protein)) < s.proteinTarget * 0.85) hAdd('warn', t('health.lowProtein'));
  const lowDays = L.filter(x => x.kcal < 1200).length;
  if (lowDays >= 3) hAdd('warn', t('health.lowKcal', { n: lowDays }));
  if (!health.length) hAdd('good', t('health.ok'));
  return `<section class="card">
    <div class="card-h"><h2>${t('evs.title')}</h2><span class="muted">${e.days ? t('evs.days', { n: e.days }) : ''}</span></div>
    <div class="tiles">
      <div class="tile"><b class="${exp == null ? '' : exp <= 0 ? 'good' : 'bad'}">${kg(exp)}</b><span>${e.days && e.days < 7 && e.expectedWeek != null ? t('evs.expectedEst') : t('evs.expected')}</span></div>
      <div class="tile"><b class="${e.actual == null ? '' : e.actual <= 0 ? 'good' : 'bad'}">${kg(e.actual)}</b><span>${t('evs.actual')}</span></div>
      <div class="tile"><b>${exp != null && e.actual != null ? sgn(e.actual - exp, 2) + ' kg' : '–'}</b><span>${t('evs.diff')}</span></div>
    </div>
    <p class="muted small" style="margin:8px 0 0">${t('evs.weekBalance')} ${e.days ? t('evs.weekBalanceVal', { kcal: sgn(e.sumBal, 0), avg: sgn(e.avgBal, 0) }) : '–'}${e.actualHow ? ` · ${t('evs.actualHow', { how: e.actualHow })}` : ''}</p>
    <ul class="insights" style="margin-top:8px">${notes.map(n => `<li class="${n.type}">${n.text}</li>`).join('')}</ul>
    <h3>${t('evs.last8')}</h3>
    ${chart({ labels: weeks.map(w => shortDate(w.ws)), h: 160, zero: true, maxLabels: 8,
      series: [
        { type: 'bar', values: weeks.map(w => w.expectedWeek != null ? Math.round(w.expectedWeek * 100) / 100 : null), color: 'color-mix(in srgb, var(--accent) 45%, transparent)', dec: 2, name: t('evs.kgExpected') },
        { type: 'line', values: weeks.map(w => w.actual != null ? Math.round(w.actual * 100) / 100 : null), color: 'var(--ink)', width: 2 },
        { type: 'dots', values: weeks.map(w => w.actual != null ? Math.round(w.actual * 100) / 100 : null), color: 'var(--ink)', dec: 2, name: t('evs.kgActual') }
      ], empty: t('evs.chartEmpty') })}
    <div class="legend" style="margin-top:4px"><span><i style="background:color-mix(in srgb, var(--accent) 45%, transparent)"></i>${t('evs.legendExpected')}</span><span><i style="background:var(--ink)"></i>${t('evs.legendActual')}</span></div>
    ${both.length ? `<p class="small" style="margin:8px 0 0">${t('evs.total', { weeks: t('n.weeksCount', { n: both.length }), exp: sgn(cumExp, 1), act: sgn(cumAct, 1) })}</p>` : ''}
    <h3>${t('health.title')}</h3>
    <ul class="insights">${health.map(n => `<li class="${n.type}">${n.text}</li>`).join('')}</ul>
    <details class="explain">
      <summary>${t('explain.summary')}</summary>
      <div class="help">
        <p>${t('explain.expected')}</p>
        <p>${t('explain.actual')}</p>
        <p>${t('explain.why')}</p>
        <p><b>${t('explain.healthTitle')}</b></p>
        <ol>${[1, 2, 3, 4, 5, 6, 7].map(i => `
          <li>${t('explain.tip' + i)}</li>`).join('')}
        </ol>
        <p class="muted small">${t('explain.disclaimer')}</p>
      </div>
    </details>
  </section>`;
}
export function viewAnalysis() {
  const ws = state.week, we = addDays(ws, 6), s = db.settings;
  const wd = weekData(ws), prev = weekData(addDays(ws, -7));
  const L = wd.filter(x => x.logged);
  const labels = wd.map(x => dayShort(x.d));
  const tbl = wd.map(x => `<tr><td>${dayShort(x.d)} ${shortDate(x.d)}</td>
      <td class="${x.logged && x.net > s.carbLimit ? 'bad' : ''}">${x.logged ? fmt(x.net, 1) : '–'}</td><td>${x.logged ? fmt(x.fat) : '–'}</td><td>${x.logged ? fmt(x.protein) : '–'}</td>
      <td>${x.logged ? fmt(x.kcal) : '–'}</td><td>${fmt(x.burned)}</td><td class="${x.balance == null ? '' : x.balance <= 0 ? 'good' : 'bad'}">${x.balance == null ? '–' : sgn(x.balance, 0)}</td>
      <td>${fmt(x.weight, 1)}</td><td>${x.ket == null ? '–' : `<span class="dot" style="background:${KET[x.ket].c};width:11px;height:11px"></span>`}</td></tr>`).join('');
  const avgOf = k => mean(L.map(x => x[k]));
  // trend 8 tjedana
  const weeks = [...Array(8)].map((_, i) => addDays(ws, -7 * (7 - i)));
  const wk = weeks.map(w => {
    const d = weekData(w), l = d.filter(x => x.logged), b = d.filter(x => x.balance != null);
    return { w, weight: mean(d.filter(x => x.weight != null).map(x => x.weight)), net: mean(l.map(x => x.net)), bal: b.length ? sum(b.map(x => x.balance)) : null };
  });
  const thisWeek = ws === weekStart(today());
  return `
  <section class="card">
    <div class="card-h" style="align-items:center;margin:0">
      <button class="icon-btn" data-action="prev-week" aria-label="${t('an.prevWeek')}">‹</button>
      <div style="text-align:center"><b>${shortDate(ws)} – ${fullDate(we)}</b><div class="muted small">${thisWeek ? t('an.thisWeek') : t('an.weekly')}</div></div>
      <button class="icon-btn" data-action="next-week" ${thisWeek ? 'disabled' : ''} aria-label="${t('an.nextWeek')}">›</button>
    </div>
  </section>
  <section class="card">
    <div class="tiles">
      <div class="tile"><b>${fmt(avgOf('net'), 1)}</b><span>${t('an.avgNet')}</span></div>
      <div class="tile"><b>${fmt(avgOf('fat'))}</b><span>${t('an.avgFat')}</span></div>
      <div class="tile"><b>${fmt(avgOf('protein'))}</b><span>${t('an.avgProtein')}</span></div>
      <div class="tile"><b>${fmt(avgOf('kcal'))}</b><span>${t('an.avgKcal')}</span></div>
      <div class="tile"><b>${fmt(mean(wd.filter(x => x.burned != null).map(x => x.burned)))}</b><span>${t('an.avgBurned')}</span></div>
      <div class="tile"><b>${fmt(mean(wd.filter(x => x.steps != null).map(x => x.steps)))}</b><span>${t('an.avgSteps')}</span></div>
    </div>
  </section>
  <section class="card"><div class="card-h"><h2>${t('an.insights')}</h2></div>
    <ul class="insights">${insights(wd, prev).map(i => `<li class="${i.type}">${i.text}</li>`).join('')}</ul>
  </section>
  ${energyVsScaleCard(ws)}
  <section class="card"><div class="card-h"><h2>${t('today.netCarbs')}</h2><span class="muted">${t('an.gPerDay')}</span></div>
    ${chart({ labels, h: 150, zero: true, series: [{ type: 'bar', values: wd.map(x => x.logged ? r1(x.net) : null), color: v => v > s.carbLimit ? 'var(--bad)' : 'var(--c-carb)', dec: 1, name: 'g' }], refs: [{ y: s.carbLimit, color: 'var(--bad)', label: t('chart.limit', { v: s.carbLimit }) }], empty: t('an.noFoodChart') })}
  </section>
  <section class="card"><div class="card-h"><h2>${t('an.kcalTitle')}</h2></div>
    ${chart({ labels, h: 170, zero: true, series: [
      { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.net * 4) : null), color: 'var(--c-carb)', name: t('an.kcalCarbs') },
      { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.protein * 4) : null), color: 'var(--c-prot)', name: t('an.kcalProtein') },
      { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.fat * 9) : null), color: 'var(--c-fat)', name: t('an.kcalFat') },
      { type: 'line', values: wd.map(x => x.burned), color: 'var(--c-burn)', width: 2 },
      { type: 'dots', values: wd.map(x => x.burned), color: 'var(--c-burn)', name: t('an.kcalBurned') }
    ], refs: s.kcalTarget ? [{ y: s.kcalTarget, color: 'var(--muted)', label: t('chart.target') }] : [] })}
    <div class="legend" style="margin-top:4px"><span><i style="background:var(--c-fat)"></i>${t('tile.fat')}</span><span><i style="background:var(--c-prot)"></i>${t('tile.protein')}</span><span><i style="background:var(--c-carb)"></i>${t('abbr.carbs')}</span><span><i style="background:var(--c-burn)"></i>${t('an.burned')}</span></div>
  </section>
  <section class="card"><div class="card-h"><h2>${t('an.byDay')}</h2></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>${t('th.day')}</th><th>${t('abbr.carbs')}</th><th>${t('abbr.fat')}</th><th>${t('abbr.protein')}</th><th>kcal</th><th>${t('th.burned')}</th><th>${t('th.bal')}</th><th>kg</th><th>${t('th.ket')}</th></tr></thead>
      <tbody>${tbl}</tbody></table></div>
  </section>
  ${fastWeekCard(ws, we)}
  <section class="card"><div class="card-h"><h2>${t('an.trend8')}</h2></div>
    ${chart({ labels: wk.map(x => shortDate(x.w)), h: 150, maxLabels: 8, series: [{ type: 'line', values: wk.map(x => x.weight), color: 'var(--c-weight)', span: true }, { type: 'dots', values: wk.map(x => x.weight), color: 'var(--c-weight)', dec: 1, name: 'kg' }], empty: t('an.fewWeights') })}
    <div class="tbl-wrap"><table class="tbl" style="margin-top:8px">
      <thead><tr><th>${t('th.week')}</th><th>Ø kg</th><th>${t('th.avgNet')}</th><th>${t('th.balKcal')}</th></tr></thead>
      <tbody>${wk.slice().reverse().map(x => `<tr><td>${shortDate(x.w)}</td><td>${fmt(x.weight, 1)}</td><td>${fmt(x.net, 1)}</td><td class="${x.bal == null ? '' : x.bal <= 0 ? 'good' : 'bad'}">${x.bal == null ? '–' : sgn(x.bal, 0)}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}
