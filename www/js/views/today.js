// Kartica Danas: težina, makronutrijenti, potrošnja energije i ketoni
import { addDays, daysBetween, fmt, h, sgn, shortDate, today } from '../core/format.js';
import { GLU, KET, KET_TEXT } from '../core/ketones.js';
import { burnedOf, totals } from '../core/nutrition.js';
import { hc } from '../native/health.js';
import { avg7, dayFood, db, latestWeight, lowCarb, weightDates } from '../store.js';
import { donut, pbar } from '../ui/charts.js';
import { NATIVE, pwa, state } from '../ui/dom.js';
import { fastCard } from './fast.js';

export function viewToday() {
  const d = state.date, s = db.settings;
  const t = totals(dayFood(d));
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
    <div class="card-h"><h2>Težina</h2><span class="muted">${a7 != null ? `7-dnevni prosjek ${fmt(a7, 1)} kg${a7prev != null ? ` (${sgn(a7 - a7prev)} kg/tj)` : ''}` : 'Važi se ujutro, nakon WC-a'}</span></div>
    <form class="row" data-form="weight">
      <input name="kg" inputmode="decimal" autocomplete="off" placeholder="${prev ? fmt(prev.kg, 1) : 'npr. 85,4'}" value="${w != null ? fmt(w, 1) : ''}" aria-label="Težina u kg">
      <span class="muted">kg</span>
      <button class="btn primary">${w != null ? 'Ažuriraj' : 'Spremi'}</button>
    </form>
    ${diff != null ? `<p class="muted small" style="margin:8px 0 0">${sgn(diff)} kg u odnosu na ${shortDate(prev.date)} · dnevne oscilacije su normalne, prati prosjek</p>` : ''}
  </section>`;

  // Makronutrijenti
  const kc = { c: t.net * 4, f: t.fat * 9, p: t.protein * 4 };
  const kTot = kc.c + kc.f + kc.p;
  const pct = v => kTot ? Math.round(v / kTot * 100) : 0;
  const carbLeft = s.carbLimit - t.net;
  out += `<section class="card">
    <div class="card-h"><h2>Makronutrijenti</h2><span class="muted">${t.n} unos${t.n === 1 ? '' : 'a'}</span></div>
    <div class="carb-hero">
      ${donut(Object.assign([{ v: kc.c, color: 'var(--c-carb)' }, { v: kc.f, color: 'var(--c-fat)' }, { v: kc.p, color: 'var(--c-prot)' }], { center: `<text x="50" y="49" text-anchor="middle" style="fill:var(--ink);font-size:17px;font-weight:700">${fmt(t.kcal)}</text><text x="50" y="63" text-anchor="middle" style="fill:var(--muted);font-size:9px">kcal</text>` }))}
      <div style="flex:1;min-width:0">
        <div class="muted small">Neto ugljikohidrati</div>
        <div class="big ${carbLeft < 0 ? 'bad' : ''}">${fmt(t.net, t.net < 10 ? 1 : 0)}<span class="unit"> / ${s.carbLimit} g</span></div>
        <div class="muted small">${carbLeft >= 0 ? `Preostalo ${fmt(carbLeft, 1)} g` : `<span class="bad">Prekoračeno za ${fmt(-carbLeft, 1)} g</span>`}</div>
        <div class="legend" style="margin-top:6px"><span><i style="background:var(--c-carb)"></i>UH ${pct(kc.c)}%</span><span><i style="background:var(--c-fat)"></i>M ${pct(kc.f)}%</span><span><i style="background:var(--c-prot)"></i>P ${pct(kc.p)}%</span></div>
      </div>
    </div>
    <div style="margin-top:12px">
      ${pbar('Neto UH', t.net, s.carbLimit, 'var(--c-carb)', lowCarb())}
      ${pbar('Proteini', t.protein, s.proteinTarget, 'var(--c-prot)')}
      ${pbar('Masti', t.fat, s.fatTarget, 'var(--c-fat)')}
    </div>
    <div class="btns" style="margin-top:12px"><button class="btn primary" style="flex:1" data-action="add-food">+ Dodaj hranu</button><button class="btn" data-action="scan">Skeniraj</button></div>
  </section>`;

  // Energija
  const bal = burned != null && t.n ? t.kcal - burned : null;
  const parts = [];
  if (e?.active != null) parts.push(`aktivno ${fmt(e.active)}`);
  if (e?.basal != null) parts.push(`mirovanje ${fmt(e.basal)} kcal`);
  if (e?.steps != null) parts.push(`${fmt(e.steps)} koraka`);
  if (d === today()) parts.push('dan još traje');
  out += `<section class="card">
    <div class="card-h"><h2>Potrošnja energije</h2><span class="muted">${e?.src === 'health' ? 'Health Connect' : e ? 'ručni unos' : ''}</span></div>
    ${burned != null || e?.steps != null ? `
      <div class="tiles">
        <div class="tile"><b>${fmt(burned)}</b><span>potrošeno kcal</span></div>
        <div class="tile"><b>${fmt(t.kcal)}</b><span>uneseno kcal</span></div>
        <div class="tile"><b class="${bal == null ? '' : bal <= 0 ? 'good' : 'bad'}">${bal == null ? '–' : sgn(bal, 0)}</b><span>${bal == null ? 'bilanca' : bal <= 0 ? 'deficit' : 'suficit'}</span></div>
      </div>
      <p class="muted small" style="margin:8px 0 0">${parts.join(' · ')}</p>`
    : `<p class="muted" style="margin:0">${NATIVE ? 'Još nema podataka iz Health Connecta za ovaj dan.' : 'Još nema podataka za ovaj dan. Upiši potrošene kalorije iz Health Connecta / Samsung Healtha ili koristi Android aplikaciju za automatski uvoz.'}</p>`}
    <div class="btns" style="margin-top:12px">${healthButtons()}<button class="btn" data-action="energy-edit">Ručno</button><button class="btn" data-action="energy-bulk">Unatrag</button></div>
  </section>`;

  // Ketoni
  out += `<section class="card">
    <div class="card-h"><h2>Keto-Diastix</h2><span class="muted">${kets.length ? kets.length + ' mjerenje' + (kets.length > 1 ? 'a' : '') : ''}</span></div>
    ${lastK ? `<div class="row"><span class="dot" style="width:34px;height:34px;border-radius:8px;background:${KET[lastK.ket].c}"></span>
      <div class="grow"><b>${KET[lastK.ket].l}</b> <span class="muted">(${KET[lastK.ket].mmol} mmol/L) u ${h(lastK.time)}</span><div class="muted small">${KET_TEXT[lastK.ket]}${lastK.glu > 0 ? ` · <span class="bad">glukoza: ${GLU[lastK.glu].l} mg/dL</span>` : ''}</div></div></div>`
    : `<p class="muted" style="margin:0">Nema mjerenja za ovaj dan.</p>`}
    <div class="btns" style="margin-top:12px"><button class="btn" data-action="add-ketone">+ Novo mjerenje</button></div>
  </section>`;
  return out;
}

function healthButtons() {
  if (!NATIVE) return '';
  if (hc.status === 'not_installed' || hc.status === 'update_required')
    return `<button class="btn primary" data-action="hc-open">${hc.status === 'update_required' ? 'Ažuriraj' : 'Instaliraj'} Health Connect</button>`;
  if (hc.status === 'unavailable') return '';
  if (hc.status === 'available' && !hc.granted.length) return `<button class="btn primary" data-action="hc-perm">Dopusti pristup</button>`;
  return `<button class="btn primary" data-action="hc-sync" ${hc.syncing ? 'disabled' : ''}>${hc.syncing ? 'Sinkroniziram…' : 'Sinkroniziraj'}</button>`;
}

function banners() {
  let out = '';
  if (!db.settings.dietChosen) out += `<div class="banner"><span>Odaberi način prehrane i izračunaj svoje dnevne ciljeve.</span><button class="btn primary sm" data-action="goals">Postavi</button></div>`;
  if (pwa.installEvt && !db.settings.hideInstall) {
    out += `<div class="banner"><span>Instaliraj aplikaciju na početni zaslon za brži pristup.</span><span class="btns"><button class="btn primary sm" data-action="install">Instaliraj</button><button class="x-btn" data-action="hide-install" aria-label="Zatvori">✕</button></span></div>`;
  }
  if (NATIVE && hc.status === 'available' && !hc.granted.length) {
    out += `<div class="banner"><span>Dopusti čitanje kalorija, koraka i težine iz Health Connecta.</span><button class="btn primary sm" data-action="hc-perm">Dopusti</button></div>`;
  }
  const first = [...weightDates(), ...db.foods.map(f => f.date)].sort()[0];
  const lb = db.settings.lastBackup;
  if (first && daysBetween(first, today()) >= 14 && (!lb || daysBetween(lb, today()) > 30)) {
    out += `<div class="banner warn"><span>Podaci su spremljeni samo na ovom uređaju. ${lb ? `Zadnja kopija: ${shortDate(lb)}` : 'Napravi sigurnosnu kopiju.'}</span><button class="btn sm" data-action="export">Izvezi</button></div>`;
  }
  return out;
}
