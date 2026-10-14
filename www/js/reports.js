// Izvještaji e-mailom: HTML izvještaj, slanje i tjedni podsjetnik
import { addDays, DAYS, daysBetween, fmt, h, iso, mean, num, parseISO, postova, r1, sgn, shortDate, sum, today, weekStart } from './core/format.js';
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
const WEEKDAYS = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja'];
function firstDataDate() {
  const ds = [...weightDates(), ...db.foods.map(f => f.date), ...Object.keys(db.energy), ...db.ketones.map(k => k.date)].filter(Boolean).sort();
  return ds[0] || today();
}
const reportFrom = () => db.settings.reportFrom || firstDataDate();
const esc = h;

function reportSummaryText(ws) {
  const we = addDays(ws, 6), wd = weekData(ws), e = weekEnergyVsScale(ws);
  const L = wd.filter(x => x.logged), W = wd.filter(x => x.weight != null);
  const parts = [`Porki – izvještaj za tjedan ${shortDate(ws)}–${shortDate(we)}${we.slice(0, 4)}`];
  if (W.length) parts.push(`Težina: ${fmt(W.at(-1).weight, 1)} kg${e.actual != null ? ` (${sgn(e.actual, 2)} kg u odnosu na prošli tjedan)` : ''}`);
  if (L.length) parts.push(`Ø neto UH ${fmt(mean(L.map(x => x.net)), 1)} g · proteini ${fmt(mean(L.map(x => x.protein)))} g · masti ${fmt(mean(L.map(x => x.fat)))} g · ${fmt(mean(L.map(x => x.kcal)))} kcal`);
  if (e.days) parts.push(`Kalorijska bilanca ${sgn(e.sumBal, 0)} kcal – očekivano ${sgn(e.expectedWeek ?? e.expected, 2)} kg`);
  const from = reportFrom(), fw = weightDates().filter(d => d >= from), lw = latestWeight(today());
  if (fw.length && lw) parts.push(`Od ${shortDate(from)}${from.slice(0, 4)}: ${sgn(lw.kg - db.weights[fw[0]], 1)} kg`);
  parts.push('', 'Detaljan izvještaj s grafovima je u privitku (HTML – otvori u pregledniku).');
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
  const dayRows = wd.map(x => `<tr><td>${DAYS[parseISO(x.d).getDay()]} ${shortDate(x.d)}</td><td class="${x.logged && lowCarb() && x.net > s.carbLimit ? 'bad' : ''}">${x.logged ? fmt(x.net, 1) : '–'}</td><td>${x.logged ? fmt(x.protein) : '–'}</td><td>${x.logged ? fmt(x.fat) : '–'}</td><td>${x.logged ? fmt(x.kcal) : '–'}</td><td>${fmt(x.burned)}</td><td class="${x.balance == null ? '' : x.balance <= 0 ? 'good' : 'bad'}">${x.balance == null ? '–' : sgn(x.balance, 0)}</td><td>${fmt(x.weight, 1)}</td><td>${x.ket == null ? '–' : esc(KET[x.ket].l)}</td></tr>`).join('');
  const labels = wd.map(x => DAYS[parseISO(x.d).getDay()]);
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
  return `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Porki – izvještaj ${shortDate(ws)}–${shortDate(we)}${we.slice(0, 4)}</title><style>${css}</style></head><body><main>
<h1>Porki – izvještaj</h1>
<p class="muted">Prehrana: ${esc(dietOf(s.diet).name)} · ciljevi: ${fmt(s.kcalTarget)} kcal, UH ${s.carbLimit} g, proteini ${s.proteinTarget} g, masti ${s.fatTarget} g · izrađeno ${shortDate(today())}${today().slice(0, 4)}</p>

<section class="card"><h2>Prošli tjedan: ${shortDate(ws)}–${shortDate(we)}${we.slice(0, 4)}</h2>
<div class="tiles">
${tile(fmt(avgOf('net'), 1) + ' g', 'Ø neto UH')}${tile(fmt(avgOf('protein')) + ' g', 'Ø proteini')}${tile(fmt(avgOf('fat')) + ' g', 'Ø masti')}
${tile(fmt(avgOf('kcal')), 'Ø unos kcal')}${tile(fmt(mean(wd.filter(x => x.burned != null).map(x => x.burned))), 'Ø potrošnja kcal')}${tile(fmt(mean(wd.filter(x => x.steps != null).map(x => x.steps))), 'Ø koraka')}
${tile(expV != null ? sgn(expV, 2) + ' kg' : '–', 'očekivano iz bilance', expV != null && expV <= 0 ? 'good' : expV != null ? 'bad' : '')}${tile(e.actual != null ? sgn(e.actual, 2) + ' kg' : '–', 'stvarno (vaga)', e.actual == null ? '' : e.actual <= 0 ? 'good' : 'bad')}${tile(e.days ? sgn(e.sumBal, 0) : '–', 'bilanca kcal (' + e.days + ' d)')}
</div>
<h3>Uvidi</h3><ul class="ins">${ins.map(i => `<li class="${i.type}">${esc(i.text)}</li>`).join('')}</ul>
<h3>Neto ugljikohidrati (g)</h3>${chart({ labels, h: 150, zero: true, series: [{ type: 'bar', values: wd.map(x => x.logged ? r1(x.net) : null), color: v => lowCarb() && v > s.carbLimit ? 'var(--bad)' : 'var(--c-carb)', dec: 1, name: 'g' }], refs: [{ y: s.carbLimit, color: 'var(--bad)', label: 'cilj ' + s.carbLimit }], empty: 'Nema unosa hrane.' })}
<h3>Kalorije: unos i potrošnja</h3>${chart({ labels, h: 160, zero: true, series: [
    { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.net * 4) : null), color: 'var(--c-carb)' },
    { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.protein * 4) : null), color: 'var(--c-prot)' },
    { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.fat * 9) : null), color: 'var(--c-fat)' },
    { type: 'line', values: wd.map(x => x.burned), color: 'var(--c-burn)' }, { type: 'dots', values: wd.map(x => x.burned), color: 'var(--c-burn)' }] })}
<p class="legend">■ masti · ■ proteini · ■ UH · ● potrošeno</p>
<h3>Po danima</h3><div class="wrap"><table><tr><th>Dan</th><th>UH</th><th>P</th><th>M</th><th>kcal</th><th>Potr.</th><th>Bilanca</th><th>kg</th><th>Ketoni</th></tr>${dayRows}</table></div>
${weekFasts.length ? `<h3>Post</h3><p>${weekFasts.length} ${postova(weekFasts.length)} · Ø ${fmt(mean(weekFasts.map(f => f.end - f.start)) / 3600e3, 1)} h · najduži ${fmt(Math.max(...weekFasts.map(f => f.end - f.start)) / 3600e3, 1)} h</p>` : ''}
</section>

${energyVsScaleCard(ws)}

<section class="card"><h2>Kumulativno od ${shortDate(from)}${from.slice(0, 4)} do ${shortDate(to)}${to.slice(0, 4)}</h2>
<div class="tiles">
${tile(fmt(startW, 1) + ' kg', 'početna težina')}${tile(fmt(endW, 1) + ' kg', 'zadnja težina')}${tile(startW != null && endW != null ? sgn(endW - startW, 1) + ' kg' : '–', 'promjena', startW == null || endW == null ? '' : endW <= startW ? 'good' : 'bad')}
${tile(startW != null && endW != null ? sgn((endW - startW) / (span / 7), 2) : '–', 'kg tjedno (prosjek)')}${tile(cumBal.length ? sgn(sum(cumBal) / KCAL_PER_KG, 1) + ' kg' : '–', `očekivano iz bilance (${cumBal.length} d)`)}${tile(goal && endW ? fmt(Math.max(0, endW - goal), 1) + ' kg' : '–', 'do cilja')}
${tile(`${cumFoods}/${span}`, 'dana s unosom hrane')}${tile(cumKetDays.size ? `${cumInK.size}/${cumKetDays.size}` : '–', 'dana u ketozi (mjereno)')}${tile(cumFasts.length ? `${cumFasts.length} · Ø ${fmt(mean(cumFasts.map(f => f.end - f.start)) / 3600e3, 1)} h` : '–', 'postova · prosjek')}
</div>
${both.length ? `<p style="margin:10px 0 0">Tjedni s potpunim podacima (${both.length}): očekivano <b>${sgn(sum(both.map(w => w.expectedWeek)), 1)} kg</b>, stvarno <b>${sgn(sum(both.map(w => w.actual)), 1)} kg</b>.</p>` : ''}
<h3>Kretanje težine</h3>${chart({ labels: wLabels, h: 190, series: [{ type: 'dots', values: wPts, color: 'var(--muted)', dec: 1 }, { type: 'line', values: wAvg, color: 'var(--c-weight)', span: true, width: 2.5 }], refs: goal ? [{ y: goal, color: 'var(--good)', label: 'cilj ' + fmt(goal, 1) }] : [], empty: 'Nema mjerenja težine.' })}
<p class="legend">● dnevno mjerenje · — 7-dnevni prosjek</p>
<h3>Po tjednima</h3><div class="wrap"><table><tr><th>Tjedan</th><th>Ø kg</th><th>Promjena</th><th>Očekivano</th><th>Ø UH</th><th>Ø P</th><th>Bilanca kcal</th></tr>${weekRows}</table></div>
</section>
<footer>Izvještaj je izradila aplikacija Porki iz podataka spremljenih na uređaju. Očekivana promjena računa se kao kalorijska bilanca ÷ 7700 kcal. Opće smjernice, ne medicinski savjet.</footer>
</main></body></html>`;
}

