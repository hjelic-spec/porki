// Izvještaji e-mailom: HTML izvještaj, slanje i tjedni podsjetnik
import { addDays, dayShort, daysBetween, fmt, fullDate, h, iso, mean, num, r1, sgn, shortDate, sum, today, weekStart } from './core/format.js';
import { getLang, list, t } from './i18n/index.js';
import { KET } from './core/ketones.js';
import { burnedOf, dietOf, KCAL_PER_KG, totals } from './core/nutrition.js';
import { WB } from './native/widget.js';
import { avg7, dayFood, db, latestWeight, lowCarb, save, weekData, weekEnergyVsScale, weightDates } from './store.js';
import { chart } from './ui/charts.js';
import { dlg, openDialog } from './ui/dialog.js';
import { NATIVE, toast } from './ui/dom.js';
import { energyVsScaleCard, insights } from './views/analysis.js';
import { LN } from './views/fast.js';

const REPORT_NOTIF = 1700;
function firstDataDate() {
  const ds = [...weightDates(), ...db.foods.map(f => f.date), ...Object.keys(db.energy), ...db.ketones.map(k => k.date)].filter(Boolean).sort();
  return ds[0] || today();
}
const reportFrom = () => db.settings.reportFrom || firstDataDate();
const esc = h;

function reportSummaryText(ws) {
  const we = addDays(ws, 6), wd = weekData(ws), e = weekEnergyVsScale(ws);
  const L = wd.filter(x => x.logged), W = wd.filter(x => x.weight != null);
  const parts = [t('rep.summaryTitle', { from: shortDate(ws), to: fullDate(we) })];
  if (W.length) parts.push(t('rep.sumWeight', { kg: fmt(W.at(-1).weight, 1) }) + (e.actual != null ? ' ' + t('rep.sumWeightDiff', { diff: sgn(e.actual, 2) }) : ''));
  if (L.length) parts.push(t('rep.sumMacros', { net: fmt(mean(L.map(x => x.net)), 1), protein: fmt(mean(L.map(x => x.protein))), fat: fmt(mean(L.map(x => x.fat))), kcal: fmt(mean(L.map(x => x.kcal))) }));
  if (e.days) parts.push(t('rep.sumBalance', { kcal: sgn(e.sumBal, 0), kg: sgn(e.expectedWeek ?? e.expected, 2) }));
  const from = reportFrom(), fw = weightDates().filter(d => d >= from), lw = latestWeight(today());
  if (fw.length && lw) parts.push(t('rep.sumSince', { date: fullDate(from), kg: sgn(lw.kg - db.weights[fw[0]], 1) }));
  parts.push('', t('rep.sumAttached'));
  return parts.join('\n');
}

