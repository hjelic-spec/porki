// Unos ketona, potrošnje energije (i za više dana unatrag) te brzi unos težine
import { addDays, cleanNum, dayLabel, DAYS, fmt, nowTime, num, parseISO, r1, sgn, shortDate, today, uid } from '../core/format.js';
import { GLU, KET } from '../core/ketones.js';
import { burnedOf } from '../core/nutrition.js';
import { db, latestWeight, save } from '../store.js';
import { dlg, openDialog } from '../ui/dialog.js';
import { NATIVE, state, toast } from '../ui/dom.js';

/* Ketoni */
export function openKetone() {
  const sw = (arr, name, sel, sub) => arr.map((k, i) => `<label class="sw"><input type="radio" name="${name}" value="${i}" ${i === sel ? 'checked' : ''}><span style="background:${k.c}"></span><small>${k.l}${sub ? '<br>' + sub(k) : ''}</small></label>`).join('');
  openDialog(`<h2>Keto-Diastix mjerenje</h2>
    <div class="stack">
      <fieldset><legend>Ketoni – očitaj nakon 15 s</legend><div class="swatches">${sw(KET, 'ket', 1, k => k.mmol + ' mmol')}</div></fieldset>
      <fieldset><legend>Glukoza – očitaj nakon 30 s (mg/dL)</legend><div class="swatches">${sw(GLU, 'glu', 0)}</div></fieldset>
      <p class="muted small" style="margin:0">Boje na ekranu su orijentacijske – uspoređuj s tablicom na bočici.</p>
      <div class="grid2">
        <label>Datum<input type="date" name="date" value="${state.date}" max="${today()}"></label>
        <label>Vrijeme<input type="time" name="time" value="${nowTime()}"></label>
      </div>
      <label>Bilješka<input name="note" placeholder="npr. nakon treninga, natašte" autocomplete="off"></label>
      <div class="btns end"><button type="button" class="btn" data-action="close">Odustani</button><button class="btn primary">Spremi</button></div>
    </div>`,
    fd => {
      const k = { id: uid(), date: fd.date || state.date, time: fd.time || nowTime(), ket: +fd.ket || 0, glu: +fd.glu || 0, note: (fd.note || '').trim() };
      db.ketones.push(k); save();
      if (k.glu > 0) toast('Glukoza u urinu – ako se ponovi, javi se liječniku');
      else toast(`Spremljeno: ${KET[k.ket].l}`);
    });
}

/* Energija */
export function openEnergy() {
  const e = db.energy[state.date] || {};
  openDialog(`<h2>Potrošnja – ${dayLabel(state.date)}</h2>
    <div class="stack">
      <label>Ukupno potrošeno (kcal)<input name="total" inputmode="numeric" value="${e.total ?? ''}" placeholder="ili popuni aktivno + mirovanje"></label>
      <div class="grid2">
        <label>Aktivne kalorije<input name="active" inputmode="numeric" value="${e.active ?? ''}"></label>
        <label>Mirovanje (BMR)<input name="basal" inputmode="numeric" value="${e.basal ?? ''}"></label>
      </div>
      <label>Koraci<input name="steps" inputmode="numeric" value="${e.steps ?? ''}"></label>
      <p class="muted small" style="margin:0">Podatke nađeš u Health Connectu (Postavke → Health Connect → Podaci i pristup → Aktivnost), Samsung Healthu ili Google Fitu. Ako upišeš samo aktivno i mirovanje, ukupno se zbroji.${NATIVE ? ' Ručni unos ima prednost pred sinkronizacijom.' : ''}</p>
      <div class="btns end">
        ${db.energy[state.date] ? '<button type="button" class="btn danger" data-action="del-energy" style="margin-right:auto">Obriši</button>' : ''}
        <button type="button" class="btn" data-action="close">Odustani</button><button class="btn primary">Spremi</button>
      </div>
    </div>`,
    fd => {
      const n = v => { const x = cleanNum(v, true); return x == null ? null : Math.round(x); };
      const en = { total: n(fd.total), active: n(fd.active), basal: n(fd.basal), steps: n(fd.steps), src: 'manual' };
      if (en.total == null && en.active == null && en.basal == null && en.steps == null) { toast('Upiši barem jednu vrijednost'); return false; }
      db.energy[state.date] = en;
      save(); toast('Spremljeno');
    });
}