export async function sendReport() {
  const s = db.settings, ws = addDays(weekStart(today()), -7);
  const html = buildReportHtml(), text = reportSummaryText(ws);
  const subject = `Porki – izvještaj ${shortDate(ws)}–${shortDate(addDays(ws, 6))}${addDays(ws, 6).slice(0, 4)}`;
  const filename = `porki-izvjestaj-${addDays(ws, 6)}.html`;
  if (NATIVE && WB) {
    try { await WB.shareReport({ html, filename, email: s.reportEmail || '', subject, text }); }
    catch (e) { toast('Slanje nije uspjelo: ' + e.message); }
    return;
  }
  // web: preuzmi izvještaj i otvori e-mail sa sažetkom
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  location.href = `mailto:${encodeURIComponent(s.reportEmail || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text + '\n\n(Priloži preuzetu datoteku ' + filename + ')')}`;
}
export function previewReport() {
  // u aplikaciji, s gumbom za zatvaranje (window.open u Android aplikaciji nema povratka)
  openDialog(`<h2>Pregled izvještaja</h2>
    <iframe class="report-frame" title="Izvještaj" sandbox="allow-same-origin"></iframe>
    <div class="btns end" style="margin-top:10px"><button type="button" class="btn" data-action="reports">‹ Natrag</button><button type="button" class="btn primary" data-action="report-send">Pošalji</button></div>`,
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
    if (p.display !== 'granted') { toast('Obavijesti nisu dopuštene'); return; }
    const [hh, mm] = String(db.settings.reportTime || '08:00').split(':').map(Number);
    await LN.schedule({ notifications: [{
      id: REPORT_NOTIF, title: 'Tjedni izvještaj je spreman',
      body: 'Dodirni za slanje izvještaja za prošli tjedan na e-mail.',
      schedule: { on: { weekday: (d % 7) + 1, hour: hh || 0, minute: mm || 0 }, allowWhileIdle: true }, isExactNotification: false
    }] });
  } catch (e) { console.error(e); }
}
if (LN) LN.addListener('localNotificationActionPerformed', a => {
  if (a && a.notification && a.notification.id === REPORT_NOTIF) setTimeout(sendReport, 600);
}).catch?.(() => {});