function buildReportHtml() {
  const s = db.settings, ws = addDays(weekStart(today()), -7), we = addDays(ws, 6);
  const wd = weekData(ws), prev = weekData(addDays(ws, -7)), e = weekEnergyVsScale(ws);
  const L = wd.filter(x => x.logged);
  const from = reportFrom(), to = today();
  const expV = e.expectedWeek ?? e.expected;
  const tile = (v, l, cls = '') => `<div class="tile"><b class="${cls}">${v}</b><span>${l}</span></div>`;
  const avgOf = k => mean(L.map(x => x[k]));
  // tjedni podaci
  const dayRows = wd.map(x => `<tr><td>${dayShort(x.d)} ${shortDate(x.d)}</td><td class="${x.logged && lowCarb() && x.net > s.carbLimit ? 'bad' : ''}">${x.logged ? fmt(x.net, 1) : '–'}</td><td>${x.logged ? fmt(x.protein) : '–'}</td><td>${x.logged ? fmt(x.fat) : '–'}</td><td>${x.logged ? fmt(x.kcal) : '–'}</td><td>${fmt(x.burned)}</td><td class="${x.balance == null ? '' : x.balance <= 0 ? 'good' : 'bad'}">${x.balance == null ? '–' : sgn(x.balance, 0)}</td><td>${fmt(x.weight, 1)}</td><td>${x.ket == null ? '–' : esc(KET[x.ket].l)}</td></tr>`).join('');
  const labels = wd.map(x => dayShort(x.d));
  const weekFasts = db.fasts.filter(f => { const d = iso(new Date(f.end)); return d >= ws && d <= we; });
  // kumulativno
  const weeks = [];
  for (let w = weekStart(from); w <= weekStart(today()); w = addDays(w, 7)) weeks.push(weekEnergyVsScale(w));
  const both = weeks.filter(w => w.expectedWeek != null && w.actual != null);
  const fwd = weightDates().filter(d => d >= from && d <= to);
  const startW = fwd.length ? db.weights[fwd[0]] : null, endW = fwd.length ? db.weights[fwd.at(-1)] : null;
  const span = Math.max(1, daysBetween(from, to) + 1);
  const cumFoods = new Set(db.foods.filter(f => f.date >= from && f.date <= to).map(f => f.date)).size;
  const cumBal = [];
  for (let i = 0; i < span; i++) { const d = addDays(from, i), fl = dayFood(d), b = burnedOf(db.energy[d]); if (fl.length && b != null) cumBal.push(totals(fl).kcal - b); }
  const cumKet = db.ketones.filter(k => k.date >= from && k.date <= to);
  const cumKetDays = new Set(cumKet.map(k => k.date)), cumInK = new Set(cumKet.filter(k => k.ket >= 1).map(k => k.date));
  const cumFasts = db.fasts.filter(f => iso(new Date(f.end)) >= from && iso(new Date(f.end)) <= to);
  const wLabels = [], wPts = [], wAvg = [];
  for (let i = 0; i < span; i++) { const d = addDays(from, i); wLabels.push(shortDate(d)); wPts.push(db.weights[d] ?? null); wAvg.push(db.weights[d] != null ? avg7(d) : null); }
  const goal = num(s.goalWeight);
  const weekRows = weeks.slice().reverse().map(w => {
    const d = weekData(w.ws), l = d.filter(x => x.logged), ww = d.filter(x => x.weight != null);
    return `<tr><td>${shortDate(w.ws)}</td><td>${fmt(mean(ww.map(x => x.weight)), 1)}</td><td class="${w.actual == null ? '' : w.actual <= 0 ? 'good' : 'bad'}">${w.actual == null ? '–' : sgn(w.actual, 2)}</td><td>${w.expectedWeek == null ? '–' : sgn(w.expectedWeek, 2)}</td><td>${fmt(mean(l.map(x => x.net)), 1)}</td><td>${fmt(mean(l.map(x => x.protein)))}</td><td>${w.days ? sgn(w.sumBal, 0) : '–'}</td></tr>`;
  }).join('');
  const css = `:root{--bg:#fff6f8;--card:#fff;--ink:#2a1d22;--muted:#7a6870;--line:#f0dde3;--soft:#fceaf0;--accent:#c2406a;--c-carb:#d9822b;--c-fat:#7f9c2c;--c-prot:#3f72af;--c-burn:#c2553a;--c-weight:#c2406a;--good:#2f7d4f;--warn:#b7791f;--bad:#c0392b;--info:#3f72af;--grid:#f5e6eb}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,"Segoe UI",Roboto,Arial,sans-serif}main{max-width:760px;margin:0 auto;padding:20px 16px}
h1{font-size:24px;margin:0 0 4px;color:var(--accent)}h2{font-size:18px;margin:0 0 10px}h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:16px 0 6px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:14px 0}.muted{color:var(--muted);font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.tile{background:var(--soft);border-radius:10px;padding:8px 10px}.tile b{display:block;font-size:18px}.tile span{font-size:12px;color:var(--muted)}
.good{color:var(--good)}.bad{color:var(--bad)}.warn{color:var(--warn)}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:6px 5px;text-align:right;border-top:1px solid var(--line);white-space:nowrap}th{color:var(--muted);border-top:0}th:first-child,td:first-child{text-align:left}
.wrap{overflow-x:auto}ul.ins{list-style:none;padding:0;margin:0}ul.ins li{background:var(--soft);border-radius:10px;padding:8px 10px;margin-top:6px;font-size:14px}
ul.ins li.good{border-left:4px solid var(--good)}ul.ins li.warn{border-left:4px solid var(--warn)}ul.ins li.bad{border-left:4px solid var(--bad)}ul.ins li.info{border-left:4px solid var(--info)}ul.ins li{color:var(--ink)}
.chart{width:100%;max-width:560px;height:auto;display:block;margin:0 auto}.chart .grid{stroke:var(--grid)}.chart .ax{fill:var(--muted);font-size:9px}.chart .ref{stroke-width:1.2;stroke-dasharray:4 3}.chart .reflbl{font-size:9px;font-weight:600}
.legend{font-size:12px;color:var(--muted)}.legend span{margin-right:10px}.legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px}.card-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:10px}.card-h h2{margin:0}.small{font-size:12px}ul.insights{list-style:none;padding:0;margin:0}ul.insights li{background:var(--soft);border-radius:10px;padding:8px 10px;margin-top:6px;font-size:14px}ul.insights li.good{border-left:4px solid var(--good)}ul.insights li.warn{border-left:4px solid var(--warn)}ul.insights li.bad{border-left:4px solid var(--bad)}ul.insights li.info{border-left:4px solid var(--info)}details.explain{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}details.explain summary{cursor:pointer;font-weight:600;color:var(--accent)}.help p,.help li{font-size:14px}footer{font-size:12px;color:var(--muted);margin:20px 0}
@media(max-width:520px){.tiles{grid-template-columns:1fr 1fr}}`;
  const ins = insights(wd, prev);
  return `<!doctype html><html lang="${getLang()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t('rep.title')} ${shortDate(ws)}–${fullDate(we)}</title><style>${css}</style></head><body><main>
<h1>${t('rep.title')}</h1>
<p class="muted">${t('rep.meta', { diet: esc(dietOf(s.diet).name), kcal: fmt(s.kcalTarget), carbs: s.carbLimit, protein: s.proteinTarget, fat: s.fatTarget, date: fullDate(today()) })}</p>

<section class="card"><h2>${t('rep.lastWeek', { from: shortDate(ws), to: fullDate(we) })}</h2>
<div class="tiles">
${tile(fmt(avgOf('net'), 1) + ' g', t('rep.avgNet'))}${tile(fmt(avgOf('protein')) + ' g', t('rep.avgProtein'))}${tile(fmt(avgOf('fat')) + ' g', t('rep.avgFat'))}
${tile(fmt(avgOf('kcal')), t('an.avgKcal'))}${tile(fmt(mean(wd.filter(x => x.burned != null).map(x => x.burned))), t('an.avgBurned'))}${tile(fmt(mean(wd.filter(x => x.steps != null).map(x => x.steps))), t('an.avgSteps'))}
${tile(expV != null ? sgn(expV, 2) + ' kg' : '–', t('evs.legendExpected'), expV != null && expV <= 0 ? 'good' : expV != null ? 'bad' : '')}${tile(e.actual != null ? sgn(e.actual, 2) + ' kg' : '–', t('evs.actual'), e.actual == null ? '' : e.actual <= 0 ? 'good' : 'bad')}${tile(e.days ? sgn(e.sumBal, 0) : '–', t('rep.balanceDays', { n: e.days }))}
</div>
<h3>${t('an.insights')}</h3><ul class="ins">${ins.map(i => `<li class="${i.type}">${esc(i.text)}</li>`).join('')}</ul>
<h3>${t('rep.netCarbsG')}</h3>${chart({ labels, h: 150, zero: true, series: [{ type: 'bar', values: wd.map(x => x.logged ? r1(x.net) : null), color: v => lowCarb() && v > s.carbLimit ? 'var(--bad)' : 'var(--c-carb)', dec: 1, name: 'g' }], refs: [{ y: s.carbLimit, color: 'var(--bad)', label: t('chart.goal', { v: s.carbLimit }) }], empty: t('rep.noFood') })}
<h3>${t('an.kcalTitle')}</h3>${chart({ labels, h: 160, zero: true, series: [
    { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.net * 4) : null), color: 'var(--c-carb)' },
    { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.protein * 4) : null), color: 'var(--c-prot)' },
    { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.fat * 9) : null), color: 'var(--c-fat)' },
    { type: 'line', values: wd.map(x => x.burned), color: 'var(--c-burn)' }, { type: 'dots', values: wd.map(x => x.burned), color: 'var(--c-burn)' }] })}
<p class="legend">■ ${t('tile.fat')} · ■ ${t('tile.protein')} · ■ ${t('abbr.carbs')} · ● ${t('an.burned')}</p>
<h3>${t('an.byDay')}</h3><div class="wrap"><table><tr><th>${t('th.day')}</th><th>${t('abbr.carbs')}</th><th>${t('abbr.protein')}</th><th>${t('abbr.fat')}</th><th>kcal</th><th>${t('th.burned')}</th><th>${t('rep.balance')}</th><th>kg</th><th>${t('rep.ketones')}</th></tr>${dayRows}</table></div>
${weekFasts.length ? `<h3>${t('fast.title')}</h3><p>${t('n.fastsCount', { n: weekFasts.length })} · Ø ${fmt(mean(weekFasts.map(f => f.end - f.start)) / 3600e3, 1)} h · ${t('fast.longest')} ${fmt(Math.max(...weekFasts.map(f => f.end - f.start)) / 3600e3, 1)} h</p>` : ''}
</section>

${energyVsScaleCard(ws)}

<section class="card"><h2>${t('rep.cumulative', { from: fullDate(from), to: fullDate(to) })}</h2>
<div class="tiles">
${tile(fmt(startW, 1) + ' kg', t('rep.startWeight'))}${tile(fmt(endW, 1) + ' kg', t('rep.lastWeight'))}${tile(startW != null && endW != null ? sgn(endW - startW, 1) + ' kg' : '–', t('rep.change'), startW == null || endW == null ? '' : endW <= startW ? 'good' : 'bad')}
${tile(startW != null && endW != null ? sgn((endW - startW) / (span / 7), 2) : '–', t('rep.kgWeek'))}${tile(cumBal.length ? sgn(sum(cumBal) / KCAL_PER_KG, 1) + ' kg' : '–', t('rep.expectedDays', { n: cumBal.length }))}${tile(goal && endW ? fmt(Math.max(0, endW - goal), 1) + ' kg' : '–', t('rep.toGoal'))}
${tile(`${cumFoods}/${span}`, t('rep.foodDays'))}${tile(cumKetDays.size ? `${cumInK.size}/${cumKetDays.size}` : '–', t('rep.ketoDays'))}${tile(cumFasts.length ? `${cumFasts.length} · Ø ${fmt(mean(cumFasts.map(f => f.end - f.start)) / 3600e3, 1)} h` : '–', t('rep.fastsAvg'))}
</div>
${both.length ? `<p style="margin:10px 0 0">${t('rep.fullWeeks', { n: both.length, exp: sgn(sum(both.map(w => w.expectedWeek)), 1), act: sgn(sum(both.map(w => w.actual)), 1) })}</p>` : ''}
<h3>${t('weight.trend')}</h3>${chart({ labels: wLabels, h: 190, series: [{ type: 'dots', values: wPts, color: 'var(--muted)', dec: 1 }, { type: 'line', values: wAvg, color: 'var(--c-weight)', span: true, width: 2.5 }], refs: goal ? [{ y: goal, color: 'var(--good)', label: t('chart.goal', { v: fmt(goal, 1) }) }] : [], empty: t('rep.noWeights') })}
<p class="legend">● ${t('weight.daily')} · — ${t('weight.avg7')}</p>
<h3>${t('rep.byWeek')}</h3><div class="wrap"><table><tr><th>${t('th.week')}</th><th>Ø kg</th><th>${t('rep.thChange')}</th><th>${t('rep.thExpected')}</th><th>Ø ${t('abbr.carbs')}</th><th>Ø ${t('abbr.protein')}</th><th>${t('th.balKcal')}</th></tr>${weekRows}</table></div>
</section>
<footer>${t('rep.footer')}</footer>
</main></body></html>`;
}

