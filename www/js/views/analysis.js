// Kartica Analiza: tjedni pregled, uvidi i očekivano vs. stvarno
import { macroSplit } from '../core/analysis.js';
import { addDays, DAYS, fmt, mean, parseISO, r1, sgn, shortDate, sum, tjedan, today, weekStart } from '../core/format.js';
import { KET } from '../core/ketones.js';
import { KCAL_PER_KG } from '../core/nutrition.js';
import { db, latestWeight, lowCarb, weekData, weekEnergyVsScale } from '../store.js';
import { chart } from '../ui/charts.js';
import { state } from '../ui/dom.js';
import { fastWeekCard } from './fast.js';

export function insights(wd, prev) {
  const s = db.settings, out = [], L = wd.filter(x => x.logged);
  const add = (type, text) => out.push({ type, text });
  if (!L.length) add('info', 'Ovaj tjedan još nema unosa hrane.');
  else {
    const within = L.filter(x => x.net <= s.carbLimit).length;
    add(within === L.length ? 'good' : within >= L.length * 0.7 ? 'warn' : 'bad',
      `Neto UH unutar limita (${s.carbLimit} g): ${within} od ${L.length} dana s unosom. Prosjek ${fmt(mean(L.map(x => x.net)), 1)} g/dan.`);
    const avgP = mean(L.map(x => x.protein));
    if (s.proteinTarget) {
      if (avgP < s.proteinTarget * 0.85) add('warn', `Proteini u prosjeku ${fmt(avgP)} g – ispod cilja ${s.proteinTarget} g. Dovoljno proteina čuva mišiće dok mršaviš.`);
      else add('good', `Proteini u prosjeku ${fmt(avgP)} g/dan – cilj je pokriven.`);
    }
    const sp = macroSplit(L);
    if (sp) {
      if (lowCarb() && sp.carb > 10) add('warn', `Ugljikohidrati čine ${fmt(sp.carb)}% kalorija – za ketozu obično ispod 5–10%.`);
      if (lowCarb()) add(sp.fat >= 60 ? 'good' : 'info', `Raspodjela kalorija: masti ${fmt(sp.fat)}%, proteini ${fmt(sp.protein)}%, UH ${fmt(sp.carb)}%.${sp.fat < 60 ? ' Klasični LCHF je 65–75% masti; ako mršaviš bez gladi, manje masti je u redu.' : ''}`);
      else add('info', `Raspodjela kalorija: UH ${fmt(sp.carb)}%, proteini ${fmt(sp.protein)}%, masti ${fmt(sp.fat)}%.`);
    }
    const avgK = mean(L.map(x => x.kcal));
    if (s.kcalTarget && avgK > s.kcalTarget * 1.1) add('warn', `Prosječan unos ${fmt(avgK)} kcal je iznad cilja od ${fmt(s.kcalTarget)} kcal.`);
    if (L.length < 5) add('info', `Hrana je unesena za ${L.length} od 7 dana – što je dnevnik potpuniji, analiza je točnija.`);
  }
  const B = wd.filter(x => x.balance != null);
  if (B.length) {
    const tot = sum(B.map(x => x.balance));
    add(tot <= 0 ? 'good' : 'warn', `Energetska bilanca za ${B.length} dana: ${sgn(tot, 0)} kcal ≈ ${sgn(tot / KCAL_PER_KG, 2)} kg masnog tkiva.`);
  } else add('info', 'Za izračun bilance poveži potrošnju iz aplikacije Zdravlje (kartica Danas).');
  const aw = mean(wd.filter(x => x.weight != null).map(x => x.weight));
  const pw = mean(prev.filter(x => x.weight != null).map(x => x.weight));
  if (aw != null && pw != null) {
    const dd = aw - pw;
    add(dd <= 0 ? 'good' : 'warn', `Prosječna težina ${fmt(aw, 1)} kg (${sgn(dd)} kg u odnosu na prošli tjedan).`);
    if (dd < -1.5) add('info', 'Veliki pad u prvim tjednima LCHF-a većinom je voda (glikogen) – tempo će se usporiti, to je normalno.');
    if (dd > 0.5 && L.some(x => x.net > s.carbLimit)) add('info', 'Dani iznad limita UH vraćaju vodu u tijelo – skok na vagi ne znači odmah i više masti.');
  } else if (wd.filter(x => x.weight != null).length < 4) add('info', 'Važi se svakodnevno u isto vrijeme – tjedni prosjek pouzdaniji je od pojedinačnog mjerenja.');
  const K = wd.filter(x => x.ket != null);
  if (K.length) {
    const inK = K.filter(x => x.ket >= 1).length;
    add(inK === K.length ? 'good' : inK ? 'info' : 'warn', `Ketoni pozitivni ${inK} od ${K.length} dana mjerenja.`);
    if (K.some(x => x.ket >= 4)) add('warn', 'Bilo je visokih očitanja ketona – pij dovoljno vode i nadoknadi elektrolite (sol, magnezij, kalij).');
  }
  if (wd.some(x => x.glu > 0)) add('bad', 'Trakice su pokazale glukozu u urinu. Ako se ponavlja, javi se liječniku – osobito ako su i ketoni visoki.');
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
  if (exp == null) add('info', 'Za izračun su potrebni dani s unesenom hranom i potrošnjom (Health Connect ili ručni unos) – barem 3 dana u tjednu.');
  if (exp != null && e.actual != null) {
    const d = e.actual - exp;
    if (Math.abs(d) <= 0.3) add('good', 'Stvarna promjena je u skladu s kalorijskom bilancom – unos i potrošnja su dobro procijenjeni.');
    else if (d < 0) add('info', `Stvarni gubitak je ${fmt(-d, 1)} kg veći nego što bilanca predviđa. Najčešće je to voda i glikogen (osobito u prvim tjednima LCHF-a ili nakon dana s više UH), a moguće je i da je unos hrane precijenjen ili potrošnja podcijenjena.`);
    else add('warn', `Gubitak je ${fmt(d, 1)} kg manji od očekivanog. Moguće je zadržavanje vode (sol, stres, loš san, novi trening, hormonski ciklus), neupisane kalorije (ulja, umaci, orašasti plodovi, „kušanje“) ili precijenjena potrošnja s pametnog sata.`);
  } else if (exp != null) add('info', 'Za usporedbu sa stvarnim gubitkom važi se barem 2 puta tjedno, a idealno svaki dan.');
  if (both.length >= 3 && cumAct - cumExp > 0.5) {
    const perDay = (cumAct - cumExp) * KCAL_PER_KG / (both.length * 7);
    add('warn', `Kroz ${both.length} ${tjedan(both.length)} stvarni gubitak zaostaje za očekivanim za ${fmt(cumAct - cumExp, 1)} kg – to odgovara razlici od oko ${fmt(perDay)} kcal dnevno. Provjeri točnost unosa ili računaj s manjom potrošnjom od one koju pokazuje sat.`);
  }
  // Zdravlje
  const health = [];
  const hAdd = (type, text) => health.push({ type, text });
  const bw = e.avgW || latestWeight(addDays(ws, 6))?.kg;
  if (e.avgBal != null && e.avgBal < -1000) hAdd('warn', `Prosječni deficit od ${fmt(-e.avgBal)} kcal dnevno je velik. Dugotrajno veliki deficit povećava rizik gubitka mišića, umora, opadanja kose i žučnih kamenaca.`);
  if (bw && exp != null && -exp > bw * 0.01) hAdd('warn', `Očekivani gubitak od ${fmt(-exp, 1)} kg tjedno veći je od 1 % tjelesne težine – za održiv gubitak masti preporučuje se 0,5–1 % tjedno.`);
  if (bw && e.actual != null && -e.actual > bw * 0.015) hAdd('info', 'Stvarni pad veći od 1,5 % težine u tjednu najčešće je voda – nije razlog za dodatno smanjivanje hrane.');
  const L = e.wd.filter(x => x.logged);
  if (L.length && s.proteinTarget && mean(L.map(x => x.protein)) < s.proteinTarget * 0.85) hAdd('warn', 'Unos proteina je ispod cilja – u deficitu je dovoljno proteina ključno za očuvanje mišića.');
  const lowDays = L.filter(x => x.kcal < 1200).length;
  if (lowDays >= 3) hAdd('warn', `${lowDays} dana s unosom ispod 1200 kcal – tako nizak unos teško pokriva potrebe za vitaminima i mineralima.`);
  if (!health.length) hAdd('good', 'Tempo i unos ovog tjedna izgledaju umjereno i održivo.');
  return `<section class="card">
    <div class="card-h"><h2>Očekivano vs. stvarno</h2><span class="muted">${e.days ? `${e.days} od 7 dana s bilancom` : ''}</span></div>
    <div class="tiles">
      <div class="tile"><b class="${exp == null ? '' : exp <= 0 ? 'good' : 'bad'}">${kg(exp)}</b><span>očekivano (bilanca${e.days && e.days < 7 && e.expectedWeek != null ? ', procjena 7 d' : ''})</span></div>
      <div class="tile"><b class="${e.actual == null ? '' : e.actual <= 0 ? 'good' : 'bad'}">${kg(e.actual)}</b><span>stvarno (vaga)</span></div>
      <div class="tile"><b>${exp != null && e.actual != null ? sgn(e.actual - exp, 2) + ' kg' : '–'}</b><span>razlika</span></div>
    </div>
    <p class="muted small" style="margin:8px 0 0">Bilanca tjedna ${e.days ? `${sgn(e.sumBal, 0)} kcal (Ø ${sgn(e.avgBal, 0)} kcal/dan)` : '–'}${e.actualHow ? ` · stvarno: ${e.actualHow}` : ''}</p>
    <ul class="insights" style="margin-top:8px">${notes.map(n => `<li class="${n.type}">${n.text}</li>`).join('')}</ul>
    <h3>Zadnjih 8 tjedana</h3>
    ${chart({ labels: weeks.map(w => shortDate(w.ws)), h: 160, zero: true, maxLabels: 8,
      series: [
        { type: 'bar', values: weeks.map(w => w.expectedWeek != null ? Math.round(w.expectedWeek * 100) / 100 : null), color: 'color-mix(in srgb, var(--accent) 45%, transparent)', dec: 2, name: 'kg očekivano' },
        { type: 'line', values: weeks.map(w => w.actual != null ? Math.round(w.actual * 100) / 100 : null), color: 'var(--ink)', width: 2 },
        { type: 'dots', values: weeks.map(w => w.actual != null ? Math.round(w.actual * 100) / 100 : null), color: 'var(--ink)', dec: 2, name: 'kg stvarno' }
      ], empty: 'Još nema dovoljno podataka o bilanci i težini.' })}
    <div class="legend" style="margin-top:4px"><span><i style="background:color-mix(in srgb, var(--accent) 45%, transparent)"></i>očekivano iz bilance</span><span><i style="background:var(--ink)"></i>stvarno na vagi</span></div>
    ${both.length ? `<p class="small" style="margin:8px 0 0">Ukupno za ${both.length} ${tjedan(both.length)} s podacima: očekivano <b>${sgn(cumExp, 1)} kg</b>, stvarno <b>${sgn(cumAct, 1)} kg</b>.</p>` : ''}
    <h3>Zdravlje</h3>
    <ul class="insights">${health.map(n => `<li class="${n.type}">${n.text}</li>`).join('')}</ul>
    <details class="explain">
      <summary>Kako se računa i na što pripaziti</summary>
      <div class="help">
        <p><b>Očekivani gubitak</b> = zbroj dnevne bilance (unos hrane − potrošnja) ÷ 7700 kcal, koliko otprilike sadrži 1 kg masnog tkiva. Računaju se samo dani s unesenom hranom i poznatom potrošnjom; ako ih je manje od 7, prosjek se preračuna na cijeli tjedan.</p>
        <p><b>Stvarna promjena</b> = prosjek težine ovog tjedna minus prosjek prošlog tjedna. Prosjeci su pouzdaniji od pojedinačnih mjerenja jer težina dnevno oscilira 0,5–1,5 kg.</p>
        <p><b>Zašto se razlikuju:</b> vaga mjeri i vodu, glikogen (1 g glikogena veže oko 3 g vode), sadržaj crijeva i sol. Na početku LCHF-a pad je brži od bilance jer se troši glikogen; nakon dana s više UH težina skoči iako masti nije više. Pametni satovi potrošnju često precijene za 10–30 %, a unos hrane se lako podcijeni. Zato gledaj trend kroz 3–4 tjedna, a ne pojedini tjedan.</p>
        <p><b>Na što pripaziti radi zdravlja:</b></p>
        <ol>
          <li>Ciljaj gubitak 0,5–1 % tjelesne težine tjedno; prebrzo mršavljenje povećava rizik gubitka mišića i žučnih kamenaca.</li>
          <li>Dovoljno proteina (oko 1,2–1,6 g po kg ciljne težine) i trening snage čuvaju mišiće.</li>
          <li>Pij dovoljno vode i nadoknadi elektrolite – posebno sol (natrij), magnezij i kalij – osobito u prvim tjednima (glavobolja, umor i grčevi znak su „keto gripe“).</li>
          <li>Jedi dovoljno povrća s malo UH zbog vlakana, vitamina i probave.</li>
          <li>San i stres utječu na zadržavanje vode i apetit.</li>
          <li>Važi se u isto vrijeme (ujutro, nakon WC-a), a povremeno izmjeri i opseg struka – mijenja se i kad vaga stoji.</li>
          <li>Ako uzimaš lijekove za šećer ili tlak, LCHF može zahtijevati prilagodbu doze – dogovori se s liječnikom. Povremeno provjeri krvne nalaze (masnoće, glukoza, jetra, bubrezi).</li>
        </ol>
        <p class="muted small">Ovo su opće smjernice, a ne medicinski savjet.</p>
      </div>
    </details>
  </section>`;
}
export function viewAnalysis() {
  const ws = state.week, we = addDays(ws, 6), s = db.settings;
  const wd = weekData(ws), prev = weekData(addDays(ws, -7));
  const L = wd.filter(x => x.logged);
  const labels = wd.map(x => DAYS[parseISO(x.d).getDay()]);
  const tbl = wd.map(x => `<tr><td>${DAYS[parseISO(x.d).getDay()]} ${shortDate(x.d)}</td>
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
      <button class="icon-btn" data-action="prev-week" aria-label="Prethodni tjedan">‹</button>
      <div style="text-align:center"><b>${shortDate(ws)} – ${shortDate(we)}${we.slice(0, 4)}</b><div class="muted small">${thisWeek ? 'ovaj tjedan' : 'tjedni pregled'}</div></div>
      <button class="icon-btn" data-action="next-week" ${thisWeek ? 'disabled' : ''} aria-label="Sljedeći tjedan">›</button>
    </div>
  </section>
  <section class="card">
    <div class="tiles">
      <div class="tile"><b>${fmt(avgOf('net'), 1)}</b><span>Ø neto UH g</span></div>
      <div class="tile"><b>${fmt(avgOf('fat'))}</b><span>Ø masti g</span></div>
      <div class="tile"><b>${fmt(avgOf('protein'))}</b><span>Ø proteini g</span></div>
      <div class="tile"><b>${fmt(avgOf('kcal'))}</b><span>Ø unos kcal</span></div>
      <div class="tile"><b>${fmt(mean(wd.filter(x => x.burned != null).map(x => x.burned)))}</b><span>Ø potrošnja kcal</span></div>
      <div class="tile"><b>${fmt(mean(wd.filter(x => x.steps != null).map(x => x.steps)))}</b><span>Ø koraka</span></div>
    </div>
  </section>
  <section class="card"><div class="card-h"><h2>Uvidi</h2></div>
    <ul class="insights">${insights(wd, prev).map(i => `<li class="${i.type}">${i.text}</li>`).join('')}</ul>
  </section>
  ${energyVsScaleCard(ws)}
  <section class="card"><div class="card-h"><h2>Neto ugljikohidrati</h2><span class="muted">g/dan</span></div>
    ${chart({ labels, h: 150, zero: true, series: [{ type: 'bar', values: wd.map(x => x.logged ? r1(x.net) : null), color: v => v > s.carbLimit ? 'var(--bad)' : 'var(--c-carb)', dec: 1, name: 'g' }], refs: [{ y: s.carbLimit, color: 'var(--bad)', label: 'limit ' + s.carbLimit }], empty: 'Nema unosa hrane ovaj tjedan.' })}
  </section>
  <section class="card"><div class="card-h"><h2>Kalorije: unos i potrošnja</h2></div>
    ${chart({ labels, h: 170, zero: true, series: [
      { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.net * 4) : null), color: 'var(--c-carb)', name: 'kcal iz UH' },
      { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.protein * 4) : null), color: 'var(--c-prot)', name: 'kcal iz proteina' },
      { type: 'bar', stack: true, values: wd.map(x => x.logged ? Math.round(x.fat * 9) : null), color: 'var(--c-fat)', name: 'kcal iz masti' },
      { type: 'line', values: wd.map(x => x.burned), color: 'var(--c-burn)', width: 2 },
      { type: 'dots', values: wd.map(x => x.burned), color: 'var(--c-burn)', name: 'kcal potrošeno' }
    ], refs: s.kcalTarget ? [{ y: s.kcalTarget, color: 'var(--muted)', label: 'cilj' }] : [] })}
    <div class="legend" style="margin-top:4px"><span><i style="background:var(--c-fat)"></i>masti</span><span><i style="background:var(--c-prot)"></i>proteini</span><span><i style="background:var(--c-carb)"></i>UH</span><span><i style="background:var(--c-burn)"></i>potrošeno</span></div>
  </section>
  <section class="card"><div class="card-h"><h2>Po danima</h2></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Dan</th><th>UH</th><th>M</th><th>P</th><th>kcal</th><th>Potr.</th><th>Bil.</th><th>kg</th><th>Ket</th></tr></thead>
      <tbody>${tbl}</tbody></table></div>
  </section>
  ${fastWeekCard(ws, we)}
  <section class="card"><div class="card-h"><h2>Trend zadnjih 8 tjedana</h2></div>
    ${chart({ labels: wk.map(x => shortDate(x.w)), h: 150, maxLabels: 8, series: [{ type: 'line', values: wk.map(x => x.weight), color: 'var(--c-weight)', span: true }, { type: 'dots', values: wk.map(x => x.weight), color: 'var(--c-weight)', dec: 1, name: 'kg' }], empty: 'Premalo mjerenja težine.' })}
    <div class="tbl-wrap"><table class="tbl" style="margin-top:8px">
      <thead><tr><th>Tjedan</th><th>Ø kg</th><th>Ø neto UH</th><th>Bilanca kcal</th></tr></thead>
      <tbody>${wk.slice().reverse().map(x => `<tr><td>${shortDate(x.w)}</td><td>${fmt(x.weight, 1)}</td><td>${fmt(x.net, 1)}</td><td class="${x.bal == null ? '' : x.bal <= 0 ? 'good' : 'bad'}">${x.bal == null ? '–' : sgn(x.bal, 0)}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}
