// Kartica Težina: graf, tempo, BMI i procjena do cilja
import { addDays, dayLabel, daysBetween, fmt, num, sgn, shortDate, today } from '../core/format.js';
import { avg7, db, weeklyRate, weightDates } from '../store.js';
import { chart } from '../ui/charts.js';
import { state } from '../ui/dom.js';

export function viewWeight() {
  const s = db.settings, ds = weightDates();
  const cur = ds.length ? db.weights[ds.at(-1)] : null;
  const start = ds.length ? db.weights[ds[0]] : null;
  const rate = weeklyRate();
  const bmi = cur && s.heightCm ? cur / (s.heightCm / 100) ** 2 : null;
  const goal = num(s.goalWeight);
  let eta = '';
  if (goal && cur && rate && rate < -0.05 && cur > goal) {
    const weeks = (cur - goal) / -rate;
    const d = addDays(today(), Math.round(weeks * 7));
    eta = `Uz trenutni tempo cilj ${fmt(goal, 1)} kg oko ${shortDate(d)}${d.slice(0, 4)}.`;
  }
  // Graf
  const end = today();
  let from = state.wRange === 0 ? (ds[0] || end) : addDays(end, -state.wRange + 1);
  if (ds[0] && from < ds[0] && state.wRange !== 0) from = ds[0] > addDays(end, -13) ? addDays(end, -13) : ds[0];
  const n = daysBetween(from, end) + 1, labels = [], pts = [], avg = [];
  for (let i = 0; i < n; i++) {
    const d = addDays(from, i);
    labels.push(shortDate(d)); pts.push(db.weights[d] ?? null);
    avg.push(db.weights[d] != null || i === n - 1 ? avg7(d) : null);
  }
  const ranges = [[30, '30 d'], [90, '3 mj'], [180, '6 mj'], [365, '1 g'], [0, 'Sve']];
  return `
  <section class="card">
    <div class="card-h"><h2>Kretanje težine</h2>
      <div class="seg">${ranges.map(([v, l]) => `<button class="${state.wRange === v ? 'on' : ''}" data-action="wrange" data-v="${v}">${l}</button>`).join('')}</div></div>
    ${chart({ labels, h: 190, title: 'Težina', series: [{ type: 'dots', values: pts, color: 'var(--muted)', opacity: .7, dec: 1, name: 'kg' }, { type: 'line', values: avg, color: 'var(--c-weight)', span: true, width: 2.5 }], refs: goal ? [{ y: goal, color: 'var(--accent)', label: 'cilj ' + fmt(goal, 1) }] : [], empty: 'Unesi težinu na kartici Danas ili ispod.' })}
    <div class="legend" style="margin-top:4px"><span><i style="background:var(--muted)"></i>dnevno mjerenje</span><span><i style="background:var(--c-weight)"></i>7-dnevni prosjek</span></div>
  </section>
  <section class="card">
    <div class="tiles">
      <div class="tile"><b>${fmt(cur, 1)}</b><span>trenutno kg</span></div>
      <div class="tile"><b class="${start && cur ? (cur - start <= 0 ? 'good' : 'bad') : ''}">${start && cur ? sgn(cur - start) : '–'}</b><span>od početka (${ds[0] ? shortDate(ds[0]) : '–'})</span></div>
      <div class="tile"><b class="${rate == null ? '' : rate <= 0 ? 'good' : 'bad'}">${rate == null ? '–' : sgn(rate, 2)}</b><span>kg/tjedan (3 tj)</span></div>
      <div class="tile"><b>${goal && cur ? fmt(Math.max(0, cur - goal), 1) : '–'}</b><span>do cilja kg</span></div>
      <div class="tile"><b>${fmt(bmi, 1)}</b><span>BMI${s.heightCm ? '' : ' (unesi visinu)'}</span></div>
      <div class="tile"><b>${ds.length}</b><span>mjerenja</span></div>
    </div>
    ${eta ? `<p class="muted small" style="margin:10px 0 0">${eta}</p>` : ''}
  </section>
  <section class="card">
    <div class="card-h"><h2>Unos</h2></div>
    <form class="row" data-form="weight-any">
      <input type="date" name="date" value="${state.date}" max="${today()}" style="flex:1.7">
      <input name="kg" inputmode="decimal" placeholder="kg" autocomplete="off" style="flex:1">
      <button class="btn primary">Spremi</button>
    </form>
    <h3>Zadnja mjerenja</h3>
    ${ds.length ? `<ul class="list">${ds.slice(-14).reverse().map((d, i, arr) => {
      const prevD = ds[ds.indexOf(d) - 1];
      const dd = prevD ? db.weights[d] - db.weights[prevD] : null;
      return `<li><div class="grow">${dayLabel(d)}</div><b>${fmt(db.weights[d], 1)} kg</b><span class="small ${dd == null ? 'muted' : dd <= 0 ? 'good' : 'bad'}" style="width:48px;text-align:right">${dd == null ? '' : sgn(dd)}</span><button class="x-btn" data-action="del-weight" data-d="${d}" aria-label="Obriši">✕</button></li>`;
    }).join('')}</ul>` : '<p class="empty">Još nema mjerenja.</p>'}
  </section>`;
}