export async function sendReport() {
  const s = db.settings, ws = addDays(weekStart(today()), -7);
  const html = buildReportHtml(), text = reportSummaryText(ws);
  const subject = `${t('rep.title')} ${shortDate(ws)}–${fullDate(addDays(ws, 6))}`;
  const filename = `${t('rep.filename')}-${addDays(ws, 6)}.html`;
  if (NATIVE && WB) {
    try { await WB.shareReport({ html, filename, email: s.reportEmail || '', subject, text, title: t('rep.shareTitle') }); }
    catch (e) { toast(t('rep.sendFailed', { err: e.message })); }
    return;
  }
  // web: preuzmi izvještaj i otvori e-mail sa sažetkom
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  location.href = `mailto:${encodeURIComponent(s.reportEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text + '\n\n' + t('rep.attachHint', { file: filename }))}`;
}
export function previewReport() {
  // u aplikaciji, s gumbom za zatvaranje (window.open u Android aplikaciji nema povratka)
  openDialog(`<h2>${t('rep.previewTitle')}</h2>
    <iframe class="report-frame" title="${t('rep.frameTitle')}" sandbox="allow-same-origin"></iframe>
    <div class="btns end" style="margin-top:10px"><button type="button" class="btn" data-action="reports">${t('btn.back')}</button><button type="button" class="btn primary" data-action="report-send">${t('rep.send')}</button></div>`,
    null, () => { dlg.querySelector('.report-frame').srcdoc = buildReportHtml(); });
}
// vrijednosti iz obrasca izvještaja vrijede odmah (i bez dodira na Spremi)
export function readReportForm() {
  const f = dlg.open && dlg.querySelector('form');
  if (!f || !f.reportDay) return;
  const fd = Object.fromEntries(new FormData(f));
  Object.assign(db.settings, { reportEmail: (fd.reportEmail || '').trim(), reportFrom: fd.reportFrom || '', reportDay: +fd.reportDay || 0, reportTime: fd.reportTime || '08:00' });
  save();
}
export async function scheduleReportNotif() {
  if (!LN) return;
  try {
    await LN.cancel({ notifications: [{ id: REPORT_NOTIF }] }).catch(() => {});
    const d = +db.settings.reportDay;
    if (!d) return;
    let p = await LN.checkPermissions();
    if (p.display !== 'granted') p = await LN.requestPermissions();
    if (p.display !== 'granted') { toast(t('rep.notifDenied')); return; }
    const [hh, mm] = String(db.settings.reportTime || '08:00').split(':').map(Number);
    await LN.schedule({ notifications: [{
      id: REPORT_NOTIF, title: t('rep.notifTitle'),
      body: t('rep.notifBody'),
      schedule: { on: { weekday: (d % 7) + 1, hour: hh || 0, minute: mm || 0 }, allowWhileIdle: true }, isExactNotification: false
    }] });
  } catch (e) { console.error(e); }
}
if (LN) LN.addListener('localNotificationActionPerformed', a => {
  if (a && a.notification && a.notification.id === REPORT_NOTIF) setTimeout(sendReport, 600);
}).catch?.(() => {});