/* Potrošnja za više dana unatrag */
export function openEnergyBulk(days = 30) {
  const dates = [...Array(days)].map((_, i) => addDays(today(), -i));
  const val = v => v == null ? '' : Math.round(v);
  openDialog(`<h2>Potrošnja unatrag</h2>
    <div class="seg" style="margin-bottom:10px">${[30, 60, 90].map(n => `<button type="button" class="${n === days ? 'on' : ''}" data-action="energy-bulk" data-days="${n}">${n} dana</button>`).join('')}</div>
    <p class="muted small" style="margin:0 0 10px">Upiši ukupno potrošene kalorije (i po želji korake) za svaki dan. Prazna polja se preskaču, a obrisana vrijednost briše dan.${NATIVE ? ' Ručni unos ima prednost pred Health Connectom.' : ''}</p>
    <div class="row" style="margin-bottom:12px">
      <input name="fill" inputmode="numeric" placeholder="npr. 2200" autocomplete="off" aria-label="Kalorije za prazne dane">
      <button type="button" class="btn" data-action="energy-fill">Popuni prazne dane</button>
    </div>
    <div class="bulk-head muted small"><span>Dan</span><span>Potrošeno kcal</span><span>Koraci</span></div>
    <div class="bulk">${dates.map(d => {
      const e = db.energy[d];
      return `<div class="bulk-row">
        <label for="t_${d}"><b>${DAYS[parseISO(d).getDay()]}</b> ${shortDate(d)}${e ? `<small class="muted">${e.src === 'health' ? 'HC' : 'ručno'}</small>` : ''}</label>
        <input id="t_${d}" name="t_${d}" inputmode="numeric" value="${val(burnedOf(e))}" autocomplete="off">
        <input name="s_${d}" inputmode="numeric" value="${val(e?.steps)}" autocomplete="off" aria-label="Koraci ${shortDate(d)}">
      </div>`;
    }).join('')}</div>
    <div class="btns end" style="margin-top:12px"><button type="button" class="btn" data-action="close">Odustani</button><button class="btn primary">Spremi</button></div>`,
    fd => {
      const n = v => { const x = cleanNum(v, true); return x == null ? null : Math.round(x); };
      let changed = 0;
      for (const d of dates) {
        const e = db.energy[d], t = n(fd['t_' + d]), s = n(fd['s_' + d]);
        const oldT = burnedOf(e) == null ? null : Math.round(burnedOf(e)), oldS = e?.steps == null ? null : Math.round(e.steps);
        if (t === oldT && s === oldS) continue;
        changed++;
        if (t == null && s == null) { delete db.energy[d]; continue; }
        const keepParts = e && t === oldT; // ukupno nepromijenjeno – zadrži aktivno/mirovanje
        db.energy[d] = { total: t, active: keepParts ? e.active ?? null : null, basal: keepParts ? e.basal ?? null : null, steps: s, src: 'manual' };
      }
      save();
      toast(changed ? `Spremljeno za ${changed} ${changed === 1 ? 'dan' : 'dana'}` : 'Nema promjena');
    });
}
export function fillEmptyEnergy() {
  const f = dlg.querySelector('[name=fill]'), v = cleanNum(f && f.value, true);
  if (v == null || v < 500 || v > 10000) { toast('Upiši kalorije između 500 i 10 000'); return; }
  let n = 0;
  dlg.querySelectorAll('.bulk input[name^="t_"]').forEach(inp => { if (!inp.value.trim()) { inp.value = Math.round(v); n++; } });
  toast(n ? `Popunjeno ${n} dana – spremi za potvrdu` : 'Nema praznih dana');
}

export function openWeightQuick() {
  const d = today(), w = db.weights[d], prev = latestWeight(addDays(d, -1));
  openDialog(`<h2>Težina danas</h2>
    <div class="row">
      <input name="kg" inputmode="decimal" autocomplete="off" value="${w != null ? fmt(w, 1) : ''}" placeholder="${prev ? fmt(prev.kg, 1) : 'npr. 85,4'}" style="font-size:28px;font-weight:700" aria-label="Težina u kg">
      <span class="muted">kg</span>
    </div>
    <p class="muted small" style="margin:8px 0 0">${prev ? `Zadnje mjerenje: ${fmt(prev.kg, 1)} kg (${shortDate(prev.date)})` : 'Važi se ujutro, nakon WC-a.'}</p>
    <div class="btns end" style="margin-top:12px"><button type="button" class="btn" data-action="close">Odustani</button><button class="btn primary">Spremi</button></div>`,
    fd => {
      const kg = num(fd.kg);
      if (kg == null || kg < 20 || kg > 400) { toast('Unesi težinu u kg, npr. 85,4'); return false; }
      db.weights[d] = r1(kg);
      save();
      toast(`Spremljeno ${fmt(kg, 1)} kg${prev ? ` (${sgn(kg - prev.kg)})` : ''}`);
    },
    form => setTimeout(() => form.kg.focus(), 150));
}