export function openReports() {
  const s = db.settings;
  openDialog(`<h2>Izvještaji e-mailom</h2>
    <div class="stack">
      <label>E-mail adresa<input name="reportEmail" type="email" inputmode="email" autocomplete="email" value="${h(s.reportEmail || '')}" placeholder="ime@primjer.hr"></label>
      <label>Kumulativno od<input name="reportFrom" type="date" value="${h(s.reportFrom || '')}" max="${today()}"></label>
      <p class="muted small" style="margin:0">Prazno = od početka (prvi unos: ${shortDate(firstDataDate())}${firstDataDate().slice(0, 4)}).</p>
      <div class="grid2">
        <label>Podsjetnik<select name="reportDay"><option value="0">Isključen</option>${WEEKDAYS.map((d, i) => `<option value="${i + 1}" ${+s.reportDay === i + 1 ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <label>Vrijeme<input name="reportTime" type="time" value="${h(s.reportTime || '08:00')}"></label>
      </div>
      <p class="muted small" style="margin:0">Izvještaj sadrži prošli (završeni) tjedan i kumulativni pregled: težinu, makronutrijente, kalorijsku bilancu, očekivani i stvarni gubitak, ketone, post, grafove i tablice. ${NATIVE ? 'Otvara se aplikacija za e-mail s upisanom adresom i izvještajem u privitku – samo dodirni Pošalji.' : 'U web-verziji se izvještaj preuzme, a e-mail se otvori sa sažetkom – priloži preuzetu datoteku.'}</p>
      <div class="btns">
        <button type="button" class="btn" data-action="report-preview">Pregledaj</button>
        <button type="button" class="btn" data-action="report-send">Pošalji sada</button>
      </div>
      <div class="btns end"><button type="button" class="btn" data-action="close">Odustani</button><button class="btn primary">Spremi</button></div>
    </div>`,
    fd => {
      Object.assign(db.settings, { reportEmail: (fd.reportEmail || '').trim(), reportFrom: fd.reportFrom || '', reportDay: +fd.reportDay || 0, reportTime: fd.reportTime || '08:00' });
      save();
      scheduleReportNotif();
      toast(db.settings.reportDay ? `Podsjetnik: ${WEEKDAYS[db.settings.reportDay - 1].toLowerCase()} u ${db.settings.reportTime}` : 'Postavke izvještaja spremljene');
    });
}