export function openReports() {
  const s = db.settings;
  openDialog(`<h2>${t('rep.dialogTitle')}</h2>
    <div class="stack">
      <label>${t('rep.email')}<input name="reportEmail" type="email" inputmode="email" autocomplete="email" value="${h(s.reportEmail || '')}" placeholder="${t('rep.emailPh')}"></label>
      <label>${t('rep.from')}<input name="reportFrom" type="date" value="${h(s.reportFrom || '')}" max="${today()}"></label>
      <p class="muted small" style="margin:0">${t('rep.fromHelp', { date: fullDate(firstDataDate()) })}</p>
      <div class="grid2">
        <label>${t('rep.reminder')}<select name="reportDay"><option value="0">${t('rep.off')}</option>${list('weekdaysLong').map((d, i) => `<option value="${i + 1}" ${+s.reportDay === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label>${t('foodForm.time')}<input name="reportTime" type="time" value="${h(s.reportTime || '08:00')}"></label>
      </div>
      <p class="muted small" style="margin:0">${t('rep.help')} ${NATIVE ? t('rep.helpNative') : t('rep.helpWeb')}</p>
      <div class="btns">
        <button type="button" class="btn" data-action="report-preview">${t('rep.preview')}</button>
        <button type="button" class="btn" data-action="report-send">${t('rep.sendNow')}</button>
      </div>
      <div class="btns end"><button type="button" class="btn" data-action="close">${t('btn.cancel')}</button><button class="btn primary">${t('btn.save')}</button></div>
    </div>`,
    fd => {
      Object.assign(db.settings, { reportEmail: (fd.reportEmail || '').trim(), reportFrom: fd.reportFrom || '', reportDay: +fd.reportDay || 0, reportTime: fd.reportTime || '08:00' });
      save();
      scheduleReportNotif();
      toast(db.settings.reportDay ? t('rep.reminderSet', { day: list('weekdaysLong')[db.settings.reportDay - 1], time: db.settings.reportTime }) : t('rep.saved'));
    });
}
