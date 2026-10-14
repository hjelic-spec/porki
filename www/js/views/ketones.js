// Kartica Ketoni: zadnjih 30 dana i popis mjerenja
import { addDays, dayLabel, daysBetween, h, shortDate, today } from '../core/format.js';
import { GLU, KET } from '../core/ketones.js';
import { db } from '../store.js';

export function viewKetones() {
  const end = today();
  const cells = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(end, -i);
    const ks = db.ketones.filter(k => k.date === d);
    const m = ks.length ? Math.max(...ks.map(k => k.ket)) : null;
    cells.push(`<span class="${m == null ? 'none' : ''}" style="${m != null ? `background:${KET[m].c}` : ''}" title="${shortDate(d)}${m != null ? ': ' + KET[m].l : ''}"></span>`);
  }
  const recent = [...db.ketones].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 25);
  const last30 = db.ketones.filter(k => daysBetween(k.date, end) < 30);
  const daysIn = new Set(last30.filter(k => k.ket >= 1).map(k => k.date)).size;
  const daysMeasured = new Set(last30.map(k => k.date)).size;
  return `
  <section class="card">
    <div class="card-h"><h2>Zadnjih 30 dana</h2><span class="muted">${daysMeasured ? `u ketozi ${daysIn}/${daysMeasured} dana` : ''}</span></div>
    <div class="strip">${cells.join('')}</div>
    <div class="legend" style="margin-top:8px">${KET.map(k => `<span><i style="background:${k.c};outline:1px solid var(--line)"></i>${k.l}</span>`).join('')}</div>
    <button class="btn primary block" style="margin-top:12px" data-action="add-ketone">+ Novo mjerenje</button>
  </section>
  <section class="card">
    <div class="card-h"><h2>Mjerenja</h2></div>
    ${recent.length ? `<ul class="list">${recent.map(k => `
      <li><span class="dot" style="background:${KET[k.ket].c}"></span>
        <div class="grow"><div><b>${KET[k.ket].l}</b> <span class="muted small">${KET[k.ket].mmol} mmol/L</span>${k.glu > 0 ? ` <span class="bad small">· glukoza ${GLU[k.glu].l}</span>` : ''}</div>
        <div class="muted small">${dayLabel(k.date)} u ${h(k.time)}${k.note ? ' · ' + h(k.note) : ''}</div></div>
        <button class="x-btn" data-action="del-ketone" data-id="${k.id}" aria-label="Obriši">✕</button></li>`).join('')}</ul>`
      : '<p class="empty">Još nema mjerenja.</p>'}
  </section>
  <section class="card help">
    <h2>Savjeti za trakice</h2>
    <ol>
      <li>Mjeri uvijek u slično doba dana (npr. navečer ili prije doručka) – rezultati su tada usporedivi.</li>
      <li>Ketone očitaj nakon <b>15 sekundi</b>, glukozu nakon <b>30 sekundi</b>.</li>
      <li>Nakon nekoliko tjedana keto-adaptacije trakice često pokazuju manje – tijelo ketone bolje iskorištava. Negativan nalaz tada ne znači da si izašao iz ketoze.</li>
      <li>Puno vode razrjeđuje urin i snižava očitanje.</li>
      <li>Glukoza u urinu nije uobičajena. Ako se ponavlja – ili su ketoni visoki uz glukozu – javi se liječniku.</li>
    </ol>
  </section>`;
}
